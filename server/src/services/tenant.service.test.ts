import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TenantService } from './tenant.service.js';

// ─── Mock Factories ──────────────────────────────────────────────────────────

function createMockTenantRepo() {
  return {
    findById: vi.fn(),
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
    findByInvitedEmailAndTenant: vi.fn(),
    findByInvitationToken: vi.fn(),
    findPendingByEmail: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateRole: vi.fn(),
    delete: vi.fn(),
    deleteById: vi.fn(),
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
    description: null,
    status: 'ACTIVE',
    deletionScheduledAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeMember(overrides: Record<string, unknown> = {}) {
  return {
    id: 'member-1',
    userId: 'user-1',
    tenantId: 'tenant-1',
    role: 'OWNER',
    status: 'ACTIVE',
    invitation: null,
    displayName: null,
    email: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function createMockEmailService() {
  return {
    sendInvitationEmail: vi.fn().mockResolvedValue(undefined),
    sendEmail: vi.fn().mockResolvedValue(undefined),
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('TenantService', () => {
  let tenantRepo: ReturnType<typeof createMockTenantRepo>;
  let memberRepo: ReturnType<typeof createMockTenantMemberRepo>;
  let userRepo: ReturnType<typeof createMockUserRepo>;
  let emailService: ReturnType<typeof createMockEmailService>;
  let service: TenantService;

  beforeEach(() => {
    tenantRepo = createMockTenantRepo();
    memberRepo = createMockTenantMemberRepo();
    userRepo = createMockUserRepo();
    emailService = createMockEmailService();
    service = new TenantService(tenantRepo as never, memberRepo as never, userRepo as never, emailService as never);
  });

  // ── createTenant ────────────────────────────────────────────────────────

  describe('createTenant', () => {
    it('creates a tenant with ACTIVE status and adds the user as owner', async () => {
      tenantRepo.create.mockResolvedValue(makeTenant());
      memberRepo.create.mockResolvedValue(makeMember());

      const result = await service.createTenant('user-1', { name: 'Test Workspace' });

      expect(tenantRepo.create).toHaveBeenCalledWith({ name: 'Test Workspace' });
      expect(memberRepo.create).toHaveBeenCalledWith({
        userId: 'user-1',
        tenantId: 'tenant-1',
        role: 'OWNER',
        status: 'ACTIVE',
      });
      expect(result.status).toBe('ACTIVE');
    });
  });

  // ── listTenantsForUser ──────────────────────────────────────────────────

  describe('listTenantsForUser', () => {
    it('returns all tenants the user is an active member of', async () => {
      memberRepo.findByUser.mockResolvedValue([
        makeMember({ tenantId: 't1', status: 'ACTIVE' }),
        makeMember({ tenantId: 't2', role: 'MEMBER', status: 'ACTIVE' }),
      ]);
      tenantRepo.findById
        .mockResolvedValueOnce(makeTenant({ id: 't1', name: 'Tenant 1' }))
        .mockResolvedValueOnce(makeTenant({ id: 't2', name: 'Tenant 2' }));

      const result = await service.listTenantsForUser('user-1');

      expect(result).toHaveLength(2);
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
      memberRepo.findByUserAndTenant.mockResolvedValue(makeMember({ role: 'OWNER' }));
      tenantRepo.findById.mockResolvedValue(makeTenant());
      tenantRepo.update.mockResolvedValue(makeTenant({ name: 'Updated' }));

      const result = await service.updateTenant('user-1', 'tenant-1', { name: 'Updated' });

      expect(result.name).toBe('Updated');
    });

    it('throws ForbiddenError for regular members', async () => {
      memberRepo.findByUserAndTenant.mockResolvedValue(makeMember({ role: 'MEMBER' }));

      await expect(service.updateTenant('user-3', 'tenant-1', { name: 'X' })).rejects.toThrow('Only owner or admin');
    });

    it('throws for archived tenant', async () => {
      memberRepo.findByUserAndTenant.mockResolvedValue(makeMember({ role: 'OWNER' }));
      tenantRepo.findById.mockResolvedValue(makeTenant({ status: 'ARCHIVED' }));

      await expect(service.updateTenant('user-1', 'tenant-1', { name: 'X' })).rejects.toThrow('archived');
    });
  });

  // ── deleteTenant (grace period) ──────────────────────────────────────────

  describe('deleteTenant', () => {
    it('sets status to DELETION_PENDING with deletionScheduledAt', async () => {
      memberRepo.findByUserAndTenant.mockResolvedValue(makeMember({ role: 'OWNER' }));
      tenantRepo.findById.mockResolvedValue(makeTenant());
      tenantRepo.update.mockResolvedValue(makeTenant({ status: 'DELETION_PENDING' }));

      await service.deleteTenant('user-1', 'tenant-1');

      expect(tenantRepo.update).toHaveBeenCalledWith('tenant-1', {
        status: 'DELETION_PENDING',
        deletionScheduledAt: expect.any(Date),
      });
    });

    it('throws ForbiddenError for non-owners', async () => {
      memberRepo.findByUserAndTenant.mockResolvedValue(makeMember({ role: 'ADMIN' }));

      await expect(service.deleteTenant('user-2', 'tenant-1')).rejects.toThrow('Only the owner');
    });
  });

  // ── archiveTenant ───────────────────────────────────────────────────────

  describe('archiveTenant', () => {
    it('sets status to ARCHIVED', async () => {
      memberRepo.findByUserAndTenant.mockResolvedValue(makeMember({ role: 'OWNER' }));
      tenantRepo.findById.mockResolvedValue(makeTenant());

      await service.archiveTenant('user-1', 'tenant-1');

      expect(tenantRepo.update).toHaveBeenCalledWith('tenant-1', { status: 'ARCHIVED' });
    });

    it('throws for already archived tenant', async () => {
      memberRepo.findByUserAndTenant.mockResolvedValue(makeMember({ role: 'OWNER' }));
      tenantRepo.findById.mockResolvedValue(makeTenant({ status: 'ARCHIVED' }));

      await expect(service.archiveTenant('user-1', 'tenant-1')).rejects.toThrow('archived');
    });
  });

  // ── restoreTenant ───────────────────────────────────────────────────────

  describe('restoreTenant', () => {
    it('sets status to ACTIVE and clears deletionScheduledAt', async () => {
      memberRepo.findByUserAndTenant.mockResolvedValue(makeMember({ role: 'OWNER' }));

      await service.restoreTenant('user-1', 'tenant-1');

      expect(tenantRepo.update).toHaveBeenCalledWith('tenant-1', {
        status: 'ACTIVE',
        deletionScheduledAt: null,
      });
    });
  });

  // ── cancelDeletion ──────────────────────────────────────────────────────

  describe('cancelDeletion', () => {
    it('sets status to ACTIVE and clears deletionScheduledAt', async () => {
      memberRepo.findByUserAndTenant.mockResolvedValue(makeMember({ role: 'OWNER' }));

      await service.cancelDeletion('user-1', 'tenant-1');

      expect(tenantRepo.update).toHaveBeenCalledWith('tenant-1', {
        status: 'ACTIVE',
        deletionScheduledAt: null,
      });
    });
  });

  // ── inviteUser ──────────────────────────────────────────────────────────

  describe('inviteUser', () => {
    it('creates a pending invitation for existing user and sends email', async () => {
      memberRepo.findByUserAndTenant.mockResolvedValueOnce(makeMember({ role: 'OWNER' }));
      tenantRepo.findById.mockResolvedValue(makeTenant());
      userRepo.findByEmail.mockResolvedValue({ id: 'user-2', email: 'invited@example.com' });
      memberRepo.findByUserAndTenant.mockResolvedValueOnce(null); // no existing membership
      userRepo.findById.mockResolvedValue({ id: 'user-1', displayName: 'Owner' });
      memberRepo.create.mockResolvedValue(makeMember({ userId: 'user-2', role: 'MEMBER' }));

      const result = await service.inviteUser('user-1', 'tenant-1', 'invited@example.com', 'MEMBER');

      expect(result.invitation).toBeDefined();
      expect(memberRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-2',
          tenantId: 'tenant-1',
          role: 'MEMBER',
          status: 'ACTIVE',
        }),
      );
      expect(emailService.sendInvitationEmail).toHaveBeenCalled();
    });
  });

  // ── revokeInvitation ────────────────────────────────────────────────────

  describe('revokeInvitation', () => {
    it('sets invitation status to REVOKED', async () => {
      memberRepo.findByUserAndTenant.mockResolvedValue(makeMember({ role: 'OWNER' }));
      memberRepo.findById.mockResolvedValue(
        makeMember({
          userId: 'user-2',
          invitation: { status: 'PENDING', tokenHash: 'hash', invitedBy: 'user-1', invitedOn: new Date(NOW) },
        }),
      );
      memberRepo.update.mockResolvedValue(makeMember());

      await service.revokeInvitation('user-1', 'tenant-1', 'member-1');

      expect(memberRepo.update).toHaveBeenCalledWith('member-1', {
        invitation: expect.objectContaining({ status: 'REVOKED' }),
      });
    });
  });

  // ── declineInvitation ───────────────────────────────────────────────────

  describe('declineInvitation', () => {
    it('sets invitation status to DECLINED', async () => {
      memberRepo.findById.mockResolvedValue(
        makeMember({
          userId: 'user-2',
          invitation: { status: 'PENDING', tokenHash: 'hash', invitedBy: 'user-1', invitedOn: new Date(NOW) },
        }),
      );
      memberRepo.update.mockResolvedValue(makeMember());

      await service.declineInvitation('member-1', 'user-2');

      expect(memberRepo.update).toHaveBeenCalledWith('member-1', {
        invitation: expect.objectContaining({ status: 'DECLINED' }),
      });
    });
  });

  // ── updateMemberRole ────────────────────────────────────────────────────

  describe('updateMemberRole', () => {
    it('updates the role when requester is admin', async () => {
      memberRepo.findByUserAndTenant
        .mockResolvedValueOnce(makeMember({ role: 'ADMIN' }))
        .mockResolvedValueOnce(makeMember({ userId: 'user-2', role: 'MEMBER' }));
      memberRepo.updateRole.mockResolvedValue(makeMember({ userId: 'user-2', role: 'ADMIN' }));

      const result = await service.updateMemberRole('user-1', 'tenant-1', 'user-2', 'ADMIN');

      expect(result.role).toBe('ADMIN');
    });

    it('throws ForbiddenError when trying to change the owner role', async () => {
      memberRepo.findByUserAndTenant
        .mockResolvedValueOnce(makeMember({ role: 'ADMIN' }))
        .mockResolvedValueOnce(makeMember({ userId: 'owner-1', role: 'OWNER' }));

      await expect(service.updateMemberRole('user-1', 'tenant-1', 'owner-1', 'MEMBER')).rejects.toThrow("owner's role");
    });
  });

  // ── removeMember ────────────────────────────────────────────────────────

  describe('removeMember', () => {
    it('removes the member when requester is admin', async () => {
      memberRepo.findByUserAndTenant
        .mockResolvedValueOnce(makeMember({ role: 'ADMIN' }))
        .mockResolvedValueOnce(makeMember({ userId: 'user-2', role: 'MEMBER' }));
      memberRepo.delete.mockResolvedValue(true);

      await service.removeMember('user-1', 'tenant-1', 'user-2');

      expect(memberRepo.delete).toHaveBeenCalledWith('tenant-1', 'user-2');
    });
  });

  // ── restoreMembership ───────────────────────────────────────────────────

  describe('restoreMembership', () => {
    it('restores ACCESS_REVOKED membership to ACTIVE', async () => {
      memberRepo.findByUserAndTenant.mockResolvedValue(makeMember({ role: 'OWNER' }));
      memberRepo.findById.mockResolvedValue(makeMember({ userId: 'user-2', status: 'ACCESS_REVOKED' }));
      memberRepo.update.mockResolvedValue(makeMember({ userId: 'user-2', status: 'ACTIVE' }));

      await service.restoreMembership('user-1', 'tenant-1', 'member-1');

      expect(memberRepo.update).toHaveBeenCalledWith('member-1', { status: 'ACTIVE' });
    });
  });

  // ── getTenantMembers ────────────────────────────────────────────────────

  describe('getTenantMembers', () => {
    it('returns all members for a tenant with resolved user data', async () => {
      memberRepo.findByTenant.mockResolvedValue([makeMember(), makeMember({ userId: 'user-2', role: 'MEMBER' })]);
      userRepo.findById
        .mockResolvedValueOnce({ id: 'user-1', displayName: 'Alice', email: 'alice@example.com' })
        .mockResolvedValueOnce({ id: 'user-2', displayName: 'Bob', email: 'bob@example.com' });

      const result = await service.getTenantMembers('tenant-1');

      expect(result).toHaveLength(2);
      expect(result[0].displayName).toBe('Alice');
      expect(result[0].email).toBe('alice@example.com');
      expect(result[1].displayName).toBe('Bob');
      expect(result[1].email).toBe('bob@example.com');
    });

    it('returns null displayName/email when user not found', async () => {
      memberRepo.findByTenant.mockResolvedValue([makeMember()]);
      userRepo.findById.mockResolvedValue(null);

      const result = await service.getTenantMembers('tenant-1');

      expect(result).toHaveLength(1);
      expect(result[0].displayName).toBeNull();
      expect(result[0].email).toBeNull();
    });
  });
});
