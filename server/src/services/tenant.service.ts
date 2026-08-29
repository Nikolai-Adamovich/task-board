import {
  MemberStatus,
  TenantRole,
  TenantStatus,
  ProjectStatus,
  ArchiveReason,
  generateSlugFromName,
  isValidTenantSlug,
  DELETION_GRACE_PERIOD_MS,
} from '@task-board/shared';
import type { Tenant, TenantMember, CreateTenant, UpdateTenant } from '@task-board/shared';
import { AppError, ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../errors/app-error.js';
import { TenantRepository } from '../repositories/tenant.repository.js';
import { TenantMemberRepository } from '../repositories/tenant-member.repository.js';
import { UserRepository } from '../repositories/user.repository.js';
import type { AuditService } from './audit.service.js';

/** Minimal project repository interface for tenant cascade operations */
export interface TenantServiceProjectRepo {
  findByTenant(tenantId: string): Promise<{ id: string; status: string; archiveReason: string | null }[]>;
  update(id: string, data: Record<string, unknown>): Promise<unknown>;
}

/** Minimal project-member repository interface for user-deletion cleanup */
export interface TenantServiceProjectMemberRepo {
  deleteByUserId(userId: string): Promise<void>;
}

// ─── Tenant Service ──────────────────────────────────────────────────────────

export class TenantService {
  constructor(
    private readonly tenantRepo: TenantRepository,
    private readonly tenantMemberRepo: TenantMemberRepository,
    private readonly userRepo: UserRepository,
    private readonly projectRepo?: TenantServiceProjectRepo,
    private readonly auditService?: AuditService,
    private readonly projectMemberRepo?: TenantServiceProjectMemberRepo,
  ) {}

  // ─── Tenant CRUD ──────────────────────────────────────────────────────────

  async createTenant(userId: string, input: CreateTenant): Promise<Tenant> {
    const slug = await this.resolveSlugForCreate(input);
    const tenant = await this.tenantRepo.create({ ...input, slug });

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
    const tenantIds = memberships.filter((m) => m.status === MemberStatus.ACTIVE).map((m) => m.tenantId);
    // Batch lookup (N+1 fix): one `$in` query instead of one `findById` per membership
    const tenants = await this.tenantRepo.findByIds(tenantIds);
    const tenantById = new Map(tenants.map((t) => [t.id, t]));

    // Preserve membership order
    return tenantIds.map((id) => tenantById.get(id)).filter((t): t is Tenant => t !== undefined);
  }

  async listTenantsWithRole(userId: string): Promise<(Tenant & { role: string })[]> {
    const memberships = await this.tenantMemberRepo.findByUser(userId);
    const active = memberships.filter((m) => m.status === MemberStatus.ACTIVE);
    // Batch lookup (N+1 fix): one `$in` query instead of one `findById` per membership
    const tenants = await this.tenantRepo.findByIds(active.map((m) => m.tenantId));
    const tenantById = new Map(tenants.map((t) => [t.id, t]));

    return active
      .map((m) => {
        const tenant = tenantById.get(m.tenantId);

        return tenant ? { ...tenant, role: m.role } : undefined;
      })
      .filter((t) => t !== undefined);
  }

  async getTenant(id: string): Promise<Tenant> {
    const tenant = await this.tenantRepo.findById(id);

    if (!tenant) {
      throw new NotFoundError('Tenant not found');
    }
    return tenant;
  }

  /**
   * Get a tenant for a specific requester — verifies membership first.
   * IDOR guard: `GET /tenants/:tenantId` must not expose arbitrary tenants
   * to any authenticated user.
   */
  async getTenantForUser(userId: string, id: string): Promise<Tenant> {
    await this.requireMembership(userId, id);

    return this.getTenant(id);
  }

  /**
   * Check slug availability for the create-workspace form (DEC-032).
   *
   * Enumeration-safe: invalid slugs simply report as unavailable, without
   * distinguishing "invalid format" from "already taken".
   */
  async isSlugAvailable(slug: string): Promise<boolean> {
    if (!isValidTenantSlug(slug)) {
      return false;
    }

    return !(await this.tenantRepo.slugExists(slug));
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
   * Soft-delete a user (DEC-019).
   *
   * The requester must be an ACTIVE OWNER or ADMIN of at least one tenant that
   * the target user belongs to — cross-tenant deletion is rejected. On success
   * the user is soft-deleted AND all their live tenant/project memberships are
   * removed. Identity snapshots on tasks/comments remain untouched.
   */
  async deleteUser(requesterId: string, userId: string): Promise<void> {
    const targetUser = await this.userRepo.findById(userId);

    if (!targetUser) {
      throw new NotFoundError('User not found');
    }

    // Cannot delete yourself
    if (requesterId === userId) {
      throw new ForbiddenError('Cannot delete your own account');
    }

    // Requester must be OWNER/ADMIN of a tenant shared with the target user
    const targetMemberships = await this.tenantMemberRepo.findByUser(userId);
    let isAuthorized = false;

    for (const membership of targetMemberships) {
      const requesterMembership = await this.tenantMemberRepo.findByUserAndTenant(requesterId, membership.tenantId);

      if (
        requesterMembership &&
        requesterMembership.status === MemberStatus.ACTIVE &&
        (requesterMembership.role === TenantRole.OWNER || requesterMembership.role === TenantRole.ADMIN)
      ) {
        isAuthorized = true;
        break;
      }
    }

    if (!isAuthorized) {
      throw new ForbiddenError('Only an owner or admin of the same tenant can delete a user');
    }

    // Soft-delete the user
    await this.userRepo.softDelete(userId);

    // Remove live memberships (snapshots elsewhere stay untouched)
    await this.tenantMemberRepo.deleteByUserId(userId);

    if (this.projectMemberRepo) {
      await this.projectMemberRepo.deleteByUserId(userId);
    }
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  /**
   * Resolve the slug for a new tenant (DEC-032).
   *
   * - User-supplied slug: validated against shape/length rules, then checked
   *   for global uniqueness.
   * - Omitted slug: generated from the tenant name, then checked for global
   *   uniqueness (the create-workspace form offers a live availability check,
   *   so collisions surface as an explicit SLUG_TAKEN conflict).
   */
  private async resolveSlugForCreate(input: CreateTenant): Promise<string> {
    if (input.slug !== undefined) {
      if (!isValidTenantSlug(input.slug)) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Slug must be 2-48 characters of lowercase letters, numbers, and hyphens, without leading/trailing hyphens',
        );
      }

      if (await this.tenantRepo.slugExists(input.slug)) {
        throw new ConflictError(`Slug "${input.slug}" is already taken`, 'SLUG_TAKEN');
      }

      return input.slug;
    }

    const generated = generateSlugFromName(input.name);

    // V4-6: a name that yields an empty/invalid slug is a validation failure
    // (400 VALIDATION_ERROR), not a conflict — the UI maps it to a field error.
    if (!isValidTenantSlug(generated)) {
      throw new ValidationError('Workspace name must contain letters or numbers');
    }

    if (await this.tenantRepo.slugExists(generated)) {
      throw new ConflictError(`Generated slug "${generated}" is already taken`, 'SLUG_TAKEN');
    }

    return generated;
  }

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
