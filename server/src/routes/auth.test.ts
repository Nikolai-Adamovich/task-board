/**
 * Tests for /auth/login and /auth/register HTTP routes.
 *
 * Validates that the endpoints correctly enforce Zod schema validation
 * and return proper HTTP status codes and error responses.
 */
import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { createAuthRoutes } from './auth.js';
import { errorHandler } from '../middleware/error-handler.js';
import type { AppEnv } from '../types/context.js';

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('../db/mongo.js', () => ({
  getCollection: vi.fn(() => ({})),
}));

vi.mock('../services/auth.service.js', () => ({
  AuthService: vi.fn().mockImplementation(() => ({
    login: vi
      .fn()
      .mockResolvedValue({ token: 'jwt-token', user: { id: '1', email: 'test@test', displayName: 'Test' } }),
    register: vi
      .fn()
      .mockResolvedValue({ token: 'jwt-token', user: { id: '1', email: 'new@test', displayName: 'New' } }),
    acceptInvitation: vi
      .fn()
      .mockResolvedValue({ token: 'jwt-token', user: { id: '2', email: 'invited@test', displayName: 'Invited' } }),
    getInvitationDetails: vi.fn().mockResolvedValue({
      email: 'invited@test',
      tenantName: 'Acme',
      role: 'member',
      status: 'pending',
      isRegistered: false,
    }),
    me: vi.fn().mockResolvedValue({ id: '1', email: 'test@test', displayName: 'Test' }),
  })),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TEST_ENV = { JWT_SECRET: 'test-secret', MONGODB_URI: '', ALLOWED_ORIGINS: '*' };

function createTestApp() {
  const app = new Hono<AppEnv>();

  app.onError(errorHandler);
  app.route('/api/v1/auth', createAuthRoutes());

  return app;
}

async function postJson(app: Hono<AppEnv>, path: string, body: unknown) {
  return app.request(
    path,
    {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    },
    TEST_ENV,
  );
}

// ─── POST /api/v1/auth/login ─────────────────────────────────────────────────

describe('POST /api/v1/auth/login', () => {
  const app = createTestApp();

  it('should return 200 for valid credentials', async () => {
    const res = await postJson(app, '/api/v1/auth/login', {
      email: 'user@example.com',
      password: 'password123',
    });

    expect(res.status).toBe(200);
  });

  // ── Valid emails ─────────────────────────────────────────────────────────

  it.each(['user@example.com', 'test@test', 'a@b.c', 'user+tag@example.com'])(
    'should accept email: %s',
    async (email) => {
      const res = await postJson(app, '/api/v1/auth/login', { email, password: 'password123' });

      expect(res.status).toBe(200);
    },
  );

  // ── Invalid emails ──────────────────────────────────────────────────────

  it.each([
    { email: '', desc: 'empty string' },
    { email: 'not-an-email', desc: 'missing @' },
    { email: '@example.com', desc: 'missing local part' },
    { email: 'user@', desc: 'missing domain' },
  ])('should return 422 for email: $desc', async ({ email }) => {
    const res = await postJson(app, '/api/v1/auth/login', { email, password: 'password123' });

    expect(res.status).toBe(422);

    const body = (await res.json()) as Record<string, unknown>;

    expect(body.code).toBe('VALIDATION_ERROR');
  });

  // ── Password ────────────────────────────────────────────────────────────

  it('should return 422 for empty password', async () => {
    const res = await postJson(app, '/api/v1/auth/login', { email: 'user@example.com', password: '' });

    expect(res.status).toBe(422);
  });

  it('should accept any non-empty password (no length restriction)', async () => {
    const res = await postJson(app, '/api/v1/auth/login', { email: 'user@example.com', password: 'a' });

    expect(res.status).toBe(200);
  });

  // ── Missing fields ──────────────────────────────────────────────────────

  it('should return 422 for missing body', async () => {
    const res = await postJson(app, '/api/v1/auth/login', {});

    expect(res.status).toBe(422);
  });

  it('should return 422 for missing email', async () => {
    const res = await postJson(app, '/api/v1/auth/login', { password: 'password123' });

    expect(res.status).toBe(422);
  });

  it('should return 422 for missing password', async () => {
    const res = await postJson(app, '/api/v1/auth/login', { email: 'user@example.com' });

    expect(res.status).toBe(422);
  });

  it('should return 422 for invalid JSON body', async () => {
    const res = await app.request(
      '/api/v1/auth/login',
      {
        method: 'POST',
        body: 'not json',
        headers: { 'Content-Type': 'application/json' },
      },
      TEST_ENV,
    );

    expect(res.status).toBe(422);
  });
});

// ─── POST /api/v1/auth/register ──────────────────────────────────────────────

describe('POST /api/v1/auth/register', () => {
  const app = createTestApp();
  const validBody = { email: 'new@example.com', password: 'securePass123', displayName: 'New User' };

  it('should return 201 for valid registration', async () => {
    const res = await postJson(app, '/api/v1/auth/register', validBody);

    expect(res.status).toBe(201);
  });

  // ── Email ────────────────────────────────────────────────────────────────

  it.each(['test@test', 'user@example.com', 'a@b.co'])('should accept email: %s', async (email) => {
    const res = await postJson(app, '/api/v1/auth/register', { ...validBody, email });

    expect(res.status).toBe(201);
  });

  it('should return 422 for invalid email', async () => {
    const res = await postJson(app, '/api/v1/auth/register', { ...validBody, email: 'not-an-email' });

    expect(res.status).toBe(422);
  });

  // ── Password ────────────────────────────────────────────────────────────

  it('should accept password at minimum boundary (8 chars)', async () => {
    const res = await postJson(app, '/api/v1/auth/register', { ...validBody, password: '12345678' });

    expect(res.status).toBe(201);
  });

  it('should accept password at maximum boundary (128 chars)', async () => {
    const res = await postJson(app, '/api/v1/auth/register', { ...validBody, password: 'a'.repeat(128) });

    expect(res.status).toBe(201);
  });

  it('should return 422 for password shorter than 8 chars', async () => {
    const res = await postJson(app, '/api/v1/auth/register', { ...validBody, password: 'short' });

    expect(res.status).toBe(422);
  });

  it('should return 422 for password longer than 128 chars', async () => {
    const res = await postJson(app, '/api/v1/auth/register', { ...validBody, password: 'a'.repeat(129) });

    expect(res.status).toBe(422);
  });

  it('should return 422 for empty password', async () => {
    const res = await postJson(app, '/api/v1/auth/register', { ...validBody, password: '' });

    expect(res.status).toBe(422);
  });

  // ── Display Name ────────────────────────────────────────────────────────

  it('should accept single-character display name', async () => {
    const res = await postJson(app, '/api/v1/auth/register', { ...validBody, displayName: 'A' });

    expect(res.status).toBe(201);
  });

  it('should accept display name at maximum boundary (100 chars)', async () => {
    const res = await postJson(app, '/api/v1/auth/register', { ...validBody, displayName: 'a'.repeat(100) });

    expect(res.status).toBe(201);
  });

  it('should return 422 for empty display name', async () => {
    const res = await postJson(app, '/api/v1/auth/register', { ...validBody, displayName: '' });

    expect(res.status).toBe(422);
  });

  it('should return 422 for display name exceeding 100 chars', async () => {
    const res = await postJson(app, '/api/v1/auth/register', { ...validBody, displayName: 'a'.repeat(101) });

    expect(res.status).toBe(422);
  });

  // ── Missing fields ──────────────────────────────────────────────────────

  it('should return 422 for missing body', async () => {
    const res = await postJson(app, '/api/v1/auth/register', {});

    expect(res.status).toBe(422);
  });

  it('should return 422 for missing email', async () => {
    const res = await postJson(app, '/api/v1/auth/register', { password: '12345678', displayName: 'User' });

    expect(res.status).toBe(422);
  });

  it('should return 422 for missing password', async () => {
    const res = await postJson(app, '/api/v1/auth/register', { email: 'a@b.com', displayName: 'User' });

    expect(res.status).toBe(422);
  });

  it('should return 422 for missing displayName', async () => {
    const res = await postJson(app, '/api/v1/auth/register', { email: 'a@b.com', password: '12345678' });

    expect(res.status).toBe(422);
  });
});

// ─── POST /api/v1/auth/accept-invitation ─────────────────────────────────────

describe('POST /api/v1/auth/accept-invitation', () => {
  const app = createTestApp();

  it('should return 200 for valid token-only acceptance', async () => {
    const res = await postJson(app, '/api/v1/auth/accept-invitation', { token: 'invite-token-abc123' });

    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, unknown>;

    expect(body.token).toBeDefined();
    expect(body.user).toBeDefined();
  });

  it('should return 200 for acceptance with password and displayName', async () => {
    const res = await postJson(app, '/api/v1/auth/accept-invitation', {
      token: 'invite-token-abc123',
      password: 'securePass123',
      displayName: 'New User',
    });

    expect(res.status).toBe(200);
  });

  it('should return 422 for empty token', async () => {
    const res = await postJson(app, '/api/v1/auth/accept-invitation', { token: '' });

    expect(res.status).toBe(422);
  });

  it('should return 422 for missing token', async () => {
    const res = await postJson(app, '/api/v1/auth/accept-invitation', {});

    expect(res.status).toBe(422);
  });

  it('should return 422 for password shorter than 8 chars', async () => {
    const res = await postJson(app, '/api/v1/auth/accept-invitation', {
      token: 'invite-token-abc123',
      password: 'short',
    });

    expect(res.status).toBe(422);
  });
});

// ─── GET /api/v1/auth/invitations/:token ─────────────────────────────────────

describe('GET /api/v1/auth/invitations/:token', () => {
  const app = createTestApp();

  it('should return 200 with invitation details', async () => {
    const res = await app.request('/api/v1/auth/invitations/invite-token-abc123', { method: 'GET' }, TEST_ENV);

    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, unknown>;

    expect(body.email).toBe('invited@test');
    expect(body.tenantName).toBe('Acme');
    expect(body.role).toBe('member');
    expect(body.status).toBe('pending');
    expect(body.isRegistered).toBe(false);
  });
});
