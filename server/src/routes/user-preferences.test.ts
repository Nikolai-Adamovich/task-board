/**
 * Tests for user-preferences HTTP routes.
 *
 * Validates GET and PUT endpoints enforce own-user access control,
 * proper validation, and correct response shapes.
 */
import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { createUserPreferencesRoutes } from './user-preferences.js';
import { errorHandler } from '../middleware/error-handler.js';
import type { AppEnv } from '../types/context.js';

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('../db/mongo.js', () => ({
  getCollection: vi.fn(() => ({})),
}));

const mockPreferences = {
  userId: '550e8400-e29b-41d4-a716-446655440002',
  zoom: 100,
  theme: 'light' as const,
  language: 'en',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

vi.mock('../services/user-preferences.service.js', () => ({
  UserPreferencesService: vi.fn().mockImplementation(() => ({
    getPreferences: vi.fn().mockResolvedValue(mockPreferences),
    updatePreferences: vi.fn().mockResolvedValue({ ...mockPreferences, zoom: 150 }),
  })),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TEST_USER_ID = '550e8400-e29b-41d4-a716-446655440002';
const OTHER_USER_ID = '550e8400-e29b-41d4-a716-446655440099';
const TEST_ENV = { JWT_SECRET: 'test-secret', MONGODB_URI: '', ALLOWED_ORIGINS: '*' };

function createTestApp(userId = TEST_USER_ID) {
  const app = new Hono<AppEnv>();

  app.onError(errorHandler);

  // Set userId on context (auth middleware equivalent)
  app.use('/api/v1/*', async (c, next) => {
    c.set('userId', userId);
    await next();
  });

  app.route('/api/v1/users', createUserPreferencesRoutes());

  return app;
}

async function getJson(app: Hono<AppEnv>, path: string) {
  return app.request(path, { method: 'GET' }, TEST_ENV);
}

async function putJson(app: Hono<AppEnv>, path: string, body: unknown) {
  return app.request(
    path,
    {
      method: 'PUT',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    },
    TEST_ENV,
  );
}

// ─── GET /api/v1/users/:id/preferences ───────────────────────────────────────

describe('GET /api/v1/users/:id/preferences', () => {
  it('should return 200 with preferences for own user', async () => {
    const app = createTestApp();
    const res = await getJson(app, `/api/v1/users/${TEST_USER_ID}/preferences`);

    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, unknown>;

    expect(body).toHaveProperty('userId', TEST_USER_ID);
    expect(body).toHaveProperty('zoom');
    expect(body).toHaveProperty('theme');
    expect(body).toHaveProperty('language');
  });

  it("should return 403 when accessing another user's preferences", async () => {
    const app = createTestApp();
    const res = await getJson(app, `/api/v1/users/${OTHER_USER_ID}/preferences`);

    expect(res.status).toBe(403);

    const body = (await res.json()) as Record<string, unknown>;

    expect(body.error).toBe('Forbidden');
  });
});

// ─── PUT /api/v1/users/:id/preferences ───────────────────────────────────────

describe('PUT /api/v1/users/:id/preferences', () => {
  it('should return 200 with updated preferences for own user', async () => {
    const app = createTestApp();
    const res = await putJson(app, `/api/v1/users/${TEST_USER_ID}/preferences`, { zoom: 150 });

    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, unknown>;

    expect(body).toHaveProperty('userId', TEST_USER_ID);
    expect(body.zoom).toBe(150);
  });

  it('should return 400 for invalid body', async () => {
    const app = createTestApp();
    const res = await putJson(app, `/api/v1/users/${TEST_USER_ID}/preferences`, { zoom: 10 });

    expect(res.status).toBe(400);

    const body = (await res.json()) as Record<string, unknown>;

    expect(body.error).toBe('Bad Request');
  });

  it("should return 403 when updating another user's preferences", async () => {
    const app = createTestApp();
    const res = await putJson(app, `/api/v1/users/${OTHER_USER_ID}/preferences`, { zoom: 150 });

    expect(res.status).toBe(403);

    const body = (await res.json()) as Record<string, unknown>;

    expect(body.error).toBe('Forbidden');
  });
});
