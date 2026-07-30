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
    findByInvitationToken: vi.fn(),
    findPendingByEmail: vi.fn(),
    activateInvitation: vi.fn(),
    create: vi.fn(),
    updateRole: vi.fn(),
    delete: vi.fn(),
  };
}

const NOW = '2025-01-01T00:00:00.000Z';
const TEST_SECRET = 'test-jwt-secret-for-auth-service';

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
      userRepo.create.mockResolvedValue({
        id: 'user-1',
        email: 'new@example.com',
        displayName: 'New User',
        createdAt: NOW,
        updatedAt: NOW,
      });
      memberRepo.findPendingByEmail.mockResolvedValue([]);

      const result = await service.register({
        email: 'new@example.com',
        password: 'securepass123',
        displayName: 'New User',
      });

      expect(userRepo.findByEmail).toHaveBeenCalledWith('new@example.com');
      expect(userRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'new@example.com',
          displayName: 'New User',
        }),
      );

      // Password should be hashed (not plaintext)
      const createCall = userRepo.create.mock.calls[0]?.[0];

      expect(createCall.passwordHash).not.toBe('securepass123');
      expect(createCall.passwordHash.length).toBeGreaterThan(10);

      // No auto-tenant creation
      expect(tenantRepo.create).not.toHaveBeenCalled();

      expect(result.token).toBeDefined();
      expect(typeof result.token).toBe('string');
      expect(result.token.split('.')).toHaveLength(3); // JWT format
      expect(result.user.email).toBe('new@example.com');
    });

    it('activates pending invitations and sets tenantId in token', async () => {
      userRepo.findByEmail.mockResolvedValue(null);
      userRepo.create.mockResolvedValue({
        id: 'user-1',
        email: 'invited@example.com',
        displayName: 'Invited User',
        createdAt: NOW,
        updatedAt: NOW,
      });
      memberRepo.findPendingByEmail.mockResolvedValue([
        {
          userId: null,
          tenantId: 'tenant-1',
          role: 'member',
          status: 'pending',
          invitedEmail: 'invited@example.com',
          invitationToken: 'token-abc',
          invitedAt: new Date(),
        },
      ]);
      memberRepo.activateInvitation.mockResolvedValue({
        userId: 'user-1',
        tenantId: 'tenant-1',
        role: 'member',
        status: 'active',
      });

      const result = await service.register({
        email: 'invited@example.com',
        password: 'securepass123',
        displayName: 'Invited User',
      });

      expect(memberRepo.findPendingByEmail).toHaveBeenCalledWith('invited@example.com');
      expect(memberRepo.activateInvitation).toHaveBeenCalledWith('token-abc', 'user-1');

      // JWT should contain the tenant from the invitation
      const parts = result.token.split('.');
      const payloadJson = atob((parts[1] ?? '').replace(/-/g, '+').replace(/_/g, '/'));
      const payload = JSON.parse(payloadJson);

      expect(payload.tenantId).toBe('tenant-1');
      expect(payload.tenantRole).toBe('member');
    });

    it('throws ConflictError when email is already taken', async () => {
      userRepo.findByEmail.mockResolvedValue({ id: 'existing', email: 'taken@example.com' });

      await expect(
        service.register({
          email: 'taken@example.com',
          password: 'securepass123',
          displayName: 'Taken',
        }),
      ).rejects.toThrow('already exists');
    });
  });

  // ── login ───────────────────────────────────────────────────────────────

  describe('login', () => {
    it('returns token and user for valid credentials', async () => {
      // bcryptjs hash of 'securepass123' with 10 rounds
      const bcrypt = await import('bcryptjs');
      const hash = await bcrypt.hash('securepass123', 10);

      userRepo.findByEmail.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        displayName: 'Test User',
        passwordHash: hash,
        createdAt: new Date(NOW),
        updatedAt: new Date(NOW),
      });
      memberRepo.findByUser.mockResolvedValue([
        {
          userId: 'user-1',
          tenantId: 'tenant-1',
          role: 'owner',
          status: 'active',
          invitedEmail: null,
          invitationToken: null,
          invitedAt: null,
        },
      ]);

      const result = await service.login({
        email: 'user@example.com',
        password: 'securepass123',
      });

      expect(result.token).toBeDefined();
      expect(result.user.email).toBe('user@example.com');
      expect(result.user.displayName).toBe('Test User');
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

      userRepo.findByEmail.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        displayName: 'Test',
        passwordHash: hash,
        createdAt: new Date(NOW),
        updatedAt: new Date(NOW),
      });

      await expect(service.login({ email: 'user@example.com', password: 'wrongpass' })).rejects.toThrow(
        'Invalid email or password',
      );
    });
  });

  // ── me ──────────────────────────────────────────────────────────────────

  describe('me', () => {
    it('returns the user profile', async () => {
      userRepo.findById.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        displayName: 'Test User',
        createdAt: NOW,
        updatedAt: NOW,
      });

      const result = await service.me('user-1');

      expect(result.id).toBe('user-1');
      expect(result.email).toBe('user@example.com');
    });

    it('throws NotFoundError when user does not exist', async () => {
      userRepo.findById.mockResolvedValue(null);

      await expect(service.me('missing')).rejects.toThrow('not found');
    });
  });

  // ── acceptInvitation ────────────────────────────────────────────────────

  describe('acceptInvitation', () => {
    it('activates invitation for existing user', async () => {
      memberRepo.findByInvitationToken.mockResolvedValue({
        userId: null,
        tenantId: 'tenant-1',
        role: 'member',
        status: 'pending',
        invitedEmail: 'existing@example.com',
        invitationToken: 'token-abc',
        invitedAt: new Date(),
      });
      userRepo.findByEmail.mockResolvedValue({
        id: 'user-existing',
        email: 'existing@example.com',
        displayName: 'Existing User',
        createdAt: new Date(NOW),
        updatedAt: new Date(NOW),
      });
      memberRepo.activateInvitation.mockResolvedValue({
        userId: 'user-existing',
        tenantId: 'tenant-1',
        role: 'member',
        status: 'active',
      });

      const result = await service.acceptInvitation({ token: 'token-abc' });

      expect(memberRepo.findByInvitationToken).toHaveBeenCalledWith('token-abc');
      expect(memberRepo.activateInvitation).toHaveBeenCalledWith('token-abc', 'user-existing');
      expect(result.user.id).toBe('user-existing');
      expect(result.token).toBeDefined();
    });

    it('creates new user and activates invitation when password and displayName provided', async () => {
      memberRepo.findByInvitationToken.mockResolvedValue({
        userId: null,
        tenantId: 'tenant-1',
        role: 'member',
        status: 'pending',
        invitedEmail: 'new@example.com',
        invitationToken: 'token-abc',
        invitedAt: new Date(),
      });
      userRepo.findByEmail.mockResolvedValue(null);
      userRepo.create.mockResolvedValue({
        id: 'user-new',
        email: 'new@example.com',
        displayName: 'New User',
        createdAt: NOW,
        updatedAt: NOW,
      });
      memberRepo.activateInvitation.mockResolvedValue({
        userId: 'user-new',
        tenantId: 'tenant-1',
        role: 'member',
        status: 'active',
      });

      const result = await service.acceptInvitation({
        token: 'token-abc',
        password: 'securePass123',
        displayName: 'New User',
      });

      expect(userRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'new@example.com',
          displayName: 'New User',
        }),
      );
      expect(memberRepo.activateInvitation).toHaveBeenCalledWith('token-abc', 'user-new');
      expect(result.user.id).toBe('user-new');
    });

    it('throws ConflictError when new user missing password', async () => {
      memberRepo.findByInvitationToken.mockResolvedValue({
        userId: null,
        tenantId: 'tenant-1',
        role: 'member',
        status: 'pending',
        invitedEmail: 'new@example.com',
        invitationToken: 'token-abc',
        invitedAt: new Date(),
      });
      userRepo.findByEmail.mockResolvedValue(null);

      await expect(service.acceptInvitation({ token: 'token-abc' })).rejects.toThrow(
        'Password and display name are required',
      );
    });

    it('throws NotFoundError for invalid token', async () => {
      memberRepo.findByInvitationToken.mockResolvedValue(null);

      await expect(service.acceptInvitation({ token: 'invalid' })).rejects.toThrow('Invalid or expired invitation');
    });

    it('throws NotFoundError for non-pending invitation', async () => {
      memberRepo.findByInvitationToken.mockResolvedValue({
        userId: 'user-1',
        tenantId: 'tenant-1',
        role: 'member',
        status: 'active',
        invitedEmail: 'a@b.com',
        invitationToken: 'token-abc',
        invitedAt: null,
      });

      await expect(service.acceptInvitation({ token: 'token-abc' })).rejects.toThrow('Invalid or expired invitation');
    });
  });

  // ── getInvitationDetails ────────────────────────────────────────────────

  describe('getInvitationDetails', () => {
    it('returns invitation details for valid token', async () => {
      memberRepo.findByInvitationToken.mockResolvedValue({
        userId: null,
        tenantId: 'tenant-1',
        role: 'member',
        status: 'pending',
        invitedEmail: 'invited@example.com',
        invitationToken: 'token-abc',
        invitedAt: new Date(),
      });
      tenantRepo.findById.mockResolvedValue({
        id: 'tenant-1',
        name: 'Acme Corp',
        slug: 'acme-corp',
        subscription: 'free',
        createdAt: NOW,
        updatedAt: NOW,
      });
      userRepo.findByEmail.mockResolvedValue(null);

      const result = await service.getInvitationDetails('token-abc');

      expect(result.email).toBe('invited@example.com');
      expect(result.tenantName).toBe('Acme Corp');
      expect(result.role).toBe('member');
      expect(result.status).toBe('pending');
      expect(result.isRegistered).toBe(false);
    });

    it('sets isRegistered to true for existing user', async () => {
      memberRepo.findByInvitationToken.mockResolvedValue({
        userId: null,
        tenantId: 'tenant-1',
        role: 'admin',
        status: 'pending',
        invitedEmail: 'existing@example.com',
        invitationToken: 'token-abc',
        invitedAt: new Date(),
      });
      tenantRepo.findById.mockResolvedValue({
        id: 'tenant-1',
        name: 'Acme Corp',
        slug: 'acme-corp',
        subscription: 'free',
        createdAt: NOW,
        updatedAt: NOW,
      });
      userRepo.findByEmail.mockResolvedValue({ id: 'user-1', email: 'existing@example.com' });

      const result = await service.getInvitationDetails('token-abc');

      expect(result.isRegistered).toBe(true);
      expect(result.role).toBe('admin');
    });

    it('throws NotFoundError for invalid token', async () => {
      memberRepo.findByInvitationToken.mockResolvedValue(null);

      await expect(service.getInvitationDetails('invalid')).rejects.toThrow('Invitation not found');
    });

    it('throws NotFoundError when tenant is missing', async () => {
      memberRepo.findByInvitationToken.mockResolvedValue({
        userId: null,
        tenantId: 'missing-tenant',
        role: 'member',
        status: 'pending',
        invitedEmail: 'a@b.com',
        invitationToken: 'token-abc',
        invitedAt: new Date(),
      });
      tenantRepo.findById.mockResolvedValue(null);

      await expect(service.getInvitationDetails('token-abc')).rejects.toThrow('Tenant not found');
    });
  });

  // ── JWT token format ────────────────────────────────────────────────────

  describe('JWT token', () => {
    it('contains the correct payload fields', async () => {
      userRepo.findByEmail.mockResolvedValue(null);
      userRepo.create.mockResolvedValue({
        id: 'user-1',
        email: 'new@example.com',
        displayName: 'New User',
        createdAt: NOW,
        updatedAt: NOW,
      });
      memberRepo.findPendingByEmail.mockResolvedValue([]);

      const result = await service.register({
        email: 'new@example.com',
        password: 'securepass123',
        displayName: 'New User',
      });
      // Decode the JWT payload (base64url)
      const parts = result.token.split('.');
      const payloadJson = atob((parts[1] ?? '').replace(/-/g, '+').replace(/_/g, '/'));
      const payload = JSON.parse(payloadJson);

      expect(payload.sub).toBe('user-1');
      expect(payload.email).toBe('new@example.com');
      expect(payload.displayName).toBe('New User');
      expect(payload.tenantId).toBeNull(); // No auto-tenant on register
      expect(payload.tenantRole).toBeNull();
      expect(payload.iat).toBeDefined();
      expect(payload.exp).toBe(payload.iat + 24 * 60 * 60); // 24h expiry
    });
  });
});
