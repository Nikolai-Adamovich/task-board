import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TenantService } from './tenant.service.js';

// ─── Mock Factories ──────────────────────────────────────────────────────────

function createMockTenantRepo() {
  return {
    findById: vi.fn(),
    findBySlug: vi.fn(),
    findAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
}

function createMockTenantMemberRepo() {
  return {
    findByUserAndTenant: vi.fn(),
    findByTenant: vi.fn(),
    findByUser: vi.fn(),
    create: vi.fn(),
    updateRole: vi.fn(),
    delete: vi.fn(),
  };
}

function createMockUserRepo() {
  return {
    findById: vi.fn(),
    findByEmail: vi.fn(),
    create: vi.fn(),
  };
}

const NOW = '2025-01-01T00:00:00.000Z';

function makeTenant(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tenant-1',
    name: 'Test Workspace',
    slug: 'test-workspace',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeMember(overrides: Record<string, unknown> = {}) {
  return {
    userId: 'user-1',
    tenantId: 'tenant-1',
    role: 'owner',
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('TenantService', () => {
  let tenantRepo: ReturnType<typeof createMockTenantRepo>;
  let memberRepo: ReturnType<typeof createMockTenantMemberRepo>;
  let userRepo: ReturnType<typeof createMockUserRepo>;
  let service: TenantService;

  beforeEach(() => {
    tenantRepo = createMockTenantRepo();
    memberRepo = createMockTenantMemberRepo();
    userRepo = createMockUserRepo();
    service = new TenantService(tenantRepo as never, memberRepo as never, userRepo as never);
  });

  // ── createTenant ────────────────────────────────────────────────────────

  describe('createTenant', () => {
    it('creates a tenant and adds the user as owner', async () => {
      tenantRepo.findBySlug.mockResolvedValue(null);
      tenantRepo.create.mockResolvedValue(makeTenant());
      memberRepo.create.mockResolvedValue(makeMember());

      const result = await service.createTenant('user-1', {
        name: 'Test Workspace',
        slug: 'test-workspace',
      });

      expect(tenantRepo.create).toHaveBeenCalledWith({
        name: 'Test Workspace',
        slug: 'test-workspace',
      });
      expect(memberRepo.create).toHaveBeenCalledWith({
        userId: 'user-1',
        tenantId: 'tenant-1',
        role: 'owner',
      });
      expect(result.name).toBe('Test Workspace');
    });

    it('throws ConflictError when slug is already taken', async () => {
      tenantRepo.findBySlug.mockResolvedValue(makeTenant());

      await expect(service.createTenant('user-1', { name: 'X', slug: 'test-workspace' })).rejects.toThrow(
        'already exists',
      );
    });
  });

  // ── listTenantsForUser ──────────────────────────────────────────────────

  describe('listTenantsForUser', () => {
    it('returns all tenants the user is a member of', async () => {
      memberRepo.findByUser.mockResolvedValue([
        makeMember({ tenantId: 't1' }),
        makeMember({ tenantId: 't2', role: 'member' }),
      ]);
      tenantRepo.findById
        .mockResolvedValueOnce(makeTenant({ id: 't1', name: 'Tenant 1' }))
        .mockResolvedValueOnce(makeTenant({ id: 't2', name: 'Tenant 2' }));

      const result = await service.listTenantsForUser('user-1');

      expect(result).toHaveLength(2);
      expect(result[0]!.name).toBe('Tenant 1');
      expect(result[1]!.name).toBe('Tenant 2');
    });

    it('returns empty array when user has no memberships', async () => {
      memberRepo.findByUser.mockResolvedValue([]);

      const result = await service.listTenantsForUser('user-1');
      expect(result).toEqual([]);
    });
  });

  // ── getTenant ───────────────────────────────────────────────────────────

  describe('getTenant', () => {
    it('returns the tenant', async () => {
      tenantRepo.findById.mockResolvedValue(makeTenant());

      const result = await service.getTenant('tenant-1');
      expect(result.id).toBe('tenant-1');
    });

    it('throws NotFoundError when tenant does not exist', async () => {
      tenantRepo.findById.mockResolvedValue(null);

      await expect(service.getTenant('missing')).rejects.toThrow('not found');
    });
  });

  // ── updateTenant ────────────────────────────────────────────────────────

  describe('updateTenant', () => {
    it('allows owner to update tenant', async () => {
      memberRepo.findByUserAndTenant.mockResolvedValue(makeMember({ role: 'owner' }));
      tenantRepo.update.mockResolvedValue(makeTenant({ name: 'Updated' }));

      const result = await service.updateTenant('user-1', 'tenant-1', {
        name: 'Updated',
      });

      expect(result.name).toBe('Updated');
    });

    it('allows admin to update tenant', async () => {
      memberRepo.findByUserAndTenant.mockResolvedValue(makeMember({ role: 'admin' }));
      tenantRepo.update.mockResolvedValue(makeTenant({ name: 'Updated' }));

      const result = await service.updateTenant('user-2', 'tenant-1', {
        name: 'Updated',
      });
      expect(result.name).toBe('Updated');
    });

    it('throws ForbiddenError for regular members', async () => {
      memberRepo.findByUserAndTenant.mockResolvedValue(makeMember({ role: 'member' }));

      await expect(service.updateTenant('user-3', 'tenant-1', { name: 'X' })).rejects.toThrow('Only owner or admin');
    });

    it('throws ConflictError when slug is taken by another tenant', async () => {
      memberRepo.findByUserAndTenant.mockResolvedValue(makeMember({ role: 'owner' }));
      tenantRepo.findBySlug.mockResolvedValue(makeTenant({ id: 'other-tenant' }));

      await expect(service.updateTenant('user-1', 'tenant-1', { slug: 'taken-slug' })).rejects.toThrow(
        'already exists',
      );
    });
  });

  // ── deleteTenant ────────────────────────────────────────────────────────

  describe('deleteTenant', () => {
    it('allows owner to delete tenant and cleans up memberships', async () => {
      memberRepo.findByUserAndTenant.mockResolvedValue(makeMember({ role: 'owner' }));
      tenantRepo.delete.mockResolvedValue(true);
      memberRepo.findByTenant.mockResolvedValue([makeMember(), makeMember({ userId: 'user-2', role: 'member' })]);
      memberRepo.delete.mockResolvedValue(true);

      await service.deleteTenant('user-1', 'tenant-1');

      expect(tenantRepo.delete).toHaveBeenCalledWith('tenant-1');
      expect(memberRepo.delete).toHaveBeenCalledTimes(2);
    });

    it('throws ForbiddenError for non-owners', async () => {
      memberRepo.findByUserAndTenant.mockResolvedValue(makeMember({ role: 'admin' }));

      await expect(service.deleteTenant('user-2', 'tenant-1')).rejects.toThrow('Only the owner');
    });
  });

  // ── inviteMember ────────────────────────────────────────────────────────

  describe('inviteMember', () => {
    it('adds a member when requester is owner', async () => {
      memberRepo.findByUserAndTenant
        .mockResolvedValueOnce(makeMember({ role: 'owner' })) // first call: requester check
        .mockResolvedValueOnce(null); // second call: existing member check
      userRepo.findByEmail.mockResolvedValue({
        id: 'user-2',
        email: 'invited@example.com',
      });
      memberRepo.create.mockResolvedValue(makeMember({ userId: 'user-2', role: 'member' }));

      const result = await service.inviteMember('user-1', 'tenant-1', 'invited@example.com', 'member');

      expect(result.userId).toBe('user-2');
      expect(userRepo.findByEmail).toHaveBeenCalledWith('invited@example.com');
    });

    it('throws NotFoundError when invited user does not exist', async () => {
      memberRepo.findByUserAndTenant.mockResolvedValue(makeMember({ role: 'owner' }));
      userRepo.findByEmail.mockResolvedValue(null);

      await expect(service.inviteMember('user-1', 'tenant-1', 'noone@example.com', 'member')).rejects.toThrow(
        'not found',
      );
    });

    it('throws ConflictError when user is already a member', async () => {
      memberRepo.findByUserAndTenant
        .mockResolvedValueOnce(makeMember({ role: 'owner' })) // requester check
        .mockResolvedValueOnce(makeMember({ userId: 'user-2' })); // already member
      userRepo.findByEmail.mockResolvedValue({ id: 'user-2', email: 'x@y.com' });

      await expect(service.inviteMember('user-1', 'tenant-1', 'x@y.com', 'member')).rejects.toThrow('already a member');
    });
  });

  // ── updateMemberRole ────────────────────────────────────────────────────

  describe('updateMemberRole', () => {
    it('updates the role when requester is admin', async () => {
      memberRepo.findByUserAndTenant
        .mockResolvedValueOnce(makeMember({ role: 'admin' })) // requester
        .mockResolvedValueOnce(makeMember({ userId: 'user-2', role: 'member' })); // target
      memberRepo.updateRole.mockResolvedValue(makeMember({ userId: 'user-2', role: 'admin' }));

      const result = await service.updateMemberRole('user-1', 'tenant-1', 'user-2', 'admin');
      expect(result.role).toBe('admin');
    });

    it('throws ForbiddenError when trying to change the owner role', async () => {
      memberRepo.findByUserAndTenant
        .mockResolvedValueOnce(makeMember({ role: 'admin' })) // requester
        .mockResolvedValueOnce(makeMember({ userId: 'owner-1', role: 'owner' })); // target is owner

      await expect(service.updateMemberRole('user-1', 'tenant-1', 'owner-1', 'member')).rejects.toThrow("owner's role");
    });
  });

  // ── removeMember ────────────────────────────────────────────────────────

  describe('removeMember', () => {
    it('removes the member when requester is admin', async () => {
      memberRepo.findByUserAndTenant
        .mockResolvedValueOnce(makeMember({ role: 'admin' })) // requester
        .mockResolvedValueOnce(makeMember({ userId: 'user-2', role: 'member' })); // target
      memberRepo.delete.mockResolvedValue(true);

      await service.removeMember('user-1', 'tenant-1', 'user-2');

      expect(memberRepo.delete).toHaveBeenCalledWith('tenant-1', 'user-2');
    });

    it('throws ForbiddenError when trying to remove the owner', async () => {
      memberRepo.findByUserAndTenant
        .mockResolvedValueOnce(makeMember({ role: 'admin' })) // requester
        .mockResolvedValueOnce(makeMember({ userId: 'owner-1', role: 'owner' })); // target is owner

      await expect(service.removeMember('user-1', 'tenant-1', 'owner-1')).rejects.toThrow('owner');
    });
  });

  // ── getTenantMembers ────────────────────────────────────────────────────

  describe('getTenantMembers', () => {
    it('returns all members for a tenant', async () => {
      memberRepo.findByTenant.mockResolvedValue([makeMember(), makeMember({ userId: 'user-2', role: 'member' })]);

      const result = await service.getTenantMembers('tenant-1');
      expect(result).toHaveLength(2);
    });
  });
});
