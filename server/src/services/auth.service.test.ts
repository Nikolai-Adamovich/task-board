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
    it('creates user, tenant, membership, and returns token', async () => {
      userRepo.findByEmail.mockResolvedValue(null);
      userRepo.create.mockResolvedValue({
        id: 'user-1',
        email: 'new@example.com',
        displayName: 'New User',
        createdAt: NOW,
        updatedAt: NOW,
      });
      tenantRepo.create.mockResolvedValue({
        id: 'tenant-1',
        name: "New User's Workspace",
        slug: 'new-user-abc12345',
        createdAt: NOW,
        updatedAt: NOW,
      });
      memberRepo.create.mockResolvedValue({
        userId: 'user-1',
        tenantId: 'tenant-1',
        role: 'owner',
      });

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

      expect(tenantRepo.create).toHaveBeenCalledWith(expect.objectContaining({ name: "New User's Workspace" }));
      expect(memberRepo.create).toHaveBeenCalledWith({
        userId: 'user-1',
        tenantId: 'tenant-1',
        role: 'owner',
      });

      expect(result.token).toBeDefined();
      expect(typeof result.token).toBe('string');
      expect(result.token.split('.')).toHaveLength(3); // JWT format
      expect(result.user.email).toBe('new@example.com');
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
      tenantRepo.create.mockResolvedValue({
        id: 'tenant-1',
        name: "New User's Workspace",
        slug: 'new-user-abc12345',
        createdAt: NOW,
        updatedAt: NOW,
      });
      memberRepo.create.mockResolvedValue({
        userId: 'user-1',
        tenantId: 'tenant-1',
        role: 'owner',
      });

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
      expect(payload.tenantId).toBe('tenant-1');
      expect(payload.tenantRole).toBe('owner');
      expect(payload.iat).toBeDefined();
      expect(payload.exp).toBe(payload.iat + 24 * 60 * 60); // 24h expiry
    });
  });
});
