/**
 * Tests for TenantMemberService — DEC-018 membership semantics:
 * invited memberships persist as ACCESS_REVOKED + invitation PENDING;
 * only explicit acceptance flips them to ACTIVE.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TenantMember } from '@task-board/shared';
import { MemberStatus, InvitationStatus } from '@task-board/shared';
import { TenantMemberService } from './tenant-member.service.js';
import { ConflictError } from '../errors/app-error.js';

// ─── Mock Factories ──────────────────────────────────────────────────────────

function createMockTenantRepo() {
  return {
    findById: vi.fn(),
    findByIds: vi.fn().mockResolvedValue([]),
  };
}

function createMockTenantMemberRepo() {
  return {
    findByUserAndTenant: vi.fn(),
    findByTenant: vi.fn(),
    findPendingByEmail: vi.fn().mockResolvedValue([]),
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
    findByIds: vi.fn().mockResolvedValue([]),
    findByEmail: vi.fn(),
    create: vi.fn(),
    updateProfile: vi.fn(),
  };
}

function createMockEmailService() {
  return {
    sendInvitationEmail: vi.fn().mockResolvedValue(undefined),
  };
}

const NOW = '2025-01-01T00:00:00.000Z';

function makeMember(overrides: Record<string, unknown> = {}) {
  return {
    id: 'member-1',
    userId: 'user-1',
    tenantId: 'tenant-1',
    role: 'OWNER',
    status: 'ACTIVE',
    expiresAt: null,
    invitation: null,
    displayName: null,
    email: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makePendingInvitation(overrides: Record<string, unknown> = {}) {
  return {
    status: InvitationStatus.PENDING,
    tokenHash: 'hash',
    invitedBy: 'owner-1',
    invitedOn: NOW,
    invitedEmail: 'invitee@example.com',
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('TenantMemberService (DEC-018 semantics)', () => {
  let tenantRepo: ReturnType<typeof createMockTenantRepo>;
  let memberRepo: ReturnType<typeof createMockTenantMemberRepo>;
  let userRepo: ReturnType<typeof createMockUserRepo>;
  let emailService: ReturnType<typeof createMockEmailService>;
  let service: TenantMemberService;

  beforeEach(() => {
    tenantRepo = createMockTenantRepo();
    memberRepo = createMockTenantMemberRepo();
    userRepo = createMockUserRepo();
    emailService = createMockEmailService();
    service = new TenantMemberService(
      tenantRepo as never,
      memberRepo as never,
      userRepo as never,
      emailService as never,
    );
    // Default: requester is an ACTIVE owner of an active tenant
    memberRepo.findByUserAndTenant.mockResolvedValue(makeMember());
    tenantRepo.findById.mockResolvedValue({ id: 'tenant-1', name: 'Test Workspace', status: 'ACTIVE' });
  });

  // ── inviteUser ──────────────────────────────────────────────────────────

  describe('inviteUser', () => {
    it('creates the membership as ACCESS_REVOKED with a PENDING invitation', async () => {
      userRepo.findByEmail.mockResolvedValue(null);
      userRepo.create.mockResolvedValue({ id: 'user-new', email: 'invitee@example.com' });
      memberRepo.findByUserAndTenant
        .mockResolvedValueOnce(makeMember()) // requester
        .mockResolvedValueOnce(null); // no existing membership for invitee
      memberRepo.create.mockResolvedValue(
        makeMember({
          id: 'member-new',
          userId: 'user-new',
          role: 'MEMBER',
          status: MemberStatus.ACCESS_REVOKED,
          invitation: makePendingInvitation(),
        }),
      );

      await service.inviteUser('user-1', 'tenant-1', 'invitee@example.com', 'MEMBER');

      expect(memberRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-new',
          tenantId: 'tenant-1',
          role: 'MEMBER',
          status: MemberStatus.ACCESS_REVOKED,
          invitation: expect.objectContaining({
            status: InvitationStatus.PENDING,
            invitedEmail: 'invitee@example.com',
          }),
        }),
      );
    });

    it('rejects inviting an already-active member without a pending invitation', async () => {
      userRepo.findByEmail.mockResolvedValue({ id: 'user-2', email: 'active@example.com' });
      memberRepo.findByUserAndTenant
        .mockResolvedValueOnce(makeMember()) // requester
        .mockResolvedValueOnce(makeMember({ id: 'member-2', userId: 'user-2', role: 'MEMBER' })); // active member

      await expect(service.inviteUser('user-1', 'tenant-1', 'active@example.com', 'MEMBER')).rejects.toThrow(
        ConflictError,
      );
    });

    it('re-inviting a member with a PENDING invitation replaces the token and keeps ACCESS_REVOKED', async () => {
      userRepo.findByEmail.mockResolvedValue({ id: 'user-2', email: 'pending@example.com' });

      const pendingMember = makeMember({
        id: 'member-2',
        userId: 'user-2',
        role: 'MEMBER',
        status: MemberStatus.ACCESS_REVOKED,
        invitation: makePendingInvitation({ invitedBy: 'someone-else' }),
      });

      memberRepo.findByUserAndTenant
        .mockResolvedValueOnce(makeMember()) // requester
        .mockResolvedValueOnce(pendingMember) // active-check for existing user
        .mockResolvedValueOnce(pendingMember); // pending-invitation lookup
      memberRepo.update.mockResolvedValue(pendingMember);

      await service.inviteUser('user-1', 'tenant-1', 'pending@example.com', 'ADMIN');

      expect(memberRepo.update).toHaveBeenCalledWith(
        'member-2',
        expect.objectContaining({
          role: 'ADMIN',
          invitation: expect.objectContaining({
            status: InvitationStatus.PENDING,
            invitedEmail: 'pending@example.com',
          }),
        }),
      );
      // No second membership doc created
      expect(memberRepo.create).not.toHaveBeenCalled();
    });
  });

  // ── acceptInvitation ────────────────────────────────────────────────────

  describe('acceptInvitation', () => {
    it('flips the membership to ACTIVE and clears the invitation', async () => {
      memberRepo.findById.mockResolvedValue(
        makeMember({
          id: 'member-2',
          userId: 'user-2',
          role: 'MEMBER',
          status: MemberStatus.ACCESS_REVOKED,
          invitation: makePendingInvitation({ invitedOn: new Date().toISOString() }),
        }),
      );

      await service.acceptInvitation('member-2', 'user-2');

      expect(memberRepo.update).toHaveBeenCalledWith('member-2', {
        invitation: null,
        status: MemberStatus.ACTIVE,
        expiresAt: null,
      });
    });

    it('rejects a user trying to accept someone else’s invitation (M-01)', async () => {
      memberRepo.findById.mockResolvedValue(
        makeMember({
          id: 'member-2',
          userId: 'user-2',
          role: 'MEMBER',
          status: MemberStatus.ACCESS_REVOKED,
          invitation: makePendingInvitation({ invitedOn: new Date().toISOString() }),
        }),
      );

      await expect(service.acceptInvitation('member-2', 'user-OTHER')).rejects.toMatchObject({
        statusCode: 403,
        code: 'FORBIDDEN',
      });
      expect(memberRepo.update).not.toHaveBeenCalled();
    });

    it('on expiry keeps the membership ACCESS_REVOKED and marks the invitation EXPIRED', async () => {
      memberRepo.findById.mockResolvedValue(
        makeMember({
          id: 'member-2',
          userId: 'user-2',
          role: 'MEMBER',
          status: MemberStatus.ACCESS_REVOKED,
          invitation: makePendingInvitation({ invitedOn: '2020-01-01T00:00:00.000Z' }),
        }),
      );

      await expect(service.acceptInvitation('member-2', 'user-2')).rejects.toMatchObject({
        code: 'INVITATION_EXPIRED',
      });

      expect(memberRepo.update).toHaveBeenCalledWith('member-2', {
        invitation: expect.objectContaining({ status: InvitationStatus.EXPIRED }),
      });
    });
  });

  // ── declineInvitation / revokeInvitation ────────────────────────────────

  describe('declineInvitation', () => {
    it('marks the invitation DECLINED and leaves the membership ACCESS_REVOKED', async () => {
      memberRepo.findById.mockResolvedValue(
        makeMember({
          id: 'member-2',
          userId: 'user-2',
          role: 'MEMBER',
          status: MemberStatus.ACCESS_REVOKED,
          invitation: makePendingInvitation(),
        }),
      );

      await service.declineInvitation('member-2', 'user-2');

      expect(memberRepo.update).toHaveBeenCalledWith('member-2', {
        invitation: expect.objectContaining({ status: InvitationStatus.DECLINED }),
      });
    });
  });

  describe('revokeInvitation', () => {
    it('marks the invitation REVOKED and leaves the membership ACCESS_REVOKED (target addressed by userId)', async () => {
      memberRepo.findByUserAndTenant
        .mockResolvedValueOnce(makeMember()) // requester
        .mockResolvedValueOnce(
          makeMember({
            id: 'member-2',
            userId: 'user-2',
            role: 'MEMBER',
            status: MemberStatus.ACCESS_REVOKED,
            invitation: makePendingInvitation(),
          }),
        );

      await service.revokeInvitation('user-1', 'tenant-1', 'user-2');

      expect(memberRepo.update).toHaveBeenCalledWith('member-2', {
        invitation: expect.objectContaining({ status: InvitationStatus.REVOKED }),
      });
    });

    it('rejects when the invitation is no longer pending', async () => {
      memberRepo.findByUserAndTenant
        .mockResolvedValueOnce(makeMember())
        .mockResolvedValueOnce(makeMember({ id: 'member-2', userId: 'user-2', role: 'MEMBER' }));

      await expect(service.revokeInvitation('user-1', 'tenant-1', 'user-2')).rejects.toThrow(ConflictError);
    });
  });

  // ── reinviteUser ────────────────────────────────────────────────────────

  describe('reinviteUser', () => {
    it('resets the invitation to PENDING and enforces the ACCESS_REVOKED invariant (target by userId)', async () => {
      memberRepo.findByUserAndTenant
        .mockResolvedValueOnce(makeMember()) // requester
        .mockResolvedValueOnce(
          makeMember({
            id: 'member-2',
            userId: 'user-2',
            role: 'MEMBER',
            status: MemberStatus.ACCESS_REVOKED,
            invitation: makePendingInvitation({ status: InvitationStatus.EXPIRED }),
          }),
        );
      userRepo.findById.mockResolvedValue({ id: 'user-2', email: 'Invitee@Example.com' });

      await service.reinviteUser('user-1', 'tenant-1', 'user-2');

      expect(memberRepo.update).toHaveBeenCalledWith('member-2', {
        status: MemberStatus.ACCESS_REVOKED,
        invitation: expect.objectContaining({
          status: InvitationStatus.PENDING,
          invitedEmail: 'invitee@example.com',
        }),
      });
    });
  });

  // ── restoreMembership (BR-036) ──────────────────────────────────────────

  describe('restoreMembership', () => {
    it('rejects restoring a membership with a PENDING invitation (BR-036, target by userId)', async () => {
      memberRepo.findByUserAndTenant
        .mockResolvedValueOnce(makeMember()) // requester
        .mockResolvedValueOnce(
          makeMember({
            id: 'member-2',
            userId: 'user-2',
            role: 'MEMBER',
            status: MemberStatus.ACCESS_REVOKED,
            invitation: makePendingInvitation(),
          }),
        );

      await expect(service.restoreMembership('user-1', 'tenant-1', 'user-2')).rejects.toThrow(ConflictError);

      expect(memberRepo.update).not.toHaveBeenCalled();
    });

    it('restores a plain revoked membership (no pending invitation, target by userId)', async () => {
      memberRepo.findByUserAndTenant
        .mockResolvedValueOnce(makeMember()) // requester
        .mockResolvedValueOnce(
          makeMember({ id: 'member-2', userId: 'user-2', role: 'MEMBER', status: MemberStatus.ACCESS_REVOKED }),
        );

      await service.restoreMembership('user-1', 'tenant-1', 'user-2');

      expect(memberRepo.update).toHaveBeenCalledWith('member-2', { status: MemberStatus.ACTIVE, expiresAt: null });
    });

    it('revoking access then restoring round-trips via userId addressing', async () => {
      const revoked = makeMember({ id: 'member-2', userId: 'user-2', role: 'MEMBER', status: 'ACCESS_REVOKED' });

      // revokeAccess
      memberRepo.findByUserAndTenant.mockResolvedValueOnce(makeMember()).mockResolvedValueOnce(revoked);
      await service.revokeAccess('user-1', 'tenant-1', 'user-2');
      expect(memberRepo.update).toHaveBeenCalledWith('member-2', { status: 'ACCESS_REVOKED' });

      // hardDeleteMember
      memberRepo.findByUserAndTenant.mockResolvedValueOnce(makeMember()).mockResolvedValueOnce(revoked);
      memberRepo.deleteById.mockResolvedValue(true);
      await service.hardDeleteMember('user-1', 'tenant-1', 'user-2');
      expect(memberRepo.deleteById).toHaveBeenCalledWith('member-2');
    });
  });

  // ── getMyInvitations ────────────────────────────────────────────────────

  describe('getMyInvitations', () => {
    it('returns pending invitations looked up by invited email', async () => {
      memberRepo.findPendingByEmail.mockResolvedValue([
        {
          id: 'member-2',
          userId: 'user-2',
          tenantId: 'tenant-1',
          role: 'MEMBER',
          status: MemberStatus.ACCESS_REVOKED,
          invitation: {
            status: InvitationStatus.PENDING,
            tokenHash: 'hash',
            invitedBy: 'owner-1',
            invitedOn: new Date(NOW),
          },
          createdAt: new Date(NOW),
          updatedAt: new Date(NOW),
        },
      ]);
      userRepo.findByIds.mockResolvedValue([{ id: 'user-2', displayName: 'Invitee', email: 'invitee@example.com' }]);
      tenantRepo.findByIds.mockResolvedValue([{ id: 'tenant-1', name: 'Tenant 1' }]);

      const result = await service.getMyInvitations('invitee@example.com');

      expect(memberRepo.findPendingByEmail).toHaveBeenCalledWith('invitee@example.com');
      expect(result).toHaveLength(1);
      expect(result[0]?.status).toBe(MemberStatus.ACCESS_REVOKED);
      expect(result[0]?.invitation?.status).toBe(InvitationStatus.PENDING);
    });
  });

  // ── DEC-055: membership expiration ──────────────────────────────────────

  describe('DEC-055 membership expiration', () => {
    it('updateMember persists expiresAt on the membership document', async () => {
      memberRepo.findByUserAndTenant
        .mockResolvedValueOnce(makeMember()) // requester (owner)
        .mockResolvedValueOnce(makeMember({ id: 'member-2', userId: 'user-2', role: 'MEMBER' })); // target
      memberRepo.update.mockResolvedValue(makeMember({ id: 'member-2', userId: 'user-2', role: 'MEMBER' }));
      userRepo.findById.mockResolvedValue({ id: 'user-2', displayName: 'Member', email: 'm@example.com' });

      const result = await service.updateMember('user-1', 'tenant-1', 'user-2', {
        expiresAt: '2030-01-01T00:00:00.000Z',
      });

      expect(memberRepo.update).toHaveBeenCalledWith('member-2', { expiresAt: new Date('2030-01-01T00:00:00.000Z') });
      expect(result.expiresAt).toBeNull(); // from the mocked repo return
    });

    it('updateMember forbids setting an expiration on the workspace OWNER', async () => {
      memberRepo.findByUserAndTenant
        .mockResolvedValueOnce(makeMember()) // requester
        .mockResolvedValueOnce(makeMember({ id: 'member-2', userId: 'owner-1', role: 'OWNER' })); // target owner

      await expect(
        service.updateMember('user-1', 'tenant-1', 'owner-1', { expiresAt: '2030-01-01T00:00:00.000Z' }),
      ).rejects.toThrow('expiration');

      expect(memberRepo.update).not.toHaveBeenCalled();
    });

    it('denies access once the expiration date has passed and lazily flips the stored status', async () => {
      const past = '2020-01-01T00:00:00.000Z';

      memberRepo.findByUserAndTenant.mockResolvedValue(
        makeMember({ id: 'member-2', userId: 'user-2', role: 'MEMBER', expiresAt: past }),
      );

      await expect(service.updateMemberRole('user-2', 'tenant-1', 'user-2', 'ADMIN')).rejects.toThrow(
        'membership has expired',
      );

      expect(memberRepo.update).toHaveBeenCalledWith('member-2', { status: MemberStatus.ACCESS_REVOKED });
    });

    it('restores an expired-but-still-ACTIVE membership by clearing expiresAt', async () => {
      const past = '2020-01-01T00:00:00.000Z';

      memberRepo.findByUserAndTenant
        .mockResolvedValueOnce(makeMember()) // requester
        .mockResolvedValueOnce(
          makeMember({ id: 'member-2', userId: 'user-2', role: 'MEMBER', status: 'ACTIVE', expiresAt: past }),
        );

      await service.restoreMembership('user-1', 'tenant-1', 'user-2');

      expect(memberRepo.update).toHaveBeenCalledWith('member-2', { status: MemberStatus.ACTIVE, expiresAt: null });
    });

    it('updateMember applies name/email changes to the underlying USER record', async () => {
      memberRepo.findByUserAndTenant
        .mockResolvedValueOnce(makeMember()) // requester
        .mockResolvedValueOnce(makeMember({ id: 'member-2', userId: 'user-2', role: 'MEMBER' }));
      userRepo.findById
        .mockResolvedValueOnce({ id: 'user-2', displayName: 'Old', email: 'old@example.com' }) // profile check
        .mockResolvedValueOnce({ id: 'user-2', displayName: 'New', email: 'new@example.com' }); // fresh read
      userRepo.findByEmail.mockResolvedValue(null);
      userRepo.updateProfile.mockResolvedValue({ id: 'user-2', displayName: 'New', email: 'new@example.com' });
      memberRepo.update.mockResolvedValue(makeMember({ id: 'member-2', userId: 'user-2', role: 'MEMBER' }));

      const result = await service.updateMember('user-1', 'tenant-1', 'user-2', {
        name: 'New',
        email: 'new@example.com',
      });

      expect(userRepo.updateProfile).toHaveBeenCalledWith('user-2', { displayName: 'New', email: 'new@example.com' });
      expect(result.displayName).toBe('New');
      expect(result.email).toBe('new@example.com');
    });

    it('updateMember rejects an email already used by another user', async () => {
      memberRepo.findByUserAndTenant
        .mockResolvedValueOnce(makeMember()) // requester
        .mockResolvedValueOnce(makeMember({ id: 'member-2', userId: 'user-2', role: 'MEMBER' }));
      userRepo.findById.mockResolvedValue({ id: 'user-2', displayName: 'Old', email: 'old@example.com' });
      userRepo.findByEmail.mockResolvedValue({ id: 'user-9', email: 'taken@example.com' });

      await expect(
        service.updateMember('user-1', 'tenant-1', 'user-2', { email: 'taken@example.com' }),
      ).rejects.toThrow(ConflictError);

      expect(memberRepo.update).not.toHaveBeenCalled();
    });
  });
});

// ─── precheckedMembership (tenant-context reuse) ─────────────────────────────

describe('TenantMemberService — precheckedMembership reuse', () => {
  let tenantRepo: ReturnType<typeof createMockTenantRepo>;
  let memberRepo: ReturnType<typeof createMockTenantMemberRepo>;
  let userRepo: ReturnType<typeof createMockUserRepo>;
  let emailService: ReturnType<typeof createMockEmailService>;
  let service: TenantMemberService;

  beforeEach(() => {
    tenantRepo = createMockTenantRepo();
    memberRepo = createMockTenantMemberRepo();
    userRepo = createMockUserRepo();
    emailService = createMockEmailService();
    service = new TenantMemberService(
      tenantRepo as never,
      memberRepo as never,
      userRepo as never,
      emailService as never,
    );
    memberRepo.findByUserAndTenant.mockResolvedValue(makeMember());
    memberRepo.findByTenant.mockResolvedValue([makeMember()]);
    userRepo.findByIds.mockResolvedValue([makeMember()]);
  });

  it('skips the membership lookup when the prechecked membership matches', async () => {
    const prechecked = makeMember() as TenantMember;
    const members = await service.getTenantMembers('user-1', 'tenant-1', prechecked);

    expect(memberRepo.findByUserAndTenant).not.toHaveBeenCalled();
    expect(memberRepo.findByTenant).toHaveBeenCalledWith('tenant-1');
    expect(members.length).toBe(1);
  });

  it('performs the lookup when the prechecked membership is for another tenant', async () => {
    const prechecked = makeMember({ tenantId: 'tenant-OTHER' }) as TenantMember;

    await service.getTenantMembers('user-1', 'tenant-1', prechecked);

    expect(memberRepo.findByUserAndTenant).toHaveBeenCalledWith('user-1', 'tenant-1');
  });

  it('performs the lookup when no prechecked membership is provided (standalone invocation)', async () => {
    await service.getTenantMembers('user-1', 'tenant-1');

    expect(memberRepo.findByUserAndTenant).toHaveBeenCalledWith('user-1', 'tenant-1');
  });
});
