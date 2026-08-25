import { MemberStatus, TenantRole, TenantStatus, ProjectStatus, ArchiveReason } from '@task-board/shared';
import type { Tenant, TenantMember, CreateTenant, UpdateTenant } from '@task-board/shared';
import { AppError, ForbiddenError, NotFoundError } from '../errors/app-error.js';
import { TenantRepository } from '../repositories/tenant.repository.js';
import { TenantMemberRepository } from '../repositories/tenant-member.repository.js';
import { UserRepository } from '../repositories/user.repository.js';
import type { AuditService } from './audit.service.js';

/** Minimal project repository interface for tenant cascade operations */
export interface TenantServiceProjectRepo {
  findByTenant(tenantId: string): Promise<{ id: string; status: string; archiveReason: string | null }[]>;
  update(id: string, data: Record<string, unknown>): Promise<unknown>;
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** Grace period before permanent deletion (30 days) */
const DELETION_GRACE_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;
// ─── Tenant Service ──────────────────────────────────────────────────────────

export class TenantService {
  constructor(
    private readonly tenantRepo: TenantRepository,
    private readonly tenantMemberRepo: TenantMemberRepository,
    private readonly userRepo: UserRepository,
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
        if (project.status !== ProjectStatus.ARCHIVED) {
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
        if (project.status === ProjectStatus.ARCHIVED && project.archiveReason === ArchiveReason.TENANT_ARCHIVE) {
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
