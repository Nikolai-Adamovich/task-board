/**
 * Tests for single-board HTTP routes (doc 102).
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
import { createBoardRoutes } from './boards.js';
import { BoardService } from '../services/board.service.js';
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
const mockBoard = {
  projectId: PROJECT_ID,
  columns: [{ id: 'col-1', statusIds: ['status-1'], position: 0 }],
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

vi.mock('../services/board.service.js', () => ({
  BoardService: vi.fn().mockImplementation(() => ({
    getBoardByProject: vi
      .fn()
      .mockImplementation((projectId: string) =>
        projectId === 'missing-project'
          ? Promise.reject(new NotFoundError('Board not found'))
          : Promise.resolve(mockBoard),
      ),
    updateColumns: vi.fn().mockResolvedValue(mockBoard),
  })),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TEST_ENV = { JWT_SECRET: 'test-secret', MONGODB_URI: '', ALLOWED_ORIGINS: '*' };
const VALID_UUID = USER_ID;

function createTestApp(tenantRole = 'OWNER', projectRole: string | null = null) {
  const app = new Hono<AppEnv>();

  app.onError(errorHandler);

  app.use('/api/*', async (c, next) => {
    const MockBoards = BoardService as unknown as new () => InstanceType<typeof BoardService>;

    c.set('userId', VALID_UUID);
    c.set('tenantId', TENANT_ID);
    c.set('tenantRole', tenantRole as 'OWNER');
    c.set('projectRole', projectRole as never);
    c.set('svc', { boards: new MockBoards() } as never);
    await next();
  });

  app.route('/api', createBoardRoutes());

  return app;
}

/** App with real authMiddleware — used for 401 coverage. */
function createAuthTestApp() {
  const app = new Hono<AppEnv>();

  app.onError(errorHandler);

  app.use('/api/*', async (c, next) => {
    const MockBoards = BoardService as unknown as new () => InstanceType<typeof BoardService>;

    c.set('tenantId', TENANT_ID);
    c.set('tenantRole', 'OWNER' as const);
    c.set('svc', {
      boards: new MockBoards(),
      auth: { findActiveUser: vi.fn().mockResolvedValue({ id: USER_ID }) },
    } as never);
    await next();
  });
  app.use('/api/*', authMiddleware);

  app.route('/api', createBoardRoutes());

  return app;
}

async function getJson(app: Hono<AppEnv>, path: string) {
  return app.request(path, { method: 'GET' }, TEST_ENV);
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

// ─── GET /api/projects/:projectId/board ──────────────────────────────────────

describe('GET /api/projects/:projectId/board', () => {
  const app = createTestApp();

  it('returns 200 with { data } envelope containing the project board', async () => {
    const res = await getJson(app, `/api/projects/${PROJECT_ID}/board`);

    expect(res.status).toBe(200);

    const json = (await res.json()) as { data: typeof mockBoard };

    expect(json.data.projectId).toBe(PROJECT_ID);
    expect(json.data.columns).toHaveLength(1);
  });

  it('returns 404 when the board does not exist', async () => {
    const res = await getJson(app, '/api/projects/missing-project/board');

    expect(res.status).toBe(404);

    const json = (await res.json()) as { error: { code: string } };

    expect(json.error.code).toBe('NOT_FOUND');
  });

  it('returns 401 without an Authorization header', async () => {
    const authApp = createAuthTestApp();
    const res = await getJson(authApp, `/api/projects/${PROJECT_ID}/board`);

    expect(res.status).toBe(401);
  });
});

// ─── PATCH /api/projects/:projectId/board ────────────────────────────────────

describe('PATCH /api/projects/:projectId/board', () => {
  it('returns 200 with the updated board', async () => {
    const app = createTestApp();
    const res = await patchJson(app, `/api/projects/${PROJECT_ID}/board`, {
      columns: [{ statusIds: [VALID_UUID], position: 0 }],
    });

    expect(res.status).toBe(200);

    const json = (await res.json()) as { data: typeof mockBoard };

    expect(json.data.projectId).toBe(PROJECT_ID);
  });

  it('returns 400 for an empty columns array', async () => {
    const app = createTestApp();
    const res = await patchJson(app, `/api/projects/${PROJECT_ID}/board`, { columns: [] });

    expect(res.status).toBe(400);

    const body = (await res.json()) as { error: { code: string } };

    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 for a column without statusIds', async () => {
    const app = createTestApp();
    const res = await patchJson(app, `/api/projects/${PROJECT_ID}/board`, {
      columns: [{ statusIds: [], position: 0 }],
    });

    expect(res.status).toBe(400);
  });

  it('returns 400 for a non-uuid statusId', async () => {
    const app = createTestApp();
    const res = await patchJson(app, `/api/projects/${PROJECT_ID}/board`, {
      columns: [{ statusIds: ['not-a-uuid'], position: 0 }],
    });

    expect(res.status).toBe(400);
  });

  it('returns 400 for a missing body', async () => {
    const app = createTestApp();
    const res = await app.request(
      `/api/projects/${PROJECT_ID}/board`,
      { method: 'PATCH', headers: { 'Content-Type': 'application/json' } },
      TEST_ENV,
    );

    expect(res.status).toBe(400);
  });

  it('denies an EDITOR project role via the RBAC matrix (manage_boards)', async () => {
    const app = createTestApp('MEMBER', 'EDITOR');
    const res = await patchJson(app, `/api/projects/${PROJECT_ID}/board`, {
      columns: [{ statusIds: [VALID_UUID], position: 0 }],
    });

    expect(res.status).toBe(403);
  });

  it('denies a tenant MEMBER without a project role', async () => {
    const app = createTestApp('MEMBER', null);
    const res = await patchJson(app, `/api/projects/${PROJECT_ID}/board`, {
      columns: [{ statusIds: [VALID_UUID], position: 0 }],
    });

    expect(res.status).toBe(403);
  });

  it('allows a tenant ADMIN (RBAC bypass)', async () => {
    const app = createTestApp('ADMIN', null);
    const res = await patchJson(app, `/api/projects/${PROJECT_ID}/board`, {
      columns: [{ statusIds: [VALID_UUID], position: 0 }],
    });

    expect(res.status).toBe(200);
  });

  it('returns 401 without an Authorization header', async () => {
    const authApp = createAuthTestApp();
    const res = await patchJson(authApp, `/api/projects/${PROJECT_ID}/board`, {
      columns: [{ statusIds: [VALID_UUID], position: 0 }],
    });

    expect(res.status).toBe(401);
  });

  it('returns 401 for an invalid token', async () => {
    const authApp = createAuthTestApp();
    const res = await authApp.request(
      `/api/projects/${PROJECT_ID}/board`,
      {
        method: 'PATCH',
        headers: { Authorization: 'Bearer not-a-jwt', 'Content-Type': 'application/json' },
        body: JSON.stringify({ columns: [{ statusIds: [VALID_UUID], position: 0 }] }),
      },
      TEST_ENV,
    );

    expect(res.status).toBe(401);
  });
});

// ─── Removed multi-board routes must NOT exist ───────────────────────────────

describe('removed multi-board routes', () => {
  const app = createTestApp();
  const tokenPromise = sign({ sub: USER_ID, email: 't@t', exp: Math.floor(Date.now() / 1000) + 600 }, 'test-secret');

  it.each([
    ['GET', `/api/projects/${PROJECT_ID}/boards`],
    ['POST', `/api/projects/${PROJECT_ID}/boards`],
    ['GET', `/api/boards/board-1`],
    ['PATCH', `/api/boards/board-1`],
    ['DELETE', `/api/boards/board-1`],
  ] as const)('%s %s is gone (404, not handled by board routes)', async (method, path) => {
    const token = await tokenPromise;
    const res = await app.request(
      path,
      {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: method === 'GET' || method === 'DELETE' ? undefined : JSON.stringify({ name: 'X' }),
      },
      TEST_ENV,
    );

    expect(res.status).toBe(404);
  });
});
