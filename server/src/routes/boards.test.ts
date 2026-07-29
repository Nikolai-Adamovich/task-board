/**
 * Tests for board CRUD HTTP routes.
 *
 * Validates that the endpoints correctly enforce Zod schema validation
 * and return proper HTTP status codes and error responses.
 */
import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { createBoardRoutes } from './boards.js';
import { errorHandler } from '../middleware/error-handler.js';
import type { AppEnv } from '../types/context.js';

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('../db/mongo.js', () => ({
  getCollection: vi.fn(() => ({})),
}));

const mockBoard = {
  id: '550e8400-e29b-41d4-a716-446655440020',
  tenantId: '550e8400-e29b-41d4-a716-446655440000',
  projectId: '550e8400-e29b-41d4-a716-446655440010',
  name: 'Test Board',
  description: 'A test board',
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};
const mockColumn = {
  id: '550e8400-e29b-41d4-a716-446655440021',
  boardId: '550e8400-e29b-41d4-a716-446655440020',
  tenantId: '550e8400-e29b-41d4-a716-446655440000',
  name: 'To Do',
  position: 0,
  isDefault: true,
  createdAt: '2025-01-01T00:00:00.000Z',
};

vi.mock('../services/board.service.js', () => ({
  BoardService: vi.fn().mockImplementation(() => ({
    listBoards: vi.fn().mockResolvedValue([mockBoard]),
    createBoard: vi.fn().mockResolvedValue({ board: mockBoard, columns: [mockColumn] }),
    getBoard: vi.fn().mockResolvedValue({ board: mockBoard, columns: [mockColumn] }),
    updateBoard: vi.fn().mockResolvedValue(mockBoard),
    deleteBoard: vi.fn().mockResolvedValue(undefined),
  })),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TEST_ENV = { JWT_SECRET: 'test-secret', MONGODB_URI: '', ALLOWED_ORIGINS: '*' };

function createTestApp() {
  const app = new Hono<AppEnv>();

  app.onError(errorHandler);

  app.use('/api/v1/*', async (c, next) => {
    c.set('userId', '550e8400-e29b-41d4-a716-446655440002');
    c.set('tenantId', '550e8400-e29b-41d4-a716-446655440000');
    c.set('userRole', 'owner');
    await next();
  });

  app.route('/api/v1/boards', createBoardRoutes());

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

// ─── GET /api/v1/boards ──────────────────────────────────────────────────────

describe('GET /api/v1/boards', () => {
  const app = createTestApp();

  it('should return 200 with boards when projectId is provided', async () => {
    const res = await getJson(app, '/api/v1/boards?projectId=550e8400-e29b-41d4-a716-446655440010');

    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, unknown>;

    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('total');
  });

  it('should return 422 when projectId is missing', async () => {
    const res = await getJson(app, '/api/v1/boards');

    expect(res.status).toBe(422);

    const body = (await res.json()) as Record<string, unknown>;

    expect(body.code).toBe('VALIDATION_ERROR');
  });
});

// ─── POST /api/v1/boards ─────────────────────────────────────────────────────

describe('POST /api/v1/boards', () => {
  const app = createTestApp();
  const projectId = '550e8400-e29b-41d4-a716-446655440010';

  it('should return 201 for valid board creation', async () => {
    const res = await postJson(app, `/api/v1/boards?projectId=${projectId}`, { name: 'New Board' });

    expect(res.status).toBe(201);
  });

  it('should return 201 with description and columnNames', async () => {
    const res = await postJson(app, `/api/v1/boards?projectId=${projectId}`, {
      name: 'New Board',
      description: 'Board description',
      columnNames: ['To Do', 'In Progress', 'Done'],
    });

    expect(res.status).toBe(201);
  });

  it('should return 422 when projectId is missing', async () => {
    const res = await postJson(app, '/api/v1/boards', { name: 'New Board' });

    expect(res.status).toBe(422);
  });

  // ── Name validation ──────────────────────────────────────────────────────

  it('should return 422 for empty name', async () => {
    const res = await postJson(app, `/api/v1/boards?projectId=${projectId}`, { name: '' });

    expect(res.status).toBe(422);

    const body = (await res.json()) as Record<string, unknown>;

    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('should return 422 for name exceeding 100 chars', async () => {
    const res = await postJson(app, `/api/v1/boards?projectId=${projectId}`, { name: 'a'.repeat(101) });

    expect(res.status).toBe(422);
  });

  it('should accept name at maximum boundary (100 chars)', async () => {
    const res = await postJson(app, `/api/v1/boards?projectId=${projectId}`, { name: 'a'.repeat(100) });

    expect(res.status).toBe(201);
  });

  // ── Missing fields ──────────────────────────────────────────────────────

  it('should return 422 for missing body', async () => {
    const res = await postJson(app, `/api/v1/boards?projectId=${projectId}`, {});

    expect(res.status).toBe(422);
  });

  it('should return 422 for invalid JSON body', async () => {
    const res = await app.request(
      `/api/v1/boards?projectId=${projectId}`,
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

// ─── GET /api/v1/boards/:boardId ─────────────────────────────────────────────

describe('GET /api/v1/boards/:boardId', () => {
  const app = createTestApp();

  it('should return 200 for a valid board ID', async () => {
    const res = await getJson(app, '/api/v1/boards/550e8400-e29b-41d4-a716-446655440020');

    expect(res.status).toBe(200);
  });
});

// ─── PATCH /api/v1/boards/:boardId ───────────────────────────────────────────

describe('PATCH /api/v1/boards/:boardId', () => {
  const app = createTestApp();

  it('should return 200 for valid partial update', async () => {
    const res = await patchJson(app, '/api/v1/boards/550e8400-e29b-41d4-a716-446655440020', {
      name: 'Updated Board',
    });

    expect(res.status).toBe(200);
  });

  it('should return 200 for empty body (no-op update)', async () => {
    const res = await patchJson(app, '/api/v1/boards/550e8400-e29b-41d4-a716-446655440020', {});

    expect(res.status).toBe(200);
  });

  it('should return 422 for empty name in update', async () => {
    const res = await patchJson(app, '/api/v1/boards/550e8400-e29b-41d4-a716-446655440020', {
      name: '',
    });

    expect(res.status).toBe(422);
  });

  it('should return 422 for invalid JSON body', async () => {
    const res = await app.request(
      '/api/v1/boards/550e8400-e29b-41d4-a716-446655440020',
      {
        method: 'PATCH',
        body: 'not json',
        headers: { 'Content-Type': 'application/json' },
      },
      TEST_ENV,
    );

    expect(res.status).toBe(422);
  });
});

// ─── DELETE /api/v1/boards/:boardId ──────────────────────────────────────────

describe('DELETE /api/v1/boards/:boardId', () => {
  const app = createTestApp();

  it('should return 200 with success flag', async () => {
    const res = await deleteJson(app, '/api/v1/boards/550e8400-e29b-41d4-a716-446655440020');

    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, unknown>;

    expect(body.success).toBe(true);
  });
});
