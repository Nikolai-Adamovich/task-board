import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { authMiddleware } from './auth.js';
import { errorHandler } from './error-handler.js';
import type { AppEnv } from '../types/context.js';

const TEST_SECRET = 'test-secret-key-for-jwt-signing';

/**
 * Create a test JWT token using Web Crypto API (same as the middleware uses).
 */
async function createTestToken(
  payload: Record<string, unknown>,
  secret = TEST_SECRET,
  expired = false,
): Promise<string> {
  const encoder = new TextEncoder();
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const tokenPayload = {
    ...payload,
    iat: now,
    exp: expired ? now - 3600 : now + 3600,
  };
  const headerB64 = btoa(JSON.stringify(header)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const payloadB64 = btoa(JSON.stringify(tokenPayload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  const data = encoder.encode(`${headerB64}.${payloadB64}`);
  const signature = await crypto.subtle.sign('HMAC', key, data);
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return `${headerB64}.${payloadB64}.${signatureB64}`;
}

/**
 * Users "in the database" for the fake service graph. The middleware now
 * verifies the user still exists (soft-delete check) via `svc.auth`.
 */
const activeUsers = new Map<string, Record<string, unknown>>();

function fakeUser(id: string, email: string, displayName: string) {
  return { id, email, displayName, avatarUrl: null, createdAt: '', updatedAt: '', deletedAt: null };
}

function createTestApp() {
  const app = new Hono<AppEnv>();

  app.onError(errorHandler);
  app.use('/protected/*', (c, next) => {
    c.set('svc', {
      auth: {
        findActiveUser: async (id: string) => activeUsers.get(id) ?? null,
      },
    } as never);
    return next();
  });
  app.use('/protected/*', authMiddleware);
  app.get('/protected/me', (c) => {
    const userId = c.get('userId');
    const user = c.get('user');

    return c.json({ userId, user });
  });
  return app;
}

/** Helper to make requests with env bindings set (simulating Cloudflare Workers) */
function requestWithEnv(app: ReturnType<typeof createTestApp>, path: string, init?: RequestInit) {
  return app.request(path, init, {
    MONGODB_URI: 'mongodb://localhost:27017/test',
    JWT_SECRET: TEST_SECRET,
  });
}

describe('authMiddleware', () => {
  const app = createTestApp();

  it('returns 401 when Authorization header is missing', async () => {
    const res = await requestWithEnv(app, '/protected/me');

    expect(res.status).toBe(401);

    const json = (await res.json()) as { error: { code: string } };

    expect(json.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 when Authorization header is not Bearer', async () => {
    const res = await requestWithEnv(app, '/protected/me', {
      headers: { Authorization: 'Basic abc123' },
    });

    expect(res.status).toBe(401);
  });

  it('returns 401 when token is invalid', async () => {
    const res = await requestWithEnv(app, '/protected/me', {
      headers: { Authorization: 'Bearer invalid.token.here' },
    });

    expect(res.status).toBe(401);
  });

  it('returns 401 when token is expired', async () => {
    const token = await createTestToken({ sub: 'user-1', email: 'test@example.com' }, TEST_SECRET, true);
    const res = await requestWithEnv(app, '/protected/me', {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(401);
  });

  it('returns 401 when token is signed with wrong secret', async () => {
    const token = await createTestToken({ sub: 'user-1', email: 'test@example.com' }, 'wrong-secret');
    const res = await requestWithEnv(app, '/protected/me', {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(401);
  });

  it('sets userId and user context for valid token', async () => {
    activeUsers.set('user-123', fakeUser('user-123', 'test@example.com', 'Test User'));

    const token = await createTestToken({
      sub: 'user-123',
      email: 'test@example.com',
      displayName: 'Test User',
    });
    const res = await requestWithEnv(app, '/protected/me', {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(200);

    const body = (await res.json()) as { userId: string; user: { id: string; email: string; displayName: string } };

    expect(body.userId).toBe('user-123');
    expect(body.user.id).toBe('user-123');
    expect(body.user.email).toBe('test@example.com');
    expect(body.user.displayName).toBe('Test User');
  });

  it('sets user with null avatarUrl by default', async () => {
    activeUsers.set('user-456', fakeUser('user-456', 'avatar@example.com', 'Avatar User'));

    const token = await createTestToken({
      sub: 'user-456',
      email: 'avatar@example.com',
      displayName: 'Avatar User',
    });
    const res = await requestWithEnv(app, '/protected/me', {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(200);

    const body = (await res.json()) as { user: { avatarUrl: string | null; deletedAt: string | null } };

    expect(body.user.avatarUrl).toBeNull();
    expect(body.user.deletedAt).toBeNull();
  });

  it('returns 401 when the user no longer exists (soft-deleted)', async () => {
    // 'deleted-user' is NOT in activeUsers — simulates a soft-deleted account
    const token = await createTestToken({ sub: 'deleted-user', email: 'gone@example.com' });
    const res = await requestWithEnv(app, '/protected/me', {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(401);

    const json = (await res.json()) as { error: { code: string } };

    expect(json.error.code).toBe('UNAUTHORIZED');
  });
});
