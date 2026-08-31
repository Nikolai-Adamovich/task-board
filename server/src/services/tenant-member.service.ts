import { randomUUID, createHash } from 'node:crypto';
import { MemberStatus, TenantRole, TenantStatus, InvitationStatus, INVITATION_TTL_MS } from '@task-board/shared';
import type { Tenant, TenantMember, MyInvitation } from '@task-board/shared';
import { AppError, ConflictError, ForbiddenError, NotFoundError } from '../errors/app-error.js';
import { MyInvitationSchema } from '../schemas/tenant.js';
import { TenantRepository } from '../repositories/tenant.repository.js';
import { TenantMemberRepository } from '../repositories/tenant-member.repository.js';
import { UserRepository } from '../repositories/user.repository.js';
import type { InvitationDocument } from '../repositories/tenant-member.repository.js';
import type { EmailService } from './email.service.js';

/** Structural type that both EmailService and ConsoleEmailService satisfy */
type EmailSender = Pick<EmailService, 'sendInvitationEmail'>;

// ─── Constants ───────────────────────────────────────────────────────────────

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * DEC-055: a membership whose `expiresAt` is on/after now is treated as
 * ACCESS_REVOKED (lazy evaluation — no cron; the status flips when observed).
 */
export function isMembershipExpired(member: { expiresAt: string | null }): boolean {
  return member.expiresAt !== null && new Date(member.expiresAt).getTime() <= Date.now();
}

// ─── Tenant Member Service ───────────────────────────────────────────────────

/**
 * Member management and invitation lifecycle for a tenant.
 * Split from {@link TenantService} so each file has a single responsibility.
 */
export class TenantMemberService {
  constructor(
    private readonly tenantRepo: TenantRepository,
    private readonly tenantMemberRepo: TenantMemberRepository,
    private readonly userRepo: UserRepository,
    private readonly emailService: EmailSender,
  ) {}

  // ─── Member Management ─────────────────────────────────────────────────────

  async getTenantMembers(
    requesterId: string,
    tenantId: string,
    precheckedMembership?: TenantMember,
  ): Promise<TenantMember[]> {
    // IDOR guard: only tenant members may list the tenant's members
    await this.requireMembership(requesterId, tenantId, precheckedMembership);

    const members = await this.tenantMemberRepo.findByTenant(tenantId);
    const effectiveMembers: TenantMember[] = [];

    for (const member of members) {
      // DEC-055 lazy revoke: an ACTIVE membership past its expiration is
      // flipped to ACCESS_REVOKED when observed (no cron on Workers).
      let effective = member;

      if (member.status === MemberStatus.ACTIVE && isMembershipExpired(member)) {
        const flipped = await this.tenantMemberRepo.update(member.id, { status: MemberStatus.ACCESS_REVOKED });

        if (flipped) effective = flipped;
      }

      effectiveMembers.push(effective);
    }

    // Batch user lookup (N+1 fix): one `$in` query instead of one per member
    const userIds = [...new Set(effectiveMembers.map((m) => m.userId).filter((id): id is string => Boolean(id)))];
    const users = await this.userRepo.findByIds(userIds);
    const userById = new Map(users.map((u) => [u.id, u]));

    return effectiveMembers.map((effective) => ({
      ...effective,
      displayName: effective.userId ? (userById.get(effective.userId)?.displayName ?? null) : null,
      email: effective.userId ? (userById.get(effective.userId)?.email ?? null) : null,
    }));
  }

  async inviteUser(
    requesterId: string,
    tenantId: string,
    email: string,
    role: string,
    precheckedMembership?: TenantMember,
  ): Promise<TenantMember> {
    const requesterMembership = await this.requireMembership(requesterId, tenantId, precheckedMembership);

    if (requesterMembership.role !== TenantRole.OWNER && requesterMembership.role !== TenantRole.ADMIN) {
      throw new ForbiddenError('Only owner or admin can invite members');
    }

    const tenant = await this.requireActiveTenant(tenantId);
    // Check if user is already an active member
    const existingUser = await this.userRepo.findByEmail(email);

    if (existingUser) {
      const existingMember = await this.tenantMemberRepo.findByUserAndTenant(existingUser.id, tenantId);

      if (existingMember && existingMember.status === MemberStatus.ACTIVE && !existingMember.invitation) {
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
      invitedEmail: email.toLowerCase().trim(),
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
      // Replace existing invitation with new token — membership stays ACCESS_REVOKED until accepted (DEC-018)
      const replacementDoc: InvitationDocument = {
        status: InvitationStatus.PENDING,
        tokenHash,
        invitedBy: requesterId,
        invitedOn: new Date(),
        invitedEmail: email.toLowerCase().trim(),
      };

      await this.tenantMemberRepo.update(existingMember.id, {
        role,
        invitation: replacementDoc,
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
        invitation: { ...replacementDoc, invitedOn: replacementDoc.invitedOn.toISOString() },
      } as unknown as TenantMember;
    }

    // DEC-018: an invited membership persists as ACCESS_REVOKED + invitation PENDING;
    // only explicit acceptance flips it to ACTIVE.
    const member = await this.tenantMemberRepo.create({
      userId,
      tenantId,
      role,
      status: MemberStatus.ACCESS_REVOKED,
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
    return this.updateMember(requesterId, tenantId, userId, { role });
  }

  /**
   * DEC-055: full member update — role, expiration date and the underlying
   * user's profile (display name / email). Only provided fields are applied.
   * Setting an expiration on (or changing the role of) the workspace OWNER is
   * forbidden. Returns the enriched member so callers can refresh their rows.
   */
  async updateMember(
    requesterId: string,
    tenantId: string,
    userId: string,
    patch: { role?: string; expiresAt?: string | null; name?: string; email?: string },
  ): Promise<TenantMember> {
    const requesterMembership = await this.requireMembership(requesterId, tenantId);

    if (requesterMembership.role !== TenantRole.OWNER && requesterMembership.role !== TenantRole.ADMIN) {
      throw new ForbiddenError('Only owner or admin can update members');
    }

    const target = await this.requireMembershipByUserId(userId, tenantId);

    if (target.role === TenantRole.OWNER) {
      if (patch.expiresAt !== undefined) {
        throw new ForbiddenError('Cannot set an expiration date on the workspace owner');
      }

      if (patch.role !== undefined && patch.role !== target.role) {
        throw new ForbiddenError("Cannot change the owner's role");
      }
    }

    // Profile updates go to the underlying USER record
    if (patch.name !== undefined || patch.email !== undefined) {
      const user = await this.userRepo.findById(target.userId);

      if (!user) {
        throw new NotFoundError('User not found');
      }

      if (patch.email !== undefined && patch.email !== user.email) {
        const existing = await this.userRepo.findByEmail(patch.email);

        if (existing && existing.id !== user.id) {
          throw new ConflictError('A user with this email already exists');
        }
      }

      await this.userRepo.updateProfile(user.id, {
        ...(patch.name !== undefined ? { displayName: patch.name } : {}),
        ...(patch.email !== undefined ? { email: patch.email } : {}),
      });
    }

    const memberPatch: { role?: string; expiresAt?: Date | null } = {};

    if (patch.role !== undefined) memberPatch.role = patch.role;
    if (patch.expiresAt !== undefined)
      memberPatch.expiresAt = patch.expiresAt === null ? null : new Date(patch.expiresAt);

    let updated = target;

    if (Object.keys(memberPatch).length > 0) {
      updated = (await this.tenantMemberRepo.update(target.id, memberPatch)) ?? target;
    }

    // Return the enriched member (fresh profile after possible name/email change)
    const freshUser = await this.userRepo.findById(updated.userId);

    return { ...updated, displayName: freshUser?.displayName ?? null, email: freshUser?.email ?? null };
  }

  async removeMember(
    requesterId: string,
    tenantId: string,
    userId: string,
    precheckedMembership?: TenantMember,
  ): Promise<void> {
    const requesterMembership = await this.requireMembership(requesterId, tenantId, precheckedMembership);

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

  async acceptInvitation(memberId: string, userId: string): Promise<void> {
    const member = await this.tenantMemberRepo.findById(memberId);

    if (!member) {
      throw new NotFoundError('Invitation not found');
    }

    if (!member.invitation || member.invitation.status !== InvitationStatus.PENDING) {
      throw new NotFoundError('Invitation is no longer pending');
    }

    // M-01 (IDOR guard, mirrors declineInvitation): only the invitee may accept
    if (member.userId !== userId) {
      throw new ForbiddenError('You can only accept your own invitations');
    }

    // Check TTL expiration — membership stays ACCESS_REVOKED (DEC-018); only the invitation flips to EXPIRED
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
      expiresAt: null, // DEC-055: a fresh acceptance never starts expired
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

  /**
   * V2-7: all member-scoped lifecycle operations address the target by
   * **userId** (consistent with invite / update-role / remove), resolving the
   * membership document internally via findByUserAndTenant.
   */
  private async requireMembershipByUserId(userId: string, tenantId: string): Promise<TenantMember> {
    const member = await this.tenantMemberRepo.findByUserAndTenant(userId, tenantId);

    if (!member) {
      throw new NotFoundError('Member not found in this tenant');
    }

    return member;
  }

  async revokeInvitation(requesterId: string, tenantId: string, userId: string): Promise<void> {
    const requesterMembership = await this.requireMembership(requesterId, tenantId);

    if (requesterMembership.role !== TenantRole.OWNER && requesterMembership.role !== TenantRole.ADMIN) {
      throw new ForbiddenError('Only owner or admin can revoke invitations');
    }

    const member = await this.requireMembershipByUserId(userId, tenantId);

    if (!member.invitation || member.invitation.status !== InvitationStatus.PENDING) {
      throw new ConflictError('Invitation is no longer pending');
    }

    await this.tenantMemberRepo.update(member.id, {
      invitation: {
        ...member.invitation,
        status: InvitationStatus.REVOKED,
        invitedOn: new Date(member.invitation.invitedOn),
      },
    });
  }

  async reinviteUser(
    requesterId: string,
    tenantId: string,
    userId: string,
    precheckedMembership?: TenantMember,
  ): Promise<void> {
    const requesterMembership = await this.requireMembership(requesterId, tenantId, precheckedMembership);

    if (requesterMembership.role !== TenantRole.OWNER && requesterMembership.role !== TenantRole.ADMIN) {
      throw new ForbiddenError('Only owner or admin can reinvite users');
    }

    const member = await this.requireMembershipByUserId(userId, tenantId);
    // Generate new token
    const token = randomUUID();
    const tokenHash = hashToken(token);
    const user = await this.userRepo.findById(member.userId);
    const invitationDoc: InvitationDocument = {
      status: InvitationStatus.PENDING,
      tokenHash,
      invitedBy: requesterId,
      invitedOn: new Date(),
      invitedEmail: user?.email.toLowerCase().trim() ?? null,
    };

    // DEC-018 invariant: a membership with a PENDING invitation is never ACTIVE
    await this.tenantMemberRepo.update(member.id, { status: MemberStatus.ACCESS_REVOKED, invitation: invitationDoc });

    // Send email
    try {
      const freshUser = await this.userRepo.findById(member.userId);
      const tenant = await this.requireActiveTenant(tenantId);
      const inviter = await this.userRepo.findById(requesterId);

      if (freshUser) {
        await this.emailService.sendInvitationEmail({
          to: freshUser.email,
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

  async restoreMembership(
    requesterId: string,
    tenantId: string,
    userId: string,
    precheckedMembership?: TenantMember,
  ): Promise<void> {
    const requesterMembership = await this.requireMembership(requesterId, tenantId, precheckedMembership);

    if (requesterMembership.role !== TenantRole.OWNER && requesterMembership.role !== TenantRole.ADMIN) {
      throw new ForbiddenError('Only owner or admin can restore memberships');
    }

    const member = await this.requireMembershipByUserId(userId, tenantId);

    // DEC-055: an ACTIVE membership past its expiration is effectively revoked too
    if (member.status !== MemberStatus.ACCESS_REVOKED && !isMembershipExpired(member)) {
      throw new ConflictError('Only ACCESS_REVOKED memberships can be restored');
    }

    // BR-036 / DEC-018: a pending invitation can only be activated by the invitee's explicit acceptance
    if (member.invitation?.status === InvitationStatus.PENDING) {
      throw new ConflictError('Cannot restore a membership with a pending invitation — the invitee must accept it');
    }

    // DEC-055: restoring clears the expiration — access is regained with all
    // projects/roles intact (nothing was ever removed).
    await this.tenantMemberRepo.update(member.id, { status: MemberStatus.ACTIVE, expiresAt: null });
  }

  async revokeAccess(
    requesterId: string,
    tenantId: string,
    userId: string,
    precheckedMembership?: TenantMember,
  ): Promise<void> {
    const requesterMembership = await this.requireMembership(requesterId, tenantId, precheckedMembership);

    if (requesterMembership.role !== TenantRole.OWNER && requesterMembership.role !== TenantRole.ADMIN) {
      throw new ForbiddenError('Only owner or admin can revoke access');
    }

    const membership = await this.requireMembershipByUserId(userId, tenantId);

    if (membership.role === TenantRole.OWNER) {
      throw new ForbiddenError("Cannot revoke the owner's access");
    }

    await this.tenantMemberRepo.update(membership.id, { status: MemberStatus.ACCESS_REVOKED });
  }

  async hardDeleteMember(
    requesterId: string,
    tenantId: string,
    userId: string,
    precheckedMembership?: TenantMember,
  ): Promise<void> {
    const requesterMembership = await this.requireMembership(requesterId, tenantId, precheckedMembership);

    if (requesterMembership.role !== TenantRole.OWNER && requesterMembership.role !== TenantRole.ADMIN) {
      throw new ForbiddenError('Only owner or admin can permanently remove members');
    }

    const membership = await this.requireMembershipByUserId(userId, tenantId);

    if (membership.role === TenantRole.OWNER) {
      throw new ForbiddenError('Cannot permanently remove the owner');
    }

    await this.tenantMemberRepo.deleteById(membership.id);
  }

  async getMyInvitations(email: string): Promise<MyInvitation[]> {
    const memberships = await this.tenantMemberRepo.findPendingByEmail(email);
    // Batch lookups (N+1 fix): one `$in` query per collection instead of
    // per-invitation user/tenant fetches
    const userIds = [...new Set(memberships.map((doc) => doc.userId).filter((id): id is string => Boolean(id)))];
    const tenantIds = [...new Set(memberships.map((doc) => doc.tenantId))];
    const [users, tenants] = await Promise.all([
      this.userRepo.findByIds(userIds),
      this.tenantRepo.findByIds(tenantIds),
    ]);
    const userById = new Map(users.map((u) => [u.id, u]));
    const tenantById = new Map(tenants.map((t) => [t.id, t]));
    const enriched: MyInvitation[] = [];

    for (const doc of memberships) {
      const user = doc.userId ? (userById.get(doc.userId) ?? null) : null;
      const tenant = tenantById.get(doc.tenantId);

      // MyInvitationSchema is the single source of truth (N-03): parsing the
      // raw document both validates the enum fields coming out of MongoDB and
      // yields the schema-inferred domain type — no casts needed.
      enriched.push(
        MyInvitationSchema.parse({
          tenantName: tenant?.name ?? '',
          id: doc.id,
          tenantId: doc.tenantId,
          userId: doc.userId,
          role: doc.role,
          status: doc.status,
          expiresAt: doc.expiresAt ? doc.expiresAt.toISOString() : null,
          invitation: doc.invitation
            ? {
                status: doc.invitation.status,
                tokenHash: doc.invitation.tokenHash,
                invitedBy: doc.invitation.invitedBy,
                invitedOn: doc.invitation.invitedOn.toISOString(),
              }
            : null,
          displayName: user?.displayName ?? null,
          email: user?.email ?? null,
          createdAt: doc.createdAt.toISOString(),
          updatedAt: doc.updatedAt.toISOString(),
        }),
      );
    }
    return enriched;
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private async requireActiveTenant(tenantId: string): Promise<Tenant> {
    const tenant = await this.tenantRepo.findById(tenantId);

    if (!tenant) {
      throw new NotFoundError('Tenant not found');
    }

    if (tenant.status === TenantStatus.ARCHIVED) {
      throw new AppError(409, 'TENANT_ARCHIVED', 'Tenant is archived and cannot be modified');
    }
    return tenant;
  }

  /**
   * `precheckedMembership`: the membership already resolved by the
   * tenant-context middleware for THIS request (same user + tenant, ACTIVE,
   * not expired — the middleware enforces all of that). When provided and
   * matching, the repeated `findOne` is skipped.
   */
  private async requireMembership(
    userId: string,
    tenantId: string,
    precheckedMembership?: TenantMember,
  ): Promise<TenantMember> {
    if (precheckedMembership && precheckedMembership.userId === userId && precheckedMembership.tenantId === tenantId) {
      return precheckedMembership;
    }

    const membership = await this.tenantMemberRepo.findByUserAndTenant(userId, tenantId);

    if (!membership) {
      throw new ForbiddenError('You are not a member of this tenant');
    }

    // DEC-055 lazy revoke: an ACTIVE membership past its expiration denies
    // access; the stored status is flipped when observed (no cron on Workers).
    if (membership.status === MemberStatus.ACTIVE && isMembershipExpired(membership)) {
      await this.tenantMemberRepo.update(membership.id, { status: MemberStatus.ACCESS_REVOKED });
      throw new ForbiddenError('Your membership has expired');
    }

    if (membership.status !== MemberStatus.ACTIVE) {
      throw new ForbiddenError('You are not a member of this tenant');
    }
    return membership;
  }
}
