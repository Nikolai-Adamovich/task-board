import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from './auth.service.js';

// ─── Mock Factories ──────────────────────────────────────────────────────────

function createMockUserRepo() {
  return {
    findById: vi.fn(),
    findByEmail: vi.fn(),
    create: vi.fn(),
  };
}

function createMockTenantRepo() {
  return {
    findById: vi.fn(),
    findByUser: vi.fn(),
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
    findByInvitationToken: vi.fn(),
    findPendingByEmail: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateRole: vi.fn(),
    delete: vi.fn(),
  };
}

const NOW = '2025-01-01T00:00:00.000Z';
const TEST_SECRET = 'test-jwt-secret-for-auth-service';

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    email: 'test@example.com',
    displayName: 'Test User',
    avatarUrl: null,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    ...overrides,
  };
}

function makeUserDoc(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    email: 'test@example.com',
    displayName: 'Test User',
    avatarUrl: null,
    passwordHash: 'hashed-pw',
    createdAt: new Date(NOW),
    updatedAt: new Date(NOW),
    deletedAt: null,
    ...overrides,
  };
}

function makeMemberDoc(overrides: Record<string, unknown> = {}) {
  return {
    id: 'member-1',
    userId: 'user-1',
    tenantId: 'tenant-1',
    role: 'MEMBER',
    status: 'ACTIVE',
    invitation: null,
    createdAt: new Date(NOW),
    updatedAt: new Date(NOW),
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('AuthService', () => {
  let userRepo: ReturnType<typeof createMockUserRepo>;
  let tenantRepo: ReturnType<typeof createMockTenantRepo>;
  let memberRepo: ReturnType<typeof createMockTenantMemberRepo>;
  let service: AuthService;

  beforeEach(() => {
    userRepo = createMockUserRepo();
    tenantRepo = createMockTenantRepo();
    memberRepo = createMockTenantMemberRepo();
    service = new AuthService(userRepo as never, tenantRepo as never, memberRepo as never, TEST_SECRET);
  });

  // ── register ────────────────────────────────────────────────────────────

  describe('register', () => {
    it('creates user and returns token with null tenant when no pending invitations', async () => {
      userRepo.findByEmail.mockResolvedValue(null);
      userRepo.create.mockResolvedValue(makeUser({ email: 'new@example.com', displayName: 'New User' }));
      memberRepo.findPendingByEmail.mockResolvedValue([]);

      const result = await service.register({
        email: 'new@example.com',
        password: 'securepass123',
        displayName: 'New User',
      });

      expect(userRepo.findByEmail).toHaveBeenCalledWith('new@example.com');
      expect(userRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'new@example.com', displayName: 'New User' }),
      );

      const createCall = userRepo.create.mock.calls[0]?.[0];

      expect(createCall.passwordHash).not.toBe('securepass123');
      expect(createCall.passwordHash.length).toBeGreaterThan(10);

      expect(result.token).toBeDefined();
      expect(result.token.split('.')).toHaveLength(3);
      expect(result.user.email).toBe('new@example.com');
      expect(result.user.avatarUrl).toBeNull();
      expect(result.user.deletedAt).toBeNull();
    });

    it('normalizes email before registration', async () => {
      userRepo.findByEmail.mockResolvedValue(null);
      userRepo.create.mockResolvedValue(makeUser({ email: 'new@example.com' }));
      memberRepo.findPendingByEmail.mockResolvedValue([]);

      await service.register({ email: '  NEW@EXAMPLE.COM  ', password: 'securepass123', displayName: 'New User' });

      expect(userRepo.findByEmail).toHaveBeenCalledWith('new@example.com');
      expect(userRepo.create).toHaveBeenCalledWith(expect.objectContaining({ email: 'new@example.com' }));
    });

    it('activates pending invitations and sets tenantId in token', async () => {
      userRepo.findByEmail.mockResolvedValue(null);
      userRepo.create.mockResolvedValue(makeUser());
      memberRepo.findPendingByEmail.mockResolvedValue([
        makeMemberDoc({
          userId: null,
          invitation: { status: 'PENDING', tokenHash: 'hash', invitedBy: 'owner', invitedOn: new Date() },
        }),
      ]);
      memberRepo.update.mockResolvedValue(makeMemberDoc());

      const result = await service.register({
        email: 'invited@example.com',
        password: 'securepass123',
        displayName: 'Invited User',
      });

      expect(memberRepo.findPendingByEmail).toHaveBeenCalledWith('invited@example.com');

      const parts = result.token.split('.');
      const payloadJson = atob((parts[1] ?? '').replace(/-/g, '+').replace(/_/g, '/'));
      const payload = JSON.parse(payloadJson);

      expect(payload.tenantId).toBe('tenant-1');
      expect(payload.tenantRole).toBe('MEMBER');
    });

    it('throws ConflictError when email is already taken', async () => {
      userRepo.findByEmail.mockResolvedValue({ id: 'existing', email: 'taken@example.com' });

      await expect(
        service.register({ email: 'taken@example.com', password: 'securepass123', displayName: 'Taken' }),
      ).rejects.toThrow('already exists');
    });
  });

  // ── login ───────────────────────────────────────────────────────────────

  describe('login', () => {
    it('returns token and user for valid credentials', async () => {
      const bcrypt = await import('bcryptjs');
      const hash = await bcrypt.hash('securepass123', 10);

      userRepo.findByEmail.mockResolvedValue(makeUserDoc({ email: 'user@example.com', passwordHash: hash }));
      memberRepo.findByUser.mockResolvedValue([makeMemberDoc({ role: 'OWNER' })]);

      const result = await service.login({ email: 'user@example.com', password: 'securepass123' });

      expect(result.token).toBeDefined();
      expect(result.user.email).toBe('user@example.com');
      expect(result.user.displayName).toBe('Test User');
      expect(result.user.avatarUrl).toBeNull();
      expect(result.user.deletedAt).toBeNull();
    });

    it('normalizes email before login lookup', async () => {
      const bcrypt = await import('bcryptjs');
      const hash = await bcrypt.hash('securepass123', 10);

      userRepo.findByEmail.mockResolvedValue(makeUserDoc({ passwordHash: hash }));
      memberRepo.findByUser.mockResolvedValue([]);

      await service.login({ email: '  USER@EXAMPLE.COM  ', password: 'securepass123' });

      expect(userRepo.findByEmail).toHaveBeenCalledWith('user@example.com');
    });

    it('throws UnauthorizedError for wrong email', async () => {
      userRepo.findByEmail.mockResolvedValue(null);

      await expect(service.login({ email: 'nope@example.com', password: 'x' })).rejects.toThrow(
        'Invalid email or password',
      );
    });

    it('throws UnauthorizedError for wrong password', async () => {
      const bcrypt = await import('bcryptjs');
      const hash = await bcrypt.hash('correctpass', 10);

      userRepo.findByEmail.mockResolvedValue(makeUserDoc({ passwordHash: hash }));

      await expect(service.login({ email: 'user@example.com', password: 'wrongpass' })).rejects.toThrow(
        'Invalid email or password',
      );
    });
  });

  // ── me ──────────────────────────────────────────────────────────────────

  describe('me', () => {
    it('returns the user profile', async () => {
      userRepo.findById.mockResolvedValue(makeUser({ email: 'user@example.com' }));

      const result = await service.me('user-1');

      expect(result.id).toBe('user-1');
      expect(result.email).toBe('user@example.com');
      expect(result.avatarUrl).toBeNull();
      expect(result.deletedAt).toBeNull();
    });

    it('throws NotFoundError when user does not exist', async () => {
      userRepo.findById.mockResolvedValue(null);

      await expect(service.me('missing')).rejects.toThrow('not found');
    });
  });

  // ── acceptInvitation ────────────────────────────────────────────────────

  describe('acceptInvitation', () => {
    it('activates invitation for existing user', async () => {
      memberRepo.findByInvitationToken.mockResolvedValue(
        makeMemberDoc({
          invitation: { status: 'PENDING', tokenHash: 'hash', invitedBy: 'owner', invitedOn: new Date() },
        }),
      );
      userRepo.findById.mockResolvedValue(makeUser({ id: 'user-existing', email: 'existing@example.com' }));
      memberRepo.update.mockResolvedValue(makeMemberDoc({ invitation: null }));

      const result = await service.acceptInvitation({ token: 'token-abc' });

      expect(memberRepo.findByInvitationToken).toHaveBeenCalled();
      expect(memberRepo.update).toHaveBeenCalled();
      expect(result.user.id).toBe('user-existing');
      expect(result.token).toBeDefined();
    });

    it('throws NotFoundError for invalid token', async () => {
      memberRepo.findByInvitationToken.mockResolvedValue(null);

      await expect(service.acceptInvitation({ token: 'invalid' })).rejects.toThrow('Invalid or expired invitation');
    });

    it('throws NotFoundError for non-pending invitation', async () => {
      memberRepo.findByInvitationToken.mockResolvedValue(
        makeMemberDoc({
          invitation: { status: 'REVOKED', tokenHash: 'hash', invitedBy: 'owner', invitedOn: new Date() },
        }),
      );

      await expect(service.acceptInvitation({ token: 'token-abc' })).rejects.toThrow('Invalid or expired invitation');
    });
  });

  // ── getInvitationDetails ────────────────────────────────────────────────

  describe('getInvitationDetails', () => {
    it('returns invitation details for valid token', async () => {
      memberRepo.findByInvitationToken.mockResolvedValue(
        makeMemberDoc({
          invitation: { status: 'PENDING', tokenHash: 'hash', invitedBy: 'owner', invitedOn: new Date() },
        }),
      );
      tenantRepo.findById.mockResolvedValue({
        id: 'tenant-1',
        name: 'Acme Corp',
        status: 'ACTIVE',
        description: null,
        deletionScheduledAt: null,
        createdAt: NOW,
        updatedAt: NOW,
      });
      userRepo.findById.mockResolvedValue(makeUser({ email: 'invited@example.com' }));
      userRepo.findByEmail.mockResolvedValue(null);

      const result = await service.getInvitationDetails('token-abc');

      expect(result.email).toBe('invited@example.com');
      expect(result.tenantName).toBe('Acme Corp');
      expect(result.role).toBe('MEMBER');
      expect(result.status).toBe('PENDING');
    });

    it('throws NotFoundError for invalid token', async () => {
      memberRepo.findByInvitationToken.mockResolvedValue(null);

      await expect(service.getInvitationDetails('invalid')).rejects.toThrow('Invitation not found');
    });

    it('throws NotFoundError when tenant is missing', async () => {
      memberRepo.findByInvitationToken.mockResolvedValue(
        makeMemberDoc({
          invitation: { status: 'PENDING', tokenHash: 'hash', invitedBy: 'owner', invitedOn: new Date() },
        }),
      );
      tenantRepo.findById.mockResolvedValue(null);

      await expect(service.getInvitationDetails('token-abc')).rejects.toThrow('Tenant not found');
    });
  });

  // ── JWT token format ────────────────────────────────────────────────────

  describe('JWT token', () => {
    it('contains the correct payload fields', async () => {
      userRepo.findByEmail.mockResolvedValue(null);
      userRepo.create.mockResolvedValue(makeUser({ email: 'new@example.com', displayName: 'New User' }));
      memberRepo.findPendingByEmail.mockResolvedValue([]);

      const result = await service.register({
        email: 'new@example.com',
        password: 'securepass123',
        displayName: 'New User',
      });
      const parts = result.token.split('.');
      const payloadJson = atob((parts[1] ?? '').replace(/-/g, '+').replace(/_/g, '/'));
      const payload = JSON.parse(payloadJson);

      expect(payload.sub).toBe('user-1');
      expect(payload.email).toBe('new@example.com');
      expect(payload.displayName).toBe('New User');
      expect(payload.tenantId).toBeNull();
      expect(payload.tenantRole).toBeNull();
      expect(payload.iat).toBeDefined();
      expect(payload.exp).toBe(payload.iat + 24 * 60 * 60);
    });
  });
});
