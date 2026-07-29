/**
 * Tests for authentication schemas: LoginRequestSchema, RegisterRequestSchema, AuthResponseSchema.
 *
 * These schemas validate the request/response shapes used by the auth endpoints.
 * Testing both valid and invalid inputs ensures contract compliance between frontend and backend.
 */
import { describe, it, expect } from 'vitest';
import { LoginRequestSchema, RegisterRequestSchema, AuthResponseSchema } from './auth.js';

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
