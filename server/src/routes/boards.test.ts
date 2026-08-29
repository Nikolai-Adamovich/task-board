/**
 * Tests for board CRUD HTTP routes.
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
  id: 'board-1',
  projectId: PROJECT_ID,
  name: 'Main Board',
  type: 'KANBAN',
  columns: [{ id: 'col-1', statusIds: ['status-1'], position: 0 }],
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

vi.mock('../services/board.service.js', () => ({
  BoardService: vi.fn().mockImplementation(() => ({
    getBoardsByProject: vi.fn().mockResolvedValue([mockBoard]),
    createBoard: vi.fn().mockResolvedValue(mockBoard),
    getBoard: vi
      .fn()
      .mockImplementation((id: string) =>
        id === 'missing-board' ? Promise.reject(new NotFoundError('Board not found')) : Promise.resolve(mockBoard),
      ),
    updateBoard: vi.fn().mockResolvedValue(mockBoard),
    deleteBoard: vi
      .fn()
      .mockImplementation((id: string) =>
        id === 'missing-board' ? Promise.reject(new NotFoundError('Board not found')) : Promise.resolve(undefined),
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

async function deleteJson(app: Hono<AppEnv>, path: string) {
  return app.request(path, { method: 'DELETE' }, TEST_ENV);
}

const STATUS_ID = '550e8400-e29b-41d4-a716-446655440091';
const validCreateBody = {
  name: 'Sprint Board',
  type: 'KANBAN',
  columns: [{ statusIds: [STATUS_ID], position: 0 }],
};

// ─── GET /api/projects/:projectId/boards ─────────────────────────────────────

describe('GET /api/projects/:projectId/boards', () => {
  const app = createTestApp();

  it('returns 200 with { data } envelope containing boards', async () => {
    const res = await getJson(app, `/api/projects/${PROJECT_ID}/boards`);

    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, unknown>;

    expect(body).toHaveProperty('data');
    expect(Array.isArray(body.data)).toBe(true);
    expect((body.data as { name: string }[])[0].name).toBe('Main Board');
  });
});

// ─── POST /api/projects/:projectId/boards ────────────────────────────────────

describe('POST /api/projects/:projectId/boards', () => {
  it('returns 201 with the created board for an owner', async () => {
    const app = createTestApp('OWNER');
    const res = await postJson(app, `/api/projects/${PROJECT_ID}/boards`, validCreateBody);

    expect(res.status).toBe(201);

    const body = (await res.json()) as Record<string, unknown>;

    expect(body).toHaveProperty('data');
    expect((body.data as { name: string }).name).toBe('Main Board');
  });

  it('returns 201 for a project admin (project-level permission)', async () => {
    const app = createTestApp('MEMBER', 'PROJECT_ADMIN');
    const res = await postJson(app, `/api/projects/${PROJECT_ID}/boards`, validCreateBody);

    expect(res.status).toBe(201);
  });

  it('returns 403 for a member without a project role (requirePermission gate)', async () => {
    const app = createTestApp('MEMBER', null);
    const res = await postJson(app, `/api/projects/${PROJECT_ID}/boards`, validCreateBody);

    expect(res.status).toBe(403);

    const body = (await res.json()) as { error: { code: string } };

    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('returns 400 with error envelope for an invalid body', async () => {
    const app = createTestApp('OWNER');
    const res = await postJson(app, `/api/projects/${PROJECT_ID}/boards`, { name: '', type: 'KANBAN', columns: [] });

    expect(res.status).toBe(400);

    const body = (await res.json()) as { error: { code: string; details: unknown } };

    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details).toBeDefined();
  });
});

// ─── GET /api/boards/:boardId ────────────────────────────────────────────────

describe('GET /api/boards/:boardId', () => {
  const app = createTestApp();

  it('returns 200 with the board', async () => {
    const res = await getJson(app, '/api/boards/board-1');

    expect(res.status).toBe(200);

    const body = (await res.json()) as { data: { id: string } };

    expect(body.data.id).toBe('board-1');
  });

  it('returns 404 with error envelope when the board does not exist', async () => {
    const res = await getJson(app, '/api/boards/missing-board');

    expect(res.status).toBe(404);

    const body = (await res.json()) as { error: { code: string } };

    expect(body.error.code).toBe('NOT_FOUND');
  });
});

// ─── PATCH /api/boards/:boardId ──────────────────────────────────────────────

describe('PATCH /api/boards/:boardId', () => {
  const app = createTestApp();

  it('returns 200 with the updated board', async () => {
    const res = await patchJson(app, '/api/boards/board-1', { name: 'Renamed Board' });

    expect(res.status).toBe(200);

    const body = (await res.json()) as { data: { name: string } };

    expect(body.data.name).toBe('Main Board');
  });

  it('returns 400 for an invalid body (empty name)', async () => {
    const res = await patchJson(app, '/api/boards/board-1', { name: '' });

    expect(res.status).toBe(400);

    const body = (await res.json()) as { error: { code: string } };

    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});

// ─── DELETE /api/boards/:boardId ─────────────────────────────────────────────

describe('DELETE /api/boards/:boardId', () => {
  const app = createTestApp();

  it('returns 200 with success envelope', async () => {
    const res = await deleteJson(app, '/api/boards/board-1');

    expect(res.status).toBe(200);

    const body = (await res.json()) as { data: { success: boolean } };

    expect(body.data.success).toBe(true);
  });

  it('returns 404 when the board does not exist', async () => {
    const res = await deleteJson(app, '/api/boards/missing-board');

    expect(res.status).toBe(404);

    const body = (await res.json()) as { error: { code: string } };

    expect(body.error.code).toBe('NOT_FOUND');
  });
});

// ─── Auth (401) ──────────────────────────────────────────────────────────────

describe('auth', () => {
  it('returns 401 with error envelope when no Authorization header is present', async () => {
    const app = createAuthTestApp();
    const res = await getJson(app, `/api/projects/${PROJECT_ID}/boards`);

    expect(res.status).toBe(401);

    const body = (await res.json()) as { error: { code: string } };

    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 for an invalid token', async () => {
    const app = createAuthTestApp();
    const res = await app.request(
      `/api/projects/${PROJECT_ID}/boards`,
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
      `/api/projects/${PROJECT_ID}/boards`,
      { method: 'GET', headers: { Authorization: `Bearer ${token}` } },
      TEST_ENV,
    );

    expect(res.status).toBe(200);
  });
});
