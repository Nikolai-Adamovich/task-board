import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TenantService } from './tenant.service.js';
import { TenantMemberService } from './tenant-member.service.js';

// ─── Mock Factories ──────────────────────────────────────────────────────────

function createMockTenantRepo() {
  return {
    findById: vi.fn(),
    findBySlug: vi.fn(),
    slugExists: vi.fn().mockResolvedValue(false),
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
    deleteByUserId: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockProjectMemberRepo() {
  return {
    deleteByUserId: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockUserRepo() {
  return {
    findById: vi.fn(),
    findByEmail: vi.fn(),
    create: vi.fn(),
    softDelete: vi.fn().mockResolvedValue(true),
  };
}

const NOW = '2025-01-01T00:00:00.000Z';

function makeTenant(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tenant-1',
    name: 'Test Workspace',
    slug: 'test-workspace',
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
  let memberService: TenantMemberService;

  beforeEach(() => {
    tenantRepo = createMockTenantRepo();
    memberRepo = createMockTenantMemberRepo();
    userRepo = createMockUserRepo();
    emailService = createMockEmailService();
    service = new TenantService(tenantRepo as never, memberRepo as never, userRepo as never);
    memberService = new TenantMemberService(
      tenantRepo as never,
      memberRepo as never,
      userRepo as never,
      emailService as never,
    );
  });

  // ── createTenant ────────────────────────────────────────────────────────

  describe('createTenant', () => {
    it('creates a tenant with ACTIVE status and adds the user as owner', async () => {
      tenantRepo.create.mockResolvedValue(makeTenant());
      memberRepo.create.mockResolvedValue(makeMember());

      const result = await service.createTenant('user-1', { name: 'Test Workspace' });

      expect(tenantRepo.create).toHaveBeenCalledWith({ name: 'Test Workspace', slug: 'test-workspace' });
      expect(memberRepo.create).toHaveBeenCalledWith({
        userId: 'user-1',
        tenantId: 'tenant-1',
        role: 'OWNER',
        status: 'ACTIVE',
      });
      expect(result.status).toBe('ACTIVE');
    });

    // ── DEC-032 slug generation & validation ───────────────────────────────

    it('generates the slug from the name when not supplied (DEC-032)', async () => {
      tenantRepo.create.mockResolvedValue(makeTenant({ slug: 'my-workspace' }));
      memberRepo.create.mockResolvedValue(makeMember());

      await service.createTenant('user-1', { name: 'My Workspace!' });

      expect(tenantRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'My Workspace!', slug: 'my-workspace' }),
      );
    });

    it('uses a valid user-supplied slug as-is (DEC-032)', async () => {
      tenantRepo.create.mockResolvedValue(makeTenant({ slug: 'custom-slug' }));
      memberRepo.create.mockResolvedValue(makeMember());

      await service.createTenant('user-1', { name: 'Test Workspace', slug: 'custom-slug' });

      expect(tenantRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Test Workspace', slug: 'custom-slug' }),
      );
    });

    it('rejects an invalid user-supplied slug without hitting the DB', async () => {
      await expect(service.createTenant('user-1', { name: 'X', slug: 'Bad_Slug' })).rejects.toThrow(/Slug must be/);
      expect(tenantRepo.slugExists).not.toHaveBeenCalled();
      expect(tenantRepo.create).not.toHaveBeenCalled();
    });

    it('rejects a taken generated slug with SLUG_TAKEN (DEC-032)', async () => {
      tenantRepo.slugExists.mockResolvedValue(true);

      await expect(service.createTenant('user-1', { name: 'My Workspace' })).rejects.toThrow(/already taken/);
      expect(tenantRepo.create).not.toHaveBeenCalled();
    });

    // ── V4-6: unicode-only name → clean VALIDATION_ERROR, not 409 SLUG_TAKEN ──

    it('rejects a unicode-only name with VALIDATION_ERROR instead of SLUG_TAKEN (V4-6)', async () => {
      await expect(service.createTenant('user-1', { name: '日本語ワークスペース' })).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        statusCode: 400,
        message: 'Workspace name must contain letters or numbers',
      });
      expect(tenantRepo.slugExists).not.toHaveBeenCalled();
      expect(tenantRepo.create).not.toHaveBeenCalled();
    });

    it('still reports a genuine generated-slug collision as SLUG_TAKEN (V4-6)', async () => {
      tenantRepo.slugExists.mockResolvedValue(true);

      await expect(service.createTenant('user-1', { name: 'My Workspace' })).rejects.toMatchObject({
        code: 'SLUG_TAKEN',
      });
    });

    it('rejects a taken user-supplied slug with SLUG_TAKEN (DEC-032)', async () => {
      tenantRepo.slugExists.mockResolvedValue(true);

      await expect(service.createTenant('user-1', { name: 'Test Workspace', slug: 'taken-slug' })).rejects.toThrow(
        /already taken/,
      );
      expect(tenantRepo.create).not.toHaveBeenCalled();
    });
  });

  // ── isSlugAvailable (DEC-032) ─────────────────────────────────────────────

  describe('isSlugAvailable', () => {
    it('returns true for a free, valid slug', async () => {
      tenantRepo.slugExists.mockResolvedValue(false);

      await expect(service.isSlugAvailable('free-slug')).resolves.toBe(true);
      expect(tenantRepo.slugExists).toHaveBeenCalledWith('free-slug');
    });

    it('returns false for a taken slug', async () => {
      tenantRepo.slugExists.mockResolvedValue(true);

      await expect(service.isSlugAvailable('taken-slug')).resolves.toBe(false);
    });

    it('returns false for an invalid slug without querying the DB', async () => {
      await expect(service.isSlugAvailable('-invalid-')).resolves.toBe(false);
      expect(tenantRepo.slugExists).not.toHaveBeenCalled();
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

  describe('inviteUser (TenantMemberService)', () => {
    it('creates a pending invitation for existing user and sends email', async () => {
      memberRepo.findByUserAndTenant.mockResolvedValueOnce(makeMember({ role: 'OWNER' }));
      tenantRepo.findById.mockResolvedValue(makeTenant());
      userRepo.findByEmail.mockResolvedValue({ id: 'user-2', email: 'invited@example.com' });
      memberRepo.findByUserAndTenant.mockResolvedValueOnce(null); // no existing membership
      userRepo.findById.mockResolvedValue({ id: 'user-1', displayName: 'Owner' });
      memberRepo.create.mockResolvedValue(makeMember({ userId: 'user-2', role: 'MEMBER' }));

      const result = await memberService.inviteUser('user-1', 'tenant-1', 'invited@example.com', 'MEMBER');

      expect(result.invitation).toBeDefined();
      // DEC-018: invited membership persists as ACCESS_REVOKED until accepted
      expect(memberRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-2',
          tenantId: 'tenant-1',
          role: 'MEMBER',
          status: 'ACCESS_REVOKED',
        }),
      );
      expect(emailService.sendInvitationEmail).toHaveBeenCalled();
    });
  });

  // ── revokeInvitation ────────────────────────────────────────────────────

  describe('revokeInvitation', () => {
    it('sets invitation status to REVOKED (target addressed by userId)', async () => {
      memberRepo.findByUserAndTenant
        .mockResolvedValueOnce(makeMember({ role: 'OWNER' })) // requester
        .mockResolvedValueOnce(
          makeMember({
            id: 'member-1',
            userId: 'user-2',
            invitation: { status: 'PENDING', tokenHash: 'hash', invitedBy: 'user-1', invitedOn: new Date(NOW) },
          }),
        );
      memberRepo.update.mockResolvedValue(makeMember());

      await memberService.revokeInvitation('user-1', 'tenant-1', 'user-2');

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

      await memberService.declineInvitation('member-1', 'user-2');

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

      const result = await memberService.updateMemberRole('user-1', 'tenant-1', 'user-2', 'ADMIN');

      expect(result.role).toBe('ADMIN');
    });

    it('throws ForbiddenError when trying to change the owner role', async () => {
      memberRepo.findByUserAndTenant
        .mockResolvedValueOnce(makeMember({ role: 'ADMIN' }))
        .mockResolvedValueOnce(makeMember({ userId: 'owner-1', role: 'OWNER' }));

      await expect(memberService.updateMemberRole('user-1', 'tenant-1', 'owner-1', 'MEMBER')).rejects.toThrow(
        "owner's role",
      );
    });
  });

  // ── removeMember ────────────────────────────────────────────────────────

  describe('removeMember', () => {
    it('removes the member when requester is admin', async () => {
      memberRepo.findByUserAndTenant
        .mockResolvedValueOnce(makeMember({ role: 'ADMIN' }))
        .mockResolvedValueOnce(makeMember({ userId: 'user-2', role: 'MEMBER' }));
      memberRepo.delete.mockResolvedValue(true);

      await memberService.removeMember('user-1', 'tenant-1', 'user-2');

      expect(memberRepo.delete).toHaveBeenCalledWith('tenant-1', 'user-2');
    });
  });

  // ── restoreMembership ───────────────────────────────────────────────────

  describe('restoreMembership', () => {
    it('restores ACCESS_REVOKED membership to ACTIVE (target addressed by userId)', async () => {
      memberRepo.findByUserAndTenant
        .mockResolvedValueOnce(makeMember({ role: 'OWNER' })) // requester
        .mockResolvedValueOnce(makeMember({ id: 'member-1', userId: 'user-2', status: 'ACCESS_REVOKED' }));
      memberRepo.update.mockResolvedValue(makeMember({ userId: 'user-2', status: 'ACTIVE' }));

      await memberService.restoreMembership('user-1', 'tenant-1', 'user-2');

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

      const result = await memberService.getTenantMembers('tenant-1');

      expect(result).toHaveLength(2);
      expect(result[0].displayName).toBe('Alice');
      expect(result[0].email).toBe('alice@example.com');
      expect(result[1].displayName).toBe('Bob');
      expect(result[1].email).toBe('bob@example.com');
    });

    it('returns null displayName/email when user not found', async () => {
      memberRepo.findByTenant.mockResolvedValue([makeMember()]);
      userRepo.findById.mockResolvedValue(null);

      const result = await memberService.getTenantMembers('tenant-1');

      expect(result).toHaveLength(1);
      expect(result[0].displayName).toBeNull();
      expect(result[0].email).toBeNull();
    });
  });

  // ── deleteUser (DEC-019) ─────────────────────────────────────────────────

  describe('deleteUser', () => {
    let projectMemberRepo: ReturnType<typeof createMockProjectMemberRepo>;

    beforeEach(() => {
      projectMemberRepo = createMockProjectMemberRepo();
    });

    function makeDeletableUserService() {
      return new TenantService(
        tenantRepo as never,
        memberRepo as never,
        userRepo as never,
        undefined,
        undefined,
        projectMemberRepo as never,
      );
    }

    it('allows an OWNER of the same tenant to delete a user and cleans up memberships', async () => {
      userRepo.findById.mockResolvedValue({ id: 'user-2', displayName: 'Bob' });
      memberRepo.findByUser.mockResolvedValue([makeMember({ userId: 'user-2', role: 'MEMBER' })]);
      memberRepo.findByUserAndTenant.mockResolvedValue(makeMember({ userId: 'user-1', role: 'OWNER' }));

      await makeDeletableUserService().deleteUser('user-1', 'user-2');

      expect(userRepo.softDelete).toHaveBeenCalledWith('user-2');
      expect(memberRepo.deleteByUserId).toHaveBeenCalledWith('user-2');
      expect(projectMemberRepo.deleteByUserId).toHaveBeenCalledWith('user-2');
    });

    it('allows an ADMIN of the same tenant to delete a user', async () => {
      userRepo.findById.mockResolvedValue({ id: 'user-2', displayName: 'Bob' });
      memberRepo.findByUser.mockResolvedValue([makeMember({ userId: 'user-2', role: 'MEMBER' })]);
      memberRepo.findByUserAndTenant.mockResolvedValue(makeMember({ userId: 'user-1', role: 'ADMIN' }));

      await makeDeletableUserService().deleteUser('user-1', 'user-2');

      expect(userRepo.softDelete).toHaveBeenCalledWith('user-2');
    });

    it('rejects a MEMBER requester with ForbiddenError', async () => {
      userRepo.findById.mockResolvedValue({ id: 'user-2', displayName: 'Bob' });
      memberRepo.findByUser.mockResolvedValue([makeMember({ userId: 'user-2', role: 'MEMBER' })]);
      memberRepo.findByUserAndTenant.mockResolvedValue(makeMember({ userId: 'user-1', role: 'MEMBER' }));

      await expect(makeDeletableUserService().deleteUser('user-1', 'user-2')).rejects.toThrow(
        'Only an owner or admin of the same tenant',
      );
      expect(userRepo.softDelete).not.toHaveBeenCalled();
      expect(memberRepo.deleteByUserId).not.toHaveBeenCalled();
    });

    it('rejects cross-tenant deletion when requester is not in the target tenant', async () => {
      userRepo.findById.mockResolvedValue({ id: 'user-2', displayName: 'Bob' });
      memberRepo.findByUser.mockResolvedValue([makeMember({ userId: 'user-2', tenantId: 'tenant-9', role: 'MEMBER' })]);
      memberRepo.findByUserAndTenant.mockResolvedValue(null); // requester not member of tenant-9

      await expect(makeDeletableUserService().deleteUser('user-1', 'user-2')).rejects.toThrow(
        'Only an owner or admin of the same tenant',
      );
      expect(userRepo.softDelete).not.toHaveBeenCalled();
    });

    it('rejects deleting your own account', async () => {
      userRepo.findById.mockResolvedValue({ id: 'user-1', displayName: 'Alice' });

      await expect(makeDeletableUserService().deleteUser('user-1', 'user-1')).rejects.toThrow(
        'Cannot delete your own account',
      );
      expect(userRepo.softDelete).not.toHaveBeenCalled();
    });

    it('throws NotFoundError for unknown target user', async () => {
      userRepo.findById.mockResolvedValue(null);

      await expect(makeDeletableUserService().deleteUser('user-1', 'missing')).rejects.toThrow('User not found');
    });
  });
});
