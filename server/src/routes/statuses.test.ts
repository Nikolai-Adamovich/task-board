/**
 * Tests for status CRUD + reorder HTTP routes.
 *
 * Follows the established route-test pattern (see projects.test.ts):
 * - `vi.mock` for the service layer
 * - `createTestApp()` injects a fake `svc` via middleware
 * - Real `requirePermission` middleware exercises the RBAC matrix (403 paths)
 * - Real `authMiddleware` exercises the 401 path
 */
import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { sign } from 'hono/jwt';
import { createStatusRoutes } from './statuses.js';
import { StatusService } from '../services/status.service.js';
import { errorHandler } from '../middleware/error-handler.js';
import { authMiddleware } from '../middleware/auth.js';
import { NotFoundError } from '../errors/app-error.js';
import type { AppEnv } from '../types/context.js';

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('../db/mongo.js', () => ({
  getCollection: vi.fn(() => ({
    findOne: vi.fn(),
    find: vi.fn(),
    insertOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
    deleteOne: vi.fn(),
    updateMany: vi.fn(),
  })),
}));

const TENANT_ID = '550e8400-e29b-41d4-a716-446655440000';
const PROJECT_ID = '550e8400-e29b-41d4-a716-446655440010';
const USER_ID = '550e8400-e29b-41d4-a716-446655440002';
const mockStatus = {
  id: 'status-1',
  projectId: PROJECT_ID,
  name: 'TODO',
  normalizedName: 'todo',
  position: 0,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

vi.mock('../services/status.service.js', () => ({
  StatusService: vi.fn().mockImplementation(() => ({
    getStatusesByProject: vi.fn().mockResolvedValue([mockStatus]),
    createStatus: vi.fn().mockResolvedValue(mockStatus),
    reorder: vi.fn().mockResolvedValue([mockStatus]),
    updateStatus: vi
      .fn()
      .mockImplementation((id: string) =>
        id === 'missing-status' ? Promise.reject(new NotFoundError('Status not found')) : Promise.resolve(mockStatus),
      ),
    deleteStatus: vi
      .fn()
      .mockImplementation((id: string) =>
        id === 'missing-status' ? Promise.reject(new NotFoundError('Status not found')) : Promise.resolve(undefined),
      ),
  })),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TEST_ENV = { JWT_SECRET: 'test-secret', MONGODB_URI: '', ALLOWED_ORIGINS: '*' };
const VALID_UUID = USER_ID;

function createTestApp(tenantRole = 'OWNER', projectRole: string | null = null) {
  const app = new Hono<AppEnv>();

  app.onError(errorHandler);

  app.use('/api/*', async (c, next) => {
    const MockStatuses = StatusService as unknown as new () => InstanceType<typeof StatusService>;

    c.set('userId', VALID_UUID);
    c.set('tenantId', TENANT_ID);
    c.set('tenantRole', tenantRole as 'OWNER');
    c.set('projectRole', projectRole as never);
    c.set('svc', { statuses: new MockStatuses() } as never);
    await next();
  });

  app.route('/api', createStatusRoutes());

  return app;
}

/** App with real authMiddleware — used for 401 coverage. */
function createAuthTestApp() {
  const app = new Hono<AppEnv>();

  app.onError(errorHandler);

  app.use('/api/*', async (c, next) => {
    const MockStatuses = StatusService as unknown as new () => InstanceType<typeof StatusService>;

    c.set('tenantId', TENANT_ID);
    c.set('tenantRole', 'OWNER' as const);
    c.set('svc', {
      statuses: new MockStatuses(),
      auth: { findActiveUser: vi.fn().mockResolvedValue({ id: USER_ID }) },
    } as never);
    await next();
  });
  app.use('/api/*', authMiddleware);

  app.route('/api', createStatusRoutes());

  return app;
}

async function getJson(app: Hono<AppEnv>, path: string) {
  return app.request(path, { method: 'GET' }, TEST_ENV);
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

async function patchJson(app: Hono<AppEnv>, path: string, body: unknown) {
  return app.request(
    path,
    {
      method: 'PATCH',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    },
    TEST_ENV,
  );
}

async function deleteJson(app: Hono<AppEnv>, path: string, body?: unknown) {
  return app.request(
    path,
    {
      method: 'DELETE',
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    },
    TEST_ENV,
  );
}

// ─── GET /api/projects/:projectId/statuses ───────────────────────────────────

describe('GET /api/projects/:projectId/statuses', () => {
  const app = createTestApp();

  it('returns 200 with { data } envelope containing statuses', async () => {
    const res = await getJson(app, `/api/projects/${PROJECT_ID}/statuses`);

    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, unknown>;

    expect(body).toHaveProperty('data');
    expect(Array.isArray(body.data)).toBe(true);
    expect((body.data as { name: string }[])[0].name).toBe('TODO');
  });
});

// ─── POST /api/projects/:projectId/statuses ──────────────────────────────────

describe('POST /api/projects/:projectId/statuses', () => {
  const validCreateBody = { name: 'In Review', position: 3 };

  it('returns 201 with the created status for an owner', async () => {
    const app = createTestApp('OWNER');
    const res = await postJson(app, `/api/projects/${PROJECT_ID}/statuses`, validCreateBody);

    expect(res.status).toBe(201);

    const body = (await res.json()) as Record<string, unknown>;

    expect(body).toHaveProperty('data');
    expect((body.data as { name: string }).name).toBe('TODO');
  });

  it('returns 201 for a project admin (project-level permission)', async () => {
    const app = createTestApp('MEMBER', 'PROJECT_ADMIN');
    const res = await postJson(app, `/api/projects/${PROJECT_ID}/statuses`, validCreateBody);

    expect(res.status).toBe(201);
  });

  it('returns 403 for an editor (manage_statuses is PROJECT_ADMIN-only)', async () => {
    const app = createTestApp('MEMBER', 'EDITOR');
    const res = await postJson(app, `/api/projects/${PROJECT_ID}/statuses`, validCreateBody);

    expect(res.status).toBe(403);

    const body = (await res.json()) as { error: { code: string } };

    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('returns 400 for a negative position', async () => {
    const app = createTestApp('OWNER');
    const res = await postJson(app, `/api/projects/${PROJECT_ID}/statuses`, { name: 'Bad', position: -1 });

    expect(res.status).toBe(400);

    const body = (await res.json()) as { error: { code: string } };

    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});

// ─── PATCH /api/projects/:projectId/statuses/reorder ─────────────────────────

describe('PATCH /api/projects/:projectId/statuses/reorder', () => {
  const validReorderBody = { items: [{ id: '550e8400-e29b-41d4-a716-446655440091', position: 0 }] };

  it('returns 200 with the reordered statuses', async () => {
    const app = createTestApp('OWNER');
    const res = await patchJson(app, `/api/projects/${PROJECT_ID}/statuses/reorder`, validReorderBody);

    expect(res.status).toBe(200);

    const body = (await res.json()) as { data: unknown[] };

    expect(Array.isArray(body.data)).toBe(true);
  });

  it('returns 403 for a member without a project role', async () => {
    const app = createTestApp('MEMBER', null);
    const res = await patchJson(app, `/api/projects/${PROJECT_ID}/statuses/reorder`, validReorderBody);

    expect(res.status).toBe(403);

    const body = (await res.json()) as { error: { code: string } };

    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('returns 400 for an empty items array', async () => {
    const app = createTestApp('OWNER');
    const res = await patchJson(app, `/api/projects/${PROJECT_ID}/statuses/reorder`, { items: [] });

    expect(res.status).toBe(400);

    const body = (await res.json()) as { error: { code: string } };

    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});

// ─── PATCH /api/statuses/:statusId ───────────────────────────────────────────

describe('PATCH /api/statuses/:statusId', () => {
  const app = createTestApp();

  it('returns 200 with the updated status', async () => {
    const res = await patchJson(app, '/api/statuses/status-1', { name: 'Done' });

    expect(res.status).toBe(200);

    const body = (await res.json()) as { data: { id: string } };

    expect(body.data.id).toBe('status-1');
  });

  it('returns 404 when the status does not exist', async () => {
    const res = await patchJson(app, '/api/statuses/missing-status', { name: 'Done' });

    expect(res.status).toBe(404);

    const body = (await res.json()) as { error: { code: string } };

    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('returns 400 for an invalid body', async () => {
    const res = await patchJson(app, '/api/statuses/status-1', { position: 'not-a-number' });

    expect(res.status).toBe(400);

    const body = (await res.json()) as { error: { code: string } };

    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});

// ─── DELETE /api/statuses/:statusId ──────────────────────────────────────────

describe('DELETE /api/statuses/:statusId', () => {
  const app = createTestApp();

  it('returns 200 with success envelope (no replacement)', async () => {
    const res = await deleteJson(app, '/api/statuses/status-1', {});

    expect(res.status).toBe(200);

    const body = (await res.json()) as { data: { success: boolean } };

    expect(body.data.success).toBe(true);
  });

  it('returns 200 with a replacement status id', async () => {
    const res = await deleteJson(app, '/api/statuses/status-1', {
      replacementStatusId: '550e8400-e29b-41d4-a716-446655440099',
    });

    expect(res.status).toBe(200);

    const body = (await res.json()) as { data: { success: boolean } };

    expect(body.data.success).toBe(true);
  });

  it('returns 404 when the status does not exist', async () => {
    const res = await deleteJson(app, '/api/statuses/missing-status', {});

    expect(res.status).toBe(404);

    const body = (await res.json()) as { error: { code: string } };

    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('returns 400 for an invalid replacement id', async () => {
    const res = await deleteJson(app, '/api/statuses/status-1', { replacementStatusId: 'not-a-uuid' });

    expect(res.status).toBe(400);

    const body = (await res.json()) as { error: { code: string } };

    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});

// ─── Auth (401) ──────────────────────────────────────────────────────────────

describe('auth', () => {
  it('returns 401 with error envelope when no Authorization header is present', async () => {
    const app = createAuthTestApp();
    const res = await getJson(app, `/api/projects/${PROJECT_ID}/statuses`);

    expect(res.status).toBe(401);

    const body = (await res.json()) as { error: { code: string } };

    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 for an invalid token', async () => {
    const app = createAuthTestApp();
    const res = await app.request(
      `/api/projects/${PROJECT_ID}/statuses`,
      { method: 'GET', headers: { Authorization: 'Bearer not-a-jwt' } },
      TEST_ENV,
    );

    expect(res.status).toBe(401);

    const body = (await res.json()) as { error: { code: string } };

    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('allows requests with a valid Bearer token', async () => {
    const app = createAuthTestApp();
    const token = await sign(
      { sub: USER_ID, email: 'user@test.dev', exp: Math.floor(Date.now() / 1000) + 3600 },
      'test-secret',
    );
    const res = await app.request(
      `/api/projects/${PROJECT_ID}/statuses`,
      { method: 'GET', headers: { Authorization: `Bearer ${token}` } },
      TEST_ENV,
    );

    expect(res.status).toBe(200);
  });
});
