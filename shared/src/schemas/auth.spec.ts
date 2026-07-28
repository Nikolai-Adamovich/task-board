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
  it('should accept valid login credentials', () => {
    const result = LoginRequestSchema.safeParse({
      email: 'user@example.com',
      password: 'secret123',
    });
    expect(result.success).toBe(true);
  });

  it('should reject empty email', () => {
    const result = LoginRequestSchema.safeParse({
      email: '',
      password: 'secret123',
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid email format', () => {
    const result = LoginRequestSchema.safeParse({
      email: 'not-an-email',
      password: 'secret123',
    });
    expect(result.success).toBe(false);
  });

  it('should reject empty password', () => {
    const result = LoginRequestSchema.safeParse({
      email: 'user@example.com',
      password: '',
    });
    expect(result.success).toBe(false);
  });

  it('should reject missing fields', () => {
    const result = LoginRequestSchema.safeParse({});
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

  it('should reject password shorter than 8 characters', () => {
    const result = RegisterRequestSchema.safeParse({
      ...validRegister,
      password: 'short',
    });
    expect(result.success).toBe(false);
  });

  it('should reject password longer than 128 characters', () => {
    const result = RegisterRequestSchema.safeParse({
      ...validRegister,
      password: 'a'.repeat(129),
    });
    expect(result.success).toBe(false);
  });

  it('should accept password at boundary (8 chars)', () => {
    const result = RegisterRequestSchema.safeParse({
      ...validRegister,
      password: '12345678',
    });
    expect(result.success).toBe(true);
  });

  it('should reject empty display name', () => {
    const result = RegisterRequestSchema.safeParse({
      ...validRegister,
      displayName: '',
    });
    expect(result.success).toBe(false);
  });

  it('should reject display name exceeding 100 characters', () => {
    const result = RegisterRequestSchema.safeParse({
      ...validRegister,
      displayName: 'a'.repeat(101),
    });
    expect(result.success).toBe(false);
  });

  it('should reject missing displayName', () => {
    const result = RegisterRequestSchema.safeParse({
      email: 'a@b.com',
      password: '12345678',
    });
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
    const result = AuthResponseSchema.safeParse({
      user: validUser,
    });
    expect(result.success).toBe(false);
  });

  it('should reject missing user', () => {
    const result = AuthResponseSchema.safeParse({
      token: 'jwt-token-string',
    });
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
