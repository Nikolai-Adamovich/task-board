import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from './auth.service.js';

// ─── Mock Factories ──────────────────────────────────────────────────────────

function createMockUserRepo() {
  return {
    findById: vi.fn(),
    findByEmail: vi.fn(),
    findDocumentById: vi.fn(),
    setPasswordAndDisplayName: vi.fn(),
    findActiveByEmail: vi.fn(),
    findByPasswordResetToken: vi.fn(),
    setPasswordReset: vi.fn(),
    updatePasswordAndClearReset: vi.fn(),
    create: vi.fn(),
  };
}

function createMockMailer() {
  return {
    sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
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

  // ── requestPasswordReset ────────────────────────────────────────────────

  describe('requestPasswordReset', () => {
    let mailer: ReturnType<typeof createMockMailer>;

    beforeEach(() => {
      mailer = createMockMailer();
      service = new AuthService(
        userRepo as never,
        tenantRepo as never,
        memberRepo as never,
        TEST_SECRET,
        mailer as never,
        'https://app.example.com',
      );
    });

    it('stores a hashed token and sends the reset email for an existing user', async () => {
      userRepo.findActiveByEmail.mockResolvedValue(makeUserDoc());
      userRepo.setPasswordReset.mockResolvedValue(undefined);

      const result = await service.requestPasswordReset({ email: 'user@example.com' }, '1.2.3.4');

      expect(userRepo.findActiveByEmail).toHaveBeenCalledWith('user@example.com');
      expect(userRepo.setPasswordReset).toHaveBeenCalledTimes(1);

      const [, tokenHash] = userRepo.setPasswordReset.mock.calls[0] ?? [];

      // SHA-256 hex digest of the raw token — 64 chars, never the raw token itself
      expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);

      expect(mailer.sendPasswordResetEmail).toHaveBeenCalledTimes(1);

      const mailParams = mailer.sendPasswordResetEmail.mock.calls[0]?.[0] ?? {
        to: '',
        resetUrl: '',
        expiresInMinutes: 0,
      };

      expect(mailParams.to).toBe('test@example.com');
      expect(mailParams.resetUrl).toMatch(/^https:\/\/app\.example\.com\/auth\/reset-password\?token=[0-9a-f]{64}$/);
      expect(mailParams.expiresInMinutes).toBe(60);

      // Neutral response regardless of account existence
      expect(result.message).toContain('If an account exists');
    });

    it('normalizes the email before lookup', async () => {
      userRepo.findActiveByEmail.mockResolvedValue(null);

      await service.requestPasswordReset({ email: '  USER@EXAMPLE.COM  ' });

      expect(userRepo.findActiveByEmail).toHaveBeenCalledWith('user@example.com');
    });

    it('responds neutrally without storing a token or sending email for unknown emails', async () => {
      userRepo.findActiveByEmail.mockResolvedValue(null);

      const result = await service.requestPasswordReset({ email: 'ghost@example.com' });

      expect(userRepo.setPasswordReset).not.toHaveBeenCalled();
      expect(mailer.sendPasswordResetEmail).not.toHaveBeenCalled();
      expect(result.message).toContain('If an account exists');
    });

    it('never matches soft-deleted users', async () => {
      userRepo.findActiveByEmail.mockResolvedValue(null);

      await service.requestPasswordReset({ email: 'deleted@example.com' });

      expect(userRepo.setPasswordReset).not.toHaveBeenCalled();
      expect(mailer.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('still responds neutrally when rate-limited (no lookup, no email)', async () => {
      userRepo.findActiveByEmail.mockResolvedValue(makeUserDoc());

      // Exhaust the per-email+IP limit (5 requests / 15 min window)
      for (let i = 0; i < 5; i++) {
        await service.requestPasswordReset({ email: 'ratelimit@example.com' }, '9.9.9.9');
      }

      const callsBefore = userRepo.setPasswordReset.mock.calls.length;
      const mailsBefore = mailer.sendPasswordResetEmail.mock.calls.length;
      const result = await service.requestPasswordReset({ email: 'ratelimit@example.com' }, '9.9.9.9');

      expect(result.message).toContain('If an account exists');
      expect(userRepo.setPasswordReset.mock.calls.length).toBe(callsBefore);
      expect(mailer.sendPasswordResetEmail.mock.calls.length).toBe(mailsBefore);
    });
  });

  // ── resetPassword ───────────────────────────────────────────────────────

  describe('resetPassword', () => {
    function makeUserWithReset(requestedOnOffsetMs = 0) {
      return makeUserDoc({
        passwordReset: { tokenHash: 'a'.repeat(64), requestedOn: new Date(Date.now() + requestedOnOffsetMs) },
      });
    }

    it('hashes the new password, clears the token and returns success for a valid token', async () => {
      userRepo.findByPasswordResetToken.mockResolvedValue(makeUserWithReset());
      userRepo.updatePasswordAndClearReset.mockResolvedValue(undefined);

      const result = await service.resetPassword({ token: 'valid-token', newPassword: 'newSecurePass123' });

      expect(userRepo.findByPasswordResetToken).toHaveBeenCalledTimes(1);

      const [lookupHash] = userRepo.findByPasswordResetToken.mock.calls[0] ?? [];

      expect(lookupHash).toMatch(/^[0-9a-f]{64}$/); // token stored/looked up as SHA-256 hash

      expect(userRepo.updatePasswordAndClearReset).toHaveBeenCalledTimes(1);

      const [userId, passwordHash] = userRepo.updatePasswordAndClearReset.mock.calls[0] ?? [];

      expect(userId).toBe('user-1');
      expect(passwordHash).not.toBe('newSecurePass123');
      expect(passwordHash.length).toBeGreaterThan(10);

      expect(result.message).toContain('has been reset');
    });

    it('throws neutral INVALID_RESET_TOKEN error for unknown tokens', async () => {
      userRepo.findByPasswordResetToken.mockResolvedValue(null);

      await expect(service.resetPassword({ token: 'unknown', newPassword: 'newSecurePass123' })).rejects.toMatchObject({
        code: 'INVALID_RESET_TOKEN',
        statusCode: 400,
      });
      expect(userRepo.updatePasswordAndClearReset).not.toHaveBeenCalled();
    });

    it('throws neutral INVALID_RESET_TOKEN error for expired tokens (> 1 hour)', async () => {
      userRepo.findByPasswordResetToken.mockResolvedValue(
        makeUserWithReset(-(61 * 60 * 1000)), // requested 61 minutes ago
      );

      await expect(service.resetPassword({ token: 'expired', newPassword: 'newSecurePass123' })).rejects.toMatchObject({
        code: 'INVALID_RESET_TOKEN',
      });
      expect(userRepo.updatePasswordAndClearReset).not.toHaveBeenCalled();
    });

    it('accepts a token at the edge of the TTL window (< 1 hour)', async () => {
      userRepo.findByPasswordResetToken.mockResolvedValue(makeUserWithReset(-(30 * 60 * 1000)));
      userRepo.updatePasswordAndClearReset.mockResolvedValue(undefined);

      await expect(service.resetPassword({ token: 'fresh', newPassword: 'newSecurePass123' })).resolves.toMatchObject({
        message: expect.stringContaining('has been reset'),
      });
    });

    it('single-use: a used token no longer matches (token cleared on success)', async () => {
      userRepo.findByPasswordResetToken.mockResolvedValueOnce(makeUserWithReset());
      userRepo.updatePasswordAndClearReset.mockResolvedValue(undefined);

      await service.resetPassword({ token: 'used-token', newPassword: 'newSecurePass123' });

      // Second attempt: token was cleared → repository finds nothing
      userRepo.findByPasswordResetToken.mockResolvedValueOnce(null);

      await expect(service.resetPassword({ token: 'used-token', newPassword: 'anotherPass123' })).rejects.toMatchObject(
        {
          code: 'INVALID_RESET_TOKEN',
        },
      );
    });
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

    // V1-8: wrong credentials must carry the distinct INVALID_CREDENTIALS code
    // so the UI can show a neutral message instead of session-expired copy.
    it('throws INVALID_CREDENTIALS for unknown email', async () => {
      userRepo.findByEmail.mockResolvedValue(null);

      await expect(service.login({ email: 'nope@example.com', password: 'x' })).rejects.toMatchObject({
        message: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS',
        statusCode: 401,
      });
    });

    it('throws INVALID_CREDENTIALS for wrong password', async () => {
      const bcrypt = await import('bcryptjs');
      const hash = await bcrypt.hash('correctpass', 10);

      userRepo.findByEmail.mockResolvedValue(makeUserDoc({ passwordHash: hash }));

      await expect(service.login({ email: 'user@example.com', password: 'wrongpass' })).rejects.toMatchObject({
        message: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS',
        statusCode: 401,
      });
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
    const pendingMember = () =>
      makeMemberDoc({
        status: 'ACCESS_REVOKED',
        invitation: { status: 'PENDING', tokenHash: 'hash', invitedBy: 'owner', invitedOn: new Date() },
      });

    it('activates invitation for existing (registered) user', async () => {
      memberRepo.findByInvitationToken.mockResolvedValue(pendingMember());
      userRepo.findDocumentById.mockResolvedValue(
        makeUserDoc({ id: 'user-existing', email: 'existing@example.com', passwordHash: 'hashed-pw' }),
      );
      memberRepo.update.mockResolvedValue(makeMemberDoc({ invitation: null }));

      const result = await service.acceptInvitation({ token: 'token-abc' });

      expect(memberRepo.findByInvitationToken).toHaveBeenCalled();
      expect(memberRepo.update).toHaveBeenCalled();
      expect(result.user.id).toBe('user-existing');
      expect(result.token).toBeDefined();
      // Registered users must NOT get their password overwritten via a token
      expect(userRepo.setPasswordAndDisplayName).not.toHaveBeenCalled();
    });

    // ── V5-2: invitee without an account must set a password ──────────────

    it('rejects a placeholder invitee without password/displayName (no fake auto-login)', async () => {
      memberRepo.findByInvitationToken.mockResolvedValue(pendingMember());
      userRepo.findDocumentById.mockResolvedValue(makeUserDoc({ passwordHash: '' }));

      await expect(service.acceptInvitation({ token: 'token-abc' })).rejects.toMatchObject({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      });
      expect(memberRepo.update).not.toHaveBeenCalled();
    });

    it('creates usable credentials for a placeholder invitee, activates membership, then login works', async () => {
      memberRepo.findByInvitationToken.mockResolvedValue(pendingMember());
      userRepo.findDocumentById.mockResolvedValue(
        makeUserDoc({ email: 'v5member@t.local', displayName: 'v5member', passwordHash: '' }),
      );
      memberRepo.update.mockResolvedValue(makeMemberDoc({ status: 'ACTIVE', invitation: null }));
      userRepo.setPasswordAndDisplayName.mockResolvedValue(undefined);

      const result = await service.acceptInvitation({
        token: 'token-abc',
        password: 'securepass123',
        displayName: 'V Five Member',
      });

      // Account created: real bcrypt hash + chosen display name persisted
      expect(userRepo.setPasswordAndDisplayName).toHaveBeenCalledTimes(1);

      const [, storedHash, storedName] = userRepo.setPasswordAndDisplayName.mock.calls[0] ?? [];
      const bcrypt = await import('bcryptjs');

      await expect(bcrypt.compare('securepass123', storedHash as string)).resolves.toBe(true);
      expect(storedName).toBe('V Five Member');

      // Membership ACTIVE
      expect(memberRepo.update).toHaveBeenCalledWith(
        'member-1',
        expect.objectContaining({ status: 'ACTIVE', invitation: null }),
      );
      expect(result.user.displayName).toBe('V Five Member');
      expect(result.token).toBeDefined();

      // …and the invitee can log in with that password afterwards
      userRepo.findByEmail.mockResolvedValue(
        makeUserDoc({ email: 'v5member@t.local', displayName: 'V Five Member', passwordHash: storedHash }),
      );
      memberRepo.findByUser.mockResolvedValue([makeMemberDoc({ status: 'ACTIVE', invitation: null })]);

      const login = await service.login({ email: 'v5member@t.local', password: 'securepass123' });

      expect(login.user.email).toBe('v5member@t.local');
      expect(login.token).toBeDefined();
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
      // Registered account (real password hash) → isRegistered true
      userRepo.findDocumentById.mockResolvedValue(
        makeUserDoc({ email: 'invited@example.com', passwordHash: 'hashed-pw' }),
      );
      userRepo.findByEmail.mockResolvedValue(null);

      const result = await service.getInvitationDetails('token-abc');

      expect(result.email).toBe('invited@example.com');
      expect(result.tenantName).toBe('Acme Corp');
      expect(result.role).toBe('MEMBER');
      expect(result.status).toBe('PENDING');
      expect(result.isRegistered).toBe(true);
    });

    it('reports isRegistered=false for a placeholder invitee without an account (V5-2)', async () => {
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
      // Placeholder created at invite time: exists but has no password
      userRepo.findDocumentById.mockResolvedValue(makeUserDoc({ email: 'v5member@t.local', passwordHash: '' }));

      const result = await service.getInvitationDetails('token-abc');

      expect(result.email).toBe('v5member@t.local');
      expect(result.isRegistered).toBe(false);
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
