import { randomUUID, createHash } from 'node:crypto';
import { MemberStatus, TenantRole, TenantStatus, InvitationStatus } from '@task-board/shared';
import type { Tenant, TenantMember, CreateTenant, UpdateTenant } from '@task-board/shared';
import { AppError, ConflictError, ForbiddenError, NotFoundError } from '../errors/app-error.js';
import { TenantRepository } from '../repositories/tenant.repository.js';
import { TenantMemberRepository } from '../repositories/tenant-member.repository.js';
import { UserRepository } from '../repositories/user.repository.js';
import type { InvitationDocument } from '../repositories/tenant-member.repository.js';
import type { EmailService } from './email.service.js';
import type { AuditService } from './audit.service.js';

/** Structural type that both EmailService and ConsoleEmailService satisfy */
type EmailSender = Pick<EmailService, 'sendInvitationEmail'>;

/** Minimal project repository interface for tenant cascade operations */
export interface TenantServiceProjectRepo {
  findByTenant(tenantId: string): Promise<{ id: string; status: string; archiveReason: string | null }[]>;
  update(id: string, data: Record<string, unknown>): Promise<unknown>;
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** Grace period before permanent deletion (30 days) */
const DELETION_GRACE_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;
/** Invitation TTL (7 days) */
const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// ─── Tenant Service ──────────────────────────────────────────────────────────

export class TenantService {
  constructor(
    private readonly tenantRepo: TenantRepository,
    private readonly tenantMemberRepo: TenantMemberRepository,
    private readonly userRepo: UserRepository,
    private readonly emailService: EmailSender,
    private readonly projectRepo?: TenantServiceProjectRepo,
    private readonly auditService?: AuditService,
  ) {}

  // ─── Tenant CRUD ──────────────────────────────────────────────────────────

  async createTenant(userId: string, input: CreateTenant): Promise<Tenant> {
    const tenant = await this.tenantRepo.create({ ...input });

    await this.tenantMemberRepo.create({
      userId,
      tenantId: tenant.id,
      role: TenantRole.OWNER,
      status: MemberStatus.ACTIVE,
    });

    // Audit side effect
    if (this.auditService) {
      await this.auditService.log({
        tenantId: tenant.id,
        projectId: null,
        entityType: 'PROJECT', // closest entity type for tenant-level
        entityId: tenant.id,
        action: 'CREATED',
        actorId: userId,
      });
    }

    return tenant;
  }

  async listTenantsForUser(userId: string): Promise<Tenant[]> {
    const memberships = await this.tenantMemberRepo.findByUser(userId);
    const tenants: Tenant[] = [];

    for (const membership of memberships) {
      if (membership.status !== MemberStatus.ACTIVE) continue;

      const tenant = await this.tenantRepo.findById(membership.tenantId);

      if (tenant) {
        tenants.push(tenant);
      }
    }

    return tenants;
  }

  async listTenantsWithRole(userId: string): Promise<(Tenant & { role: string })[]> {
    const memberships = await this.tenantMemberRepo.findByUser(userId);
    const result: (Tenant & { role: string })[] = [];

    for (const m of memberships) {
      if (m.status !== MemberStatus.ACTIVE) continue;

      const tenant = await this.tenantRepo.findById(m.tenantId);

      if (tenant) {
        result.push({ ...tenant, role: m.role });
      }
    }

    return result;
  }

  async getTenant(id: string): Promise<Tenant> {
    const tenant = await this.tenantRepo.findById(id);

    if (!tenant) {
      throw new NotFoundError('Tenant not found');
    }
    return tenant;
  }

  async updateTenant(userId: string, id: string, input: UpdateTenant): Promise<Tenant> {
    const membership = await this.requireMembership(userId, id);

    if (membership.role !== TenantRole.OWNER && membership.role !== TenantRole.ADMIN) {
      throw new ForbiddenError('Only owner or admin can update the tenant');
    }

    this.requireNotArchived(await this.getTenant(id));

    const tenant = await this.tenantRepo.update(id, input);

    if (!tenant) {
      throw new NotFoundError('Tenant not found');
    }

    return tenant;
  }

  // ─── Tenant Lifecycle ─────────────────────────────────────────────────────

  async deleteTenant(userId: string, id: string): Promise<void> {
    const membership = await this.requireMembership(userId, id);

    if (membership.role !== TenantRole.OWNER) {
      throw new ForbiddenError('Only the owner can delete the tenant');
    }

    this.requireNotArchived(await this.getTenant(id));

    const deletionScheduledAt = new Date(Date.now() + DELETION_GRACE_PERIOD_MS);

    await this.tenantRepo.update(id, {
      status: TenantStatus.DELETION_PENDING,
      deletionScheduledAt,
    });
  }

  async archiveTenant(userId: string, id: string): Promise<void> {
    const membership = await this.requireMembership(userId, id);

    if (membership.role !== TenantRole.OWNER && membership.role !== TenantRole.ADMIN) {
      throw new ForbiddenError('Only owner or admin can archive the tenant');
    }

    const tenant = await this.getTenant(id);

    this.requireNotArchived(tenant);

    // Archive tenant
    await this.tenantRepo.update(id, { status: TenantStatus.ARCHIVED });

    // Archive all non-archived projects with TENANT_ARCHIVE reason
    if (this.projectRepo) {
      const projects = await this.projectRepo.findByTenant(id);

      for (const project of projects) {
        if (project.status !== 'ARCHIVED') {
          await this.projectRepo.update(project.id, {
            status: 'ARCHIVED',
            archiveReason: 'TENANT_ARCHIVE',
          });
        }
      }
    }
  }

  async restoreTenant(userId: string, id: string): Promise<void> {
    const membership = await this.requireMembership(userId, id);

    if (membership.role !== TenantRole.OWNER && membership.role !== TenantRole.ADMIN) {
      throw new ForbiddenError('Only owner or admin can restore the tenant');
    }

    await this.tenantRepo.update(id, {
      status: TenantStatus.ACTIVE,
      deletionScheduledAt: null,
    });

    // Restore only projects archived due to TENANT_ARCHIVE
    if (this.projectRepo) {
      const projects = await this.projectRepo.findByTenant(id);

      for (const project of projects) {
        if (project.status === 'ARCHIVED' && project.archiveReason === 'TENANT_ARCHIVE') {
          await this.projectRepo.update(project.id, {
            status: 'ACTIVE',
            archiveReason: null,
          });
        }
      }
    }
  }

  async cancelDeletion(userId: string, id: string): Promise<void> {
    const membership = await this.requireMembership(userId, id);

    if (membership.role !== TenantRole.OWNER) {
      throw new ForbiddenError('Only the owner can cancel deletion');
    }

    await this.tenantRepo.update(id, {
      status: TenantStatus.ACTIVE,
      deletionScheduledAt: null,
    });
  }

  async permanentDelete(id: string): Promise<void> {
    const tenant = await this.getTenant(id);

    if (tenant.status !== TenantStatus.DELETION_PENDING) {
      throw new AppError(400, 'CONFLICT', 'Tenant must be in DELETION_PENDING status');
    }

    // Remove all memberships
    const members = await this.tenantMemberRepo.findByTenant(id);

    for (const member of members) {
      await this.tenantMemberRepo.delete(id, member.userId);
    }

    await this.tenantRepo.delete(id);
  }

  // ─── Member Management ─────────────────────────────────────────────────────

  async getTenantMembers(tenantId: string): Promise<TenantMember[]> {
    const members = await this.tenantMemberRepo.findByTenant(tenantId);
    const enriched: TenantMember[] = [];

    for (const member of members) {
      const user = member.userId ? await this.userRepo.findById(member.userId) : null;

      enriched.push({
        ...member,
        displayName: user?.displayName ?? null,
        email: user?.email ?? null,
      });
    }
    return enriched;
  }

  async inviteUser(requesterId: string, tenantId: string, email: string, role: string): Promise<TenantMember> {
    const requesterMembership = await this.requireMembership(requesterId, tenantId);

    if (requesterMembership.role !== TenantRole.OWNER && requesterMembership.role !== TenantRole.ADMIN) {
      throw new ForbiddenError('Only owner or admin can invite members');
    }

    const tenant = await this.getTenant(tenantId);

    this.requireNotArchived(tenant);

    // Check if user is already an active member
    const existingUser = await this.userRepo.findByEmail(email);

    if (existingUser) {
      const existingMember = await this.tenantMemberRepo.findByUserAndTenant(existingUser.id, tenantId);

      if (existingMember && existingMember.status === MemberStatus.ACTIVE) {
        throw new ConflictError('User is already a member of this tenant');
      }
    }

    // Generate invitation token and hash
    const token = randomUUID();
    const tokenHash = hashToken(token);
    const invitationDoc: InvitationDocument = {
      status: InvitationStatus.PENDING,
      tokenHash,
      invitedBy: requesterId,
      invitedOn: new Date(),
    };
    // If user doesn't exist, create a placeholder user
    let userId = existingUser?.id;

    if (!userId) {
      const placeholderUser = await this.userRepo.create({
        email,
        displayName: email.split('@')[0] ?? email,
        passwordHash: '', // no password yet
      });

      userId = placeholderUser.id;
    }

    // Check for existing pending invitation — replace it instead of throwing
    const existingMember = await this.tenantMemberRepo.findByUserAndTenant(userId, tenantId);

    if (existingMember && existingMember.invitation?.status === InvitationStatus.PENDING) {
      // Replace existing invitation with new token
      const invitationDoc: InvitationDocument = {
        status: InvitationStatus.PENDING,
        tokenHash,
        invitedBy: requesterId,
        invitedOn: new Date(),
      };

      await this.tenantMemberRepo.update(existingMember.id, {
        role,
        invitation: invitationDoc,
      });

      // Send new invitation email
      try {
        const inviter = await this.userRepo.findById(requesterId);

        await this.emailService.sendInvitationEmail({
          to: email,
          inviterName: inviter?.displayName ?? 'A team member',
          tenantName: tenant.name,
          role,
          token,
        });
      } catch (err) {
        console.error('Failed to send re-invitation email:', err);
      }

      return {
        ...existingMember,
        role,
        invitation: { ...invitationDoc, invitedOn: invitationDoc.invitedOn.toISOString() },
      } as unknown as TenantMember;
    }

    const member = await this.tenantMemberRepo.create({
      userId,
      tenantId,
      role,
      status: MemberStatus.ACTIVE, // Member doc is ACTIVE; invitation tracks the pending state
      invitation: invitationDoc,
    });

    // Send invitation email (fire and forget)
    try {
      const inviter = await this.userRepo.findById(requesterId);

      await this.emailService.sendInvitationEmail({
        to: email,
        inviterName: inviter?.displayName ?? 'A team member',
        tenantName: tenant.name,
        role,
        token, // plaintext token sent in email
      });
    } catch (err) {
      console.error('Failed to send invitation email:', err);
    }

    return member;
  }

  async updateMemberRole(requesterId: string, tenantId: string, userId: string, role: string): Promise<TenantMember> {
    const requesterMembership = await this.requireMembership(requesterId, tenantId);

    if (requesterMembership.role !== TenantRole.OWNER && requesterMembership.role !== TenantRole.ADMIN) {
      throw new ForbiddenError('Only owner or admin can update member roles');
    }

    const targetMembership = await this.requireMembership(userId, tenantId);

    if (targetMembership.role === TenantRole.OWNER) {
      throw new ForbiddenError("Cannot change the owner's role");
    }

    const updated = await this.tenantMemberRepo.updateRole(tenantId, userId, role);

    if (!updated) {
      throw new NotFoundError('Member not found');
    }

    return updated;
  }

  async removeMember(requesterId: string, tenantId: string, userId: string): Promise<void> {
    const requesterMembership = await this.requireMembership(requesterId, tenantId);

    if (requesterMembership.role !== TenantRole.OWNER && requesterMembership.role !== TenantRole.ADMIN) {
      throw new ForbiddenError('Only owner or admin can remove members');
    }

    const targetMembership = await this.requireMembership(userId, tenantId);

    if (targetMembership.role === TenantRole.OWNER) {
      throw new ForbiddenError('Cannot remove the owner from the tenant');
    }

    await this.tenantMemberRepo.delete(tenantId, userId);
  }

  // ─── Invitation Lifecycle ──────────────────────────────────────────────────

  async acceptInvitation(memberId: string): Promise<void> {
    const member = await this.tenantMemberRepo.findById(memberId);

    if (!member) {
      throw new NotFoundError('Invitation not found');
    }

    if (!member.invitation || member.invitation.status !== InvitationStatus.PENDING) {
      throw new NotFoundError('Invitation is no longer pending');
    }

    // Check TTL expiration
    const invitedOn = new Date(member.invitation.invitedOn).getTime();

    if (Date.now() - invitedOn > INVITATION_TTL_MS) {
      await this.tenantMemberRepo.update(memberId, {
        invitation: { ...member.invitation, status: InvitationStatus.EXPIRED },
      });
      throw new AppError(410, 'INVITATION_EXPIRED', 'Invitation has expired');
    }

    await this.tenantMemberRepo.update(memberId, {
      invitation: null,
      status: MemberStatus.ACTIVE,
    });
  }

  async declineInvitation(memberId: string, userId: string): Promise<void> {
    const member = await this.tenantMemberRepo.findById(memberId);

    if (!member) {
      throw new NotFoundError('Invitation not found');
    }

    if (!member.invitation || member.invitation.status !== InvitationStatus.PENDING) {
      throw new ConflictError('Invitation is no longer pending');
    }

    if (member.userId !== userId) {
      throw new ForbiddenError('You can only decline your own invitations');
    }

    await this.tenantMemberRepo.update(memberId, {
      invitation: { ...member.invitation, status: InvitationStatus.DECLINED },
    });
  }

  async revokeInvitation(requesterId: string, tenantId: string, memberId: string): Promise<void> {
    const requesterMembership = await this.requireMembership(requesterId, tenantId);

    if (requesterMembership.role !== TenantRole.OWNER && requesterMembership.role !== TenantRole.ADMIN) {
      throw new ForbiddenError('Only owner or admin can revoke invitations');
    }

    const member = await this.tenantMemberRepo.findById(memberId);

    if (!member || member.tenantId !== tenantId) {
      throw new NotFoundError('Invitation not found in this tenant');
    }

    if (!member.invitation || member.invitation.status !== InvitationStatus.PENDING) {
      throw new ConflictError('Invitation is no longer pending');
    }

    await this.tenantMemberRepo.update(memberId, {
      invitation: { ...member.invitation, status: InvitationStatus.REVOKED },
    });
  }

  async reinviteUser(requesterId: string, tenantId: string, memberId: string): Promise<void> {
    const requesterMembership = await this.requireMembership(requesterId, tenantId);

    if (requesterMembership.role !== TenantRole.OWNER && requesterMembership.role !== TenantRole.ADMIN) {
      throw new ForbiddenError('Only owner or admin can reinvite users');
    }

    const member = await this.tenantMemberRepo.findById(memberId);

    if (!member || member.tenantId !== tenantId) {
      throw new NotFoundError('Member not found in this tenant');
    }

    // Generate new token
    const token = randomUUID();
    const tokenHash = hashToken(token);
    const invitationDoc: InvitationDocument = {
      status: InvitationStatus.PENDING,
      tokenHash,
      invitedBy: requesterId,
      invitedOn: new Date(),
    };

    await this.tenantMemberRepo.update(memberId, { invitation: invitationDoc });

    // Send email
    try {
      const user = await this.userRepo.findById(member.userId);
      const tenant = await this.getTenant(tenantId);
      const inviter = await this.userRepo.findById(requesterId);

      if (user) {
        await this.emailService.sendInvitationEmail({
          to: user.email,
          inviterName: inviter?.displayName ?? 'A team member',
          tenantName: tenant.name,
          role: member.role,
          token,
        });
      }
    } catch (err) {
      console.error('Failed to send reinvitation email:', err);
    }
  }

  async restoreMembership(requesterId: string, tenantId: string, memberId: string): Promise<void> {
    const requesterMembership = await this.requireMembership(requesterId, tenantId);

    if (requesterMembership.role !== TenantRole.OWNER && requesterMembership.role !== TenantRole.ADMIN) {
      throw new ForbiddenError('Only owner or admin can restore memberships');
    }

    const member = await this.tenantMemberRepo.findById(memberId);

    if (!member || member.tenantId !== tenantId) {
      throw new NotFoundError('Member not found in this tenant');
    }

    if (member.status !== MemberStatus.ACCESS_REVOKED) {
      throw new ConflictError('Only ACCESS_REVOKED memberships can be restored');
    }

    await this.tenantMemberRepo.update(memberId, { status: MemberStatus.ACTIVE });
  }

  async revokeAccess(requesterId: string, tenantId: string, memberId: string): Promise<void> {
    const requesterMembership = await this.requireMembership(requesterId, tenantId);

    if (requesterMembership.role !== TenantRole.OWNER && requesterMembership.role !== TenantRole.ADMIN) {
      throw new ForbiddenError('Only owner or admin can revoke access');
    }

    const membership = await this.tenantMemberRepo.findById(memberId);

    if (!membership || membership.tenantId !== tenantId) {
      throw new NotFoundError('Member not found in this tenant');
    }

    if (membership.role === TenantRole.OWNER) {
      throw new ForbiddenError("Cannot revoke the owner's access");
    }

    await this.tenantMemberRepo.update(memberId, { status: MemberStatus.ACCESS_REVOKED });
  }

  async hardDeleteMember(requesterId: string, tenantId: string, memberId: string): Promise<void> {
    const requesterMembership = await this.requireMembership(requesterId, tenantId);

    if (requesterMembership.role !== TenantRole.OWNER && requesterMembership.role !== TenantRole.ADMIN) {
      throw new ForbiddenError('Only owner or admin can permanently remove members');
    }

    const membership = await this.tenantMemberRepo.findById(memberId);

    if (!membership || membership.tenantId !== tenantId) {
      throw new NotFoundError('Member not found in this tenant');
    }

    if (membership.role === TenantRole.OWNER) {
      throw new ForbiddenError('Cannot permanently remove the owner');
    }

    await this.tenantMemberRepo.deleteById(memberId);
  }

  async getMyInvitations(email: string): Promise<TenantMember[]> {
    const memberships = await this.tenantMemberRepo.findPendingByEmail(email);
    const enriched: TenantMember[] = [];

    for (const doc of memberships) {
      const user = doc.userId ? await this.userRepo.findById(doc.userId) : null;

      enriched.push({
        id: doc.id,
        tenantId: doc.tenantId,
        userId: doc.userId,
        role: doc.role as TenantMember['role'],
        status: doc.status as TenantMember['status'],
        invitation: doc.invitation
          ? {
              status: doc.invitation.status as TenantMember['invitation'] extends infer I
                ? I extends { status: infer S }
                  ? S
                  : never
                : never,
              tokenHash: doc.invitation.tokenHash,
              invitedBy: doc.invitation.invitedBy,
              invitedOn: doc.invitation.invitedOn.toISOString(),
            }
          : null,
        displayName: user?.displayName ?? null,
        email: user?.email ?? null,
        createdAt: doc.createdAt.toISOString(),
        updatedAt: doc.updatedAt.toISOString(),
      });
    }
    return enriched;
  }

  // ─── User Deletion ─────────────────────────────────────────────────────────

  /**
   * Soft-delete a user. Removes all tenant memberships but preserves
   * historical snapshots in tasks/comments.
   */
  async deleteUser(requesterId: string, userId: string): Promise<void> {
    // Only tenant owners can delete users
    // The requester must be a tenant owner somewhere
    const requester = await this.userRepo.findById(requesterId);

    if (!requester) {
      throw new NotFoundError('Requester not found');
    }

    const targetUser = await this.userRepo.findById(userId);

    if (!targetUser) {
      throw new NotFoundError('User not found');
    }

    // Cannot delete yourself
    if (requesterId === userId) {
      throw new ForbiddenError('Cannot delete your own account');
    }

    // Soft-delete the user
    await this.userRepo.softDelete(userId);
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private requireNotArchived(tenant: Tenant): void {
    if (tenant.status === TenantStatus.ARCHIVED) {
      throw new AppError(409, 'TENANT_ARCHIVED', 'Tenant is archived and cannot be modified');
    }
  }

  private async requireMembership(userId: string, tenantId: string): Promise<TenantMember> {
    const membership = await this.tenantMemberRepo.findByUserAndTenant(userId, tenantId);

    if (!membership || membership.status !== MemberStatus.ACTIVE) {
      throw new ForbiddenError('You are not a member of this tenant');
    }
    return membership;
  }
}
