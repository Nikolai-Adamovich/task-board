/**
 * Tests for authentication schemas: LoginRequestSchema, RegisterRequestSchema, AuthResponseSchema.
 *
 * These schemas validate the request/response shapes used by the auth endpoints.
 * Testing both valid and invalid inputs ensures contract compliance between frontend and backend.
 */
import { describe, it, expect } from 'vitest';
import {
  LoginRequestSchema,
  RegisterRequestSchema,
  AuthResponseSchema,
  AcceptInvitationSchema,
  InvitationDetailsSchema,
  MyInvitationSchema,
  PendingInvitationSchema,
} from './auth.js';

// ─── LoginRequestSchema ──────────────────────────────────────────────────────

describe('LoginRequestSchema', () => {
  // ── Valid emails ─────────────────────────────────────────────────────────

  it.each([
    'user@example.com',
    'test@test',
    'a@b.c',
    'user+tag@example.com',
    'user.name@domain.co.uk',
    'user_name@example.org',
  ])('should accept valid email: %s', (email) => {
    const result = LoginRequestSchema.safeParse({ email, password: 'secret123' });

    expect(result.success).toBe(true);
  });

  // ── Invalid emails ──────────────────────────────────────────────────────

  it.each([
    { email: '', desc: 'empty string' },
    { email: 'not-an-email', desc: 'missing @ sign' },
    { email: '@example.com', desc: 'missing local part' },
    { email: 'user@', desc: 'missing domain' },
  ])('should reject email: $desc ($email)', ({ email }) => {
    const result = LoginRequestSchema.safeParse({ email, password: 'secret123' });

    expect(result.success).toBe(false);
  });

  // ── Password ────────────────────────────────────────────────────────────

  it('should accept any non-empty password', () => {
    const result = LoginRequestSchema.safeParse({ email: 'user@example.com', password: 'a' });

    expect(result.success).toBe(true);
  });

  it('should reject empty password', () => {
    const result = LoginRequestSchema.safeParse({ email: 'user@example.com', password: '' });

    expect(result.success).toBe(false);
  });

  it('should reject missing fields', () => {
    const result = LoginRequestSchema.safeParse({});

    expect(result.success).toBe(false);
  });

  it('should reject missing password', () => {
    const result = LoginRequestSchema.safeParse({ email: 'user@example.com' });

    expect(result.success).toBe(false);
  });

  it('should reject missing email', () => {
    const result = LoginRequestSchema.safeParse({ password: 'secret123' });

    expect(result.success).toBe(false);
  });
});

// ─── RegisterRequestSchema ───────────────────────────────────────────────────

describe('RegisterRequestSchema', () => {
  const validRegister = {
    email: 'newuser@example.com',
    password: 'securePass123',
    displayName: 'New User',
  };

  it('should accept valid registration data', () => {
    const result = RegisterRequestSchema.safeParse(validRegister);

    expect(result.success).toBe(true);
  });

  // ── Email ────────────────────────────────────────────────────────────────

  it.each(['test@test', 'user@example.com', 'a@b.co', 'user+tag@example.com'])(
    'should accept valid email: %s',
    (email) => {
      const result = RegisterRequestSchema.safeParse({ ...validRegister, email });

      expect(result.success).toBe(true);
    },
  );

  it('should reject invalid email', () => {
    const result = RegisterRequestSchema.safeParse({ ...validRegister, email: 'not-an-email' });

    expect(result.success).toBe(false);
  });

  // ── Password ────────────────────────────────────────────────────────────

  it('should accept password at minimum boundary (8 chars)', () => {
    const result = RegisterRequestSchema.safeParse({ ...validRegister, password: '12345678' });

    expect(result.success).toBe(true);
  });

  it('should accept password at maximum boundary (128 chars)', () => {
    const result = RegisterRequestSchema.safeParse({ ...validRegister, password: 'a'.repeat(128) });

    expect(result.success).toBe(true);
  });

  it('should reject password shorter than 8 characters', () => {
    const result = RegisterRequestSchema.safeParse({ ...validRegister, password: 'short' });

    expect(result.success).toBe(false);
  });

  it('should reject password of 7 characters', () => {
    const result = RegisterRequestSchema.safeParse({ ...validRegister, password: '1234567' });

    expect(result.success).toBe(false);
  });

  it('should reject password longer than 128 characters', () => {
    const result = RegisterRequestSchema.safeParse({ ...validRegister, password: 'a'.repeat(129) });

    expect(result.success).toBe(false);
  });

  it('should reject empty password', () => {
    const result = RegisterRequestSchema.safeParse({ ...validRegister, password: '' });

    expect(result.success).toBe(false);
  });

  // ── Display Name ────────────────────────────────────────────────────────

  it('should accept single-character display name', () => {
    const result = RegisterRequestSchema.safeParse({ ...validRegister, displayName: 'A' });

    expect(result.success).toBe(true);
  });

  it('should accept display name at maximum boundary (100 chars)', () => {
    const result = RegisterRequestSchema.safeParse({ ...validRegister, displayName: 'a'.repeat(100) });

    expect(result.success).toBe(true);
  });

  it('should reject empty display name', () => {
    const result = RegisterRequestSchema.safeParse({ ...validRegister, displayName: '' });

    expect(result.success).toBe(false);
  });

  it('should reject display name exceeding 100 characters', () => {
    const result = RegisterRequestSchema.safeParse({ ...validRegister, displayName: 'a'.repeat(101) });

    expect(result.success).toBe(false);
  });

  it('should reject missing displayName', () => {
    const result = RegisterRequestSchema.safeParse({ email: 'a@b.com', password: '12345678' });

    expect(result.success).toBe(false);
  });

  it('should reject missing email', () => {
    const result = RegisterRequestSchema.safeParse({ password: '12345678', displayName: 'User' });

    expect(result.success).toBe(false);
  });

  it('should reject missing password', () => {
    const result = RegisterRequestSchema.safeParse({ email: 'a@b.com', displayName: 'User' });

    expect(result.success).toBe(false);
  });
});

// ─── AuthResponseSchema ──────────────────────────────────────────────────────

describe('AuthResponseSchema', () => {
  const validUser = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    email: 'user@example.com',
    displayName: 'Test User',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  it('should accept a valid auth response with token and user', () => {
    const result = AuthResponseSchema.safeParse({
      token: 'jwt-token-string',
      user: validUser,
    });

    expect(result.success).toBe(true);
  });

  it('should reject missing token', () => {
    const result = AuthResponseSchema.safeParse({ user: validUser });

    expect(result.success).toBe(false);
  });

  it('should reject missing user', () => {
    const result = AuthResponseSchema.safeParse({ token: 'jwt-token-string' });

    expect(result.success).toBe(false);
  });

  it('should reject user with invalid UUID', () => {
    const result = AuthResponseSchema.safeParse({
      token: 'jwt-token-string',
      user: { ...validUser, id: 'not-a-uuid' },
    });

    expect(result.success).toBe(false);
  });
});

// ─── AcceptInvitationSchema ─────────────────────────────────────────────────

describe('AcceptInvitationSchema', () => {
  it('should accept valid token-only invitation acceptance', () => {
    const result = AcceptInvitationSchema.safeParse({ token: 'invite-token-abc123' });

    expect(result.success).toBe(true);
  });

  it('should accept invitation with password and displayName for new user', () => {
    const result = AcceptInvitationSchema.safeParse({
      token: 'invite-token-abc123',
      password: 'securePass123',
      displayName: 'New User',
    });

    expect(result.success).toBe(true);
  });

  it('should reject empty token', () => {
    const result = AcceptInvitationSchema.safeParse({ token: '' });

    expect(result.success).toBe(false);
  });

  it('should reject missing token', () => {
    const result = AcceptInvitationSchema.safeParse({});

    expect(result.success).toBe(false);
  });

  it('should reject password shorter than 8 characters', () => {
    const result = AcceptInvitationSchema.safeParse({
      token: 'invite-token-abc123',
      password: 'short',
    });

    expect(result.success).toBe(false);
  });

  it('should accept with all optional fields omitted', () => {
    const result = AcceptInvitationSchema.safeParse({ token: 'valid-token' });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.password).toBeUndefined();
      expect(result.data.displayName).toBeUndefined();
    }
  });
});

// ─── InvitationDetailsSchema ────────────────────────────────────────────────

describe('InvitationDetailsSchema', () => {
  const validInvitationDetails = {
    email: 'invited@example.com',
    tenantName: 'Acme Corp',
    role: 'member' as const,
    status: 'pending' as const,
    isRegistered: false,
  };

  it('should accept valid invitation details', () => {
    const result = InvitationDetailsSchema.safeParse(validInvitationDetails);

    expect(result.success).toBe(true);
  });

  it('should accept invitation details for existing user', () => {
    const result = InvitationDetailsSchema.safeParse({
      ...validInvitationDetails,
      isRegistered: true,
    });

    expect(result.success).toBe(true);
  });

  it('should reject invalid email', () => {
    const result = InvitationDetailsSchema.safeParse({
      ...validInvitationDetails,
      email: 'not-an-email',
    });

    expect(result.success).toBe(false);
  });

  it('should reject invalid role', () => {
    const result = InvitationDetailsSchema.safeParse({
      ...validInvitationDetails,
      role: 'superadmin',
    });

    expect(result.success).toBe(false);
  });

  it('should reject invalid status', () => {
    const result = InvitationDetailsSchema.safeParse({
      ...validInvitationDetails,
      status: 'invalid',
    });

    expect(result.success).toBe(false);
  });

  it('should reject missing required fields', () => {
    const result = InvitationDetailsSchema.safeParse({});

    expect(result.success).toBe(false);
  });
});

// ─── MyInvitationSchema ──────────────────────────────────────────────────────

describe('MyInvitationSchema', () => {
  const validMyInvitation = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    tenantId: '660e8400-e29b-41d4-a716-446655440001',
    tenantName: 'Acme Corp',
    role: 'member' as const,
    invitedEmail: 'invited@example.com',
    invitedAt: '2026-01-01T00:00:00.000Z',
  };

  it('should accept valid my-invitation data', () => {
    const result = MyInvitationSchema.safeParse(validMyInvitation);

    expect(result.success).toBe(true);
  });

  it('should accept null invitedAt', () => {
    const result = MyInvitationSchema.safeParse({ ...validMyInvitation, invitedAt: null });

    expect(result.success).toBe(true);
  });

  it('should reject invalid id UUID', () => {
    const result = MyInvitationSchema.safeParse({ ...validMyInvitation, id: 'not-a-uuid' });

    expect(result.success).toBe(false);
  });

  it('should reject invalid tenantId UUID', () => {
    const result = MyInvitationSchema.safeParse({ ...validMyInvitation, tenantId: 'bad' });

    expect(result.success).toBe(false);
  });

  it('should reject invalid email', () => {
    const result = MyInvitationSchema.safeParse({ ...validMyInvitation, invitedEmail: 'not-an-email' });

    expect(result.success).toBe(false);
  });

  it('should reject invalid role', () => {
    const result = MyInvitationSchema.safeParse({ ...validMyInvitation, role: 'superadmin' });

    expect(result.success).toBe(false);
  });

  it('should reject missing required fields', () => {
    const result = MyInvitationSchema.safeParse({});

    expect(result.success).toBe(false);
  });
});

// ─── PendingInvitationSchema ─────────────────────────────────────────────────

describe('PendingInvitationSchema', () => {
  const validPendingInvitation = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    tenantId: '660e8400-e29b-41d4-a716-446655440001',
    userId: '770e8400-e29b-41d4-a716-446655440002',
    invitedEmail: 'pending@example.com',
    role: 'admin' as const,
    status: 'pending' as const,
    invitedAt: '2026-01-01T00:00:00.000Z',
  };

  it('should accept valid pending invitation data', () => {
    const result = PendingInvitationSchema.safeParse(validPendingInvitation);

    expect(result.success).toBe(true);
  });

  it('should accept null userId (invitee without account)', () => {
    const result = PendingInvitationSchema.safeParse({ ...validPendingInvitation, userId: null });

    expect(result.success).toBe(true);
  });

  it('should accept null invitedEmail', () => {
    const result = PendingInvitationSchema.safeParse({ ...validPendingInvitation, invitedEmail: null });

    expect(result.success).toBe(true);
  });

  it('should accept null invitedAt', () => {
    const result = PendingInvitationSchema.safeParse({ ...validPendingInvitation, invitedAt: null });

    expect(result.success).toBe(true);
  });

  it('should accept all member statuses including access_revoked', () => {
    for (const status of ['active', 'pending', 'declined', 'access_revoked'] as const) {
      const result = PendingInvitationSchema.safeParse({ ...validPendingInvitation, status });

      expect(result.success).toBe(true);
    }
  });

  it('should reject invalid status', () => {
    const result = PendingInvitationSchema.safeParse({ ...validPendingInvitation, status: 'banned' });

    expect(result.success).toBe(false);
  });

  it('should reject invalid role', () => {
    const result = PendingInvitationSchema.safeParse({ ...validPendingInvitation, role: 'superadmin' });

    expect(result.success).toBe(false);
  });

  it('should reject missing required fields', () => {
    const result = PendingInvitationSchema.safeParse({});

    expect(result.success).toBe(false);
  });
});
