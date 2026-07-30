/**
 * Tests for user schemas: UserSchema, CreateUserSchema.
 *
 * Users are the core identity entity. These tests verify field constraints
 * for user entity representation and registration data.
 */
import { describe, it, expect } from 'vitest';
import { UserSchema, CreateUserSchema } from './user.js';

// ─── UserSchema ──────────────────────────────────────────────────────────────

describe('UserSchema', () => {
  const validUser = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    email: 'user@example.com',
    displayName: 'Test User',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  it('should accept a valid user', () => {
    const result = UserSchema.safeParse(validUser);

    expect(result.success).toBe(true);
  });

  it('should accept user with single-character display name', () => {
    const result = UserSchema.safeParse({ ...validUser, displayName: 'A' });

    expect(result.success).toBe(true);
  });

  it('should accept user with display name at max boundary (100 chars)', () => {
    const result = UserSchema.safeParse({ ...validUser, displayName: 'a'.repeat(100) });

    expect(result.success).toBe(true);
  });

  // ── Invalid id ──────────────────────────────────────────────────────────

  it('should reject invalid UUID for id', () => {
    const result = UserSchema.safeParse({ ...validUser, id: 'not-a-uuid' });

    expect(result.success).toBe(false);
  });

  it('should reject missing id', () => {
    const result = UserSchema.safeParse(Object.fromEntries(Object.entries(validUser).filter(([key]) => key !== 'id')));

    expect(result.success).toBe(false);
  });

  // ── Invalid email ───────────────────────────────────────────────────────

  it('should reject invalid email format', () => {
    const result = UserSchema.safeParse({ ...validUser, email: 'not-an-email' });

    expect(result.success).toBe(false);
  });

  it('should reject empty email', () => {
    const result = UserSchema.safeParse({ ...validUser, email: '' });

    expect(result.success).toBe(false);
  });

  // ── Invalid displayName ────────────────────────────────────────────────

  it('should reject empty display name', () => {
    const result = UserSchema.safeParse({ ...validUser, displayName: '' });

    expect(result.success).toBe(false);
  });

  it('should reject display name exceeding 100 characters', () => {
    const result = UserSchema.safeParse({ ...validUser, displayName: 'a'.repeat(101) });

    expect(result.success).toBe(false);
  });

  // ── Invalid timestamps ──────────────────────────────────────────────────

  it('should reject invalid createdAt datetime format', () => {
    const result = UserSchema.safeParse({ ...validUser, createdAt: 'not-a-date' });

    expect(result.success).toBe(false);
  });

  it('should reject invalid updatedAt datetime format', () => {
    const result = UserSchema.safeParse({ ...validUser, updatedAt: 'invalid' });

    expect(result.success).toBe(false);
  });

  // ── Missing fields ──────────────────────────────────────────────────────

  it('should reject completely empty object', () => {
    const result = UserSchema.safeParse({});

    expect(result.success).toBe(false);
  });

  it('should reject missing email', () => {
    const result = UserSchema.safeParse(
      Object.fromEntries(Object.entries(validUser).filter(([key]) => key !== 'email')),
    );

    expect(result.success).toBe(false);
  });

  it('should reject missing displayName', () => {
    const result = UserSchema.safeParse(
      Object.fromEntries(Object.entries(validUser).filter(([key]) => key !== 'displayName')),
    );

    expect(result.success).toBe(false);
  });

  it('should reject missing timestamps', () => {
    const result = UserSchema.safeParse({
      id: validUser.id,
      email: validUser.email,
      displayName: validUser.displayName,
    });

    expect(result.success).toBe(false);
  });
});

// ─── CreateUserSchema ────────────────────────────────────────────────────────

describe('CreateUserSchema', () => {
  const validCreate = {
    email: 'newuser@example.com',
    password: 'securePass123',
    displayName: 'New User',
  };

  it('should accept valid create-user data', () => {
    const result = CreateUserSchema.safeParse(validCreate);

    expect(result.success).toBe(true);
  });

  // ── Email ────────────────────────────────────────────────────────────────

  it.each(['test@test', 'user@example.com', 'a@b.co', 'user+tag@example.com'])(
    'should accept valid email: %s',
    (email) => {
      const result = CreateUserSchema.safeParse({ ...validCreate, email });

      expect(result.success).toBe(true);
    },
  );

  it('should reject invalid email', () => {
    const result = CreateUserSchema.safeParse({ ...validCreate, email: 'not-an-email' });

    expect(result.success).toBe(false);
  });

  // ── Password ────────────────────────────────────────────────────────────

  it('should accept password at minimum boundary (8 chars)', () => {
    const result = CreateUserSchema.safeParse({ ...validCreate, password: '12345678' });

    expect(result.success).toBe(true);
  });

  it('should accept password at maximum boundary (128 chars)', () => {
    const result = CreateUserSchema.safeParse({ ...validCreate, password: 'a'.repeat(128) });

    expect(result.success).toBe(true);
  });

  it('should reject password shorter than 8 characters', () => {
    const result = CreateUserSchema.safeParse({ ...validCreate, password: 'short' });

    expect(result.success).toBe(false);
  });

  it('should reject password of 7 characters', () => {
    const result = CreateUserSchema.safeParse({ ...validCreate, password: '1234567' });

    expect(result.success).toBe(false);
  });

  it('should reject password longer than 128 characters', () => {
    const result = CreateUserSchema.safeParse({ ...validCreate, password: 'a'.repeat(129) });

    expect(result.success).toBe(false);
  });

  it('should reject empty password', () => {
    const result = CreateUserSchema.safeParse({ ...validCreate, password: '' });

    expect(result.success).toBe(false);
  });

  // ── DisplayName ─────────────────────────────────────────────────────────

  it('should accept single-character display name', () => {
    const result = CreateUserSchema.safeParse({ ...validCreate, displayName: 'A' });

    expect(result.success).toBe(true);
  });

  it('should accept display name at maximum boundary (100 chars)', () => {
    const result = CreateUserSchema.safeParse({ ...validCreate, displayName: 'a'.repeat(100) });

    expect(result.success).toBe(true);
  });

  it('should reject empty display name', () => {
    const result = CreateUserSchema.safeParse({ ...validCreate, displayName: '' });

    expect(result.success).toBe(false);
  });

  it('should reject display name exceeding 100 characters', () => {
    const result = CreateUserSchema.safeParse({ ...validCreate, displayName: 'a'.repeat(101) });

    expect(result.success).toBe(false);
  });

  // ── Missing fields ──────────────────────────────────────────────────────

  it('should reject missing email', () => {
    const result = CreateUserSchema.safeParse({ password: '12345678', displayName: 'User' });

    expect(result.success).toBe(false);
  });

  it('should reject missing password', () => {
    const result = CreateUserSchema.safeParse({ email: 'a@b.com', displayName: 'User' });

    expect(result.success).toBe(false);
  });

  it('should reject missing displayName', () => {
    const result = CreateUserSchema.safeParse({ email: 'a@b.com', password: '12345678' });

    expect(result.success).toBe(false);
  });

  it('should reject completely empty object', () => {
    const result = CreateUserSchema.safeParse({});

    expect(result.success).toBe(false);
  });
});
