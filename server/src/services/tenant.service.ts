import type { Tenant, TenantMember, CreateTenant, UpdateTenant } from '@task-board/shared';
import { ConflictError, ForbiddenError, NotFoundError } from '../middleware/error-handler.js';
import { TenantRepository } from '../repositories/tenant.repository.js';
import { TenantMemberRepository } from '../repositories/tenant-member.repository.js';
import { UserRepository } from '../repositories/user.repository.js';

// ─── Tenant Service ──────────────────────────────────────────────────────────

export class TenantService {
  constructor(
    private readonly tenantRepo: TenantRepository,
    private readonly tenantMemberRepo: TenantMemberRepository,
    private readonly userRepo: UserRepository,
  ) {}

  /**
   * Create a new tenant and add the creating user as owner.
   */
  async createTenant(userId: string, input: CreateTenant): Promise<Tenant> {
    // Check slug uniqueness
    const existing = await this.tenantRepo.findBySlug(input.slug);

    if (existing) {
      throw new ConflictError(`Tenant with slug "${input.slug}" already exists`);
    }

    const tenant = await this.tenantRepo.create(input);

    // Add the creator as owner
    await this.tenantMemberRepo.create({
      userId,
      tenantId: tenant.id,
      role: 'owner',
    });

    return tenant;
  }

  /**
   * List all tenants where the user is a member.
   */
  async listTenantsForUser(userId: string): Promise<Tenant[]> {
    const memberships = await this.tenantMemberRepo.findByUser(userId);
    const tenants: Tenant[] = [];

    for (const membership of memberships) {
      const tenant = await this.tenantRepo.findById(membership.tenantId);

      if (tenant) {
        tenants.push(tenant);
      }
    }

    return tenants;
  }

  /**
   * Get a tenant by ID.
   */
  async getTenant(id: string): Promise<Tenant> {
    const tenant = await this.tenantRepo.findById(id);

    if (!tenant) {
      throw new NotFoundError('Tenant not found');
    }
    return tenant;
  }

  /**
   * Update a tenant. Only owner or admin can update.
   */
  async updateTenant(userId: string, id: string, input: UpdateTenant): Promise<Tenant> {
    const membership = await this.requireMembership(userId, id);

    if (membership.role !== 'owner' && membership.role !== 'admin') {
      throw new ForbiddenError('Only owner or admin can update the tenant');
    }

    // Check slug uniqueness if slug is being changed
    if (input.slug) {
      const existing = await this.tenantRepo.findBySlug(input.slug);

      if (existing && existing.id !== id) {
        throw new ConflictError(`Tenant with slug "${input.slug}" already exists`);
      }
    }

    const tenant = await this.tenantRepo.update(id, input);

    if (!tenant) {
      throw new NotFoundError('Tenant not found');
    }

    return tenant;
  }

  /**
   * Delete a tenant. Only owner can delete.
   */
  async deleteTenant(userId: string, id: string): Promise<void> {
    const membership = await this.requireMembership(userId, id);

    if (membership.role !== 'owner') {
      throw new ForbiddenError('Only the owner can delete the tenant');
    }

    const deleted = await this.tenantRepo.delete(id);

    if (!deleted) {
      throw new NotFoundError('Tenant not found');
    }

    // Clean up all memberships for this tenant
    const members = await this.tenantMemberRepo.findByTenant(id);

    for (const member of members) {
      await this.tenantMemberRepo.delete(id, member.userId);
    }
  }

  // ─── Member Management ─────────────────────────────────────────────────────

  /**
   * Invite (add) a member to a tenant by email.
   * Only owner or admin can invite.
   */
  async inviteMember(requesterId: string, tenantId: string, email: string, role: string): Promise<TenantMember> {
    const requesterMembership = await this.requireMembership(requesterId, tenantId);

    if (requesterMembership.role !== 'owner' && requesterMembership.role !== 'admin') {
      throw new ForbiddenError('Only owner or admin can invite members');
    }

    // Find the user by email
    const user = await this.userRepo.findByEmail(email);

    if (!user) {
      throw new NotFoundError(`User with email "${email}" not found`);
    }

    // Check if already a member
    const existing = await this.tenantMemberRepo.findByUserAndTenant(user.id, tenantId);

    if (existing) {
      throw new ConflictError('User is already a member of this tenant');
    }

    return this.tenantMemberRepo.create({
      userId: user.id,
      tenantId,
      role,
    });
  }

  /**
   * Update a member's role. Only owner or admin can update roles.
   */
  async updateMemberRole(requesterId: string, tenantId: string, userId: string, role: string): Promise<TenantMember> {
    const requesterMembership = await this.requireMembership(requesterId, tenantId);

    if (requesterMembership.role !== 'owner' && requesterMembership.role !== 'admin') {
      throw new ForbiddenError('Only owner or admin can update member roles');
    }

    // Cannot change the owner's role
    const targetMembership = await this.requireMembership(userId, tenantId);

    if (targetMembership.role === 'owner') {
      throw new ForbiddenError("Cannot change the owner's role");
    }

    const updated = await this.tenantMemberRepo.updateRole(tenantId, userId, role);

    if (!updated) {
      throw new NotFoundError('Member not found');
    }

    return updated;
  }

  /**
   * Remove a member from a tenant. Only owner or admin can remove members.
   * Cannot remove the owner.
   */
  async removeMember(requesterId: string, tenantId: string, userId: string): Promise<void> {
    const requesterMembership = await this.requireMembership(requesterId, tenantId);

    if (requesterMembership.role !== 'owner' && requesterMembership.role !== 'admin') {
      throw new ForbiddenError('Only owner or admin can remove members');
    }

    // Cannot remove the owner
    const targetMembership = await this.requireMembership(userId, tenantId);

    if (targetMembership.role === 'owner') {
      throw new ForbiddenError('Cannot remove the owner from the tenant');
    }

    await this.tenantMemberRepo.delete(tenantId, userId);
  }

  /**
   * List all members of a tenant.
   */
  async getTenantMembers(tenantId: string): Promise<TenantMember[]> {
    return this.tenantMemberRepo.findByTenant(tenantId);
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private async requireMembership(userId: string, tenantId: string): Promise<TenantMember> {
    const membership = await this.tenantMemberRepo.findByUserAndTenant(userId, tenantId);

    if (!membership) {
      throw new ForbiddenError('You are not a member of this tenant');
    }
    return membership;
  }
}
