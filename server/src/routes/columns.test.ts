/**
 * Tests for column CRUD and reorder HTTP routes.
 *
 * Validates that the endpoints correctly enforce Zod schema validation
 * and return proper HTTP status codes and error responses.
 */
import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { createColumnRoutes } from './columns.js';
import { errorHandler } from '../middleware/error-handler.js';
import type { AppEnv } from '../types/context.js';

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('../db/mongo.js', () => ({
  getCollection: vi.fn(() => ({})),
}));

const mockColumn = {
  id: '550e8400-e29b-41d4-a716-446655440030',
  boardId: '550e8400-e29b-41d4-a716-446655440020',
  tenantId: '550e8400-e29b-41d4-a716-446655440000',
  name: 'To Do',
  position: 0,
  isDefault: true,
  createdAt: '2025-01-01T00:00:00.000Z',
};

vi.mock('../services/column.service.js', () => ({
  ColumnService: vi.fn().mockImplementation(() => ({
    listColumns: vi.fn().mockResolvedValue([mockColumn]),
    createColumn: vi.fn().mockResolvedValue(mockColumn),
    reorderColumns: vi.fn().mockResolvedValue([mockColumn]),
    updateColumn: vi.fn().mockResolvedValue(mockColumn),
    deleteColumn: vi.fn().mockResolvedValue(undefined),
  })),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TEST_ENV = { JWT_SECRET: 'test-secret', MONGODB_URI: '', ALLOWED_ORIGINS: '*' };
const BOARD_ID = '550e8400-e29b-41d4-a716-446655440020';
const COLUMN_ID = '550e8400-e29b-41d4-a716-446655440030';

function createTestApp() {
  const app = new Hono<AppEnv>();

  app.onError(errorHandler);

  app.use('/api/v1/*', async (c, next) => {
    c.set('userId', '550e8400-e29b-41d4-a716-446655440002');
    c.set('tenantId', '550e8400-e29b-41d4-a716-446655440000');
    c.set('userRole', 'owner');
    await next();
  });

  app.route(`/api/v1/boards/:boardId/columns`, createColumnRoutes());

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

// ─── GET /api/v1/boards/:boardId/columns ─────────────────────────────────────

describe('GET /api/v1/boards/:boardId/columns', () => {
  const app = createTestApp();

  it('should return 200 with a list of columns', async () => {
    const res = await getJson(app, `/api/v1/boards/${BOARD_ID}/columns`);

    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, unknown>;

    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('total');
  });
});

// ─── POST /api/v1/boards/:boardId/columns ────────────────────────────────────

describe('POST /api/v1/boards/:boardId/columns', () => {
  const app = createTestApp();

  it('should return 201 for valid column creation', async () => {
    const res = await postJson(app, `/api/v1/boards/${BOARD_ID}/columns`, {
      name: 'In Progress',
    });

    expect(res.status).toBe(201);
  });

  it('should return 201 with optional position', async () => {
    const res = await postJson(app, `/api/v1/boards/${BOARD_ID}/columns`, {
      name: 'In Progress',
      position: 1,
    });

    expect(res.status).toBe(201);
  });

  it('should accept name at maximum boundary (50 chars)', async () => {
    const res = await postJson(app, `/api/v1/boards/${BOARD_ID}/columns`, {
      name: 'a'.repeat(50),
    });

    expect(res.status).toBe(201);
  });

  // ── Name validation ──────────────────────────────────────────────────────

  it('should return 422 for empty name', async () => {
    const res = await postJson(app, `/api/v1/boards/${BOARD_ID}/columns`, { name: '' });

    expect(res.status).toBe(422);

    const body = (await res.json()) as Record<string, unknown>;

    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('should return 422 for name exceeding 50 chars', async () => {
    const res = await postJson(app, `/api/v1/boards/${BOARD_ID}/columns`, {
      name: 'a'.repeat(51),
    });

    expect(res.status).toBe(422);
  });

  // ── Missing fields ──────────────────────────────────────────────────────

  it('should return 422 for missing body', async () => {
    const res = await postJson(app, `/api/v1/boards/${BOARD_ID}/columns`, {});

    expect(res.status).toBe(422);
  });

  it('should return 422 for invalid JSON body', async () => {
    const res = await app.request(
      `/api/v1/boards/${BOARD_ID}/columns`,
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

// ─── PATCH /api/v1/boards/:boardId/columns/reorder ───────────────────────────

describe('PATCH /api/v1/boards/:boardId/columns/reorder', () => {
  const app = createTestApp();

  it('should return 200 for valid reorder', async () => {
    const res = await patchJson(app, `/api/v1/boards/${BOARD_ID}/columns/reorder`, {
      columnIds: [COLUMN_ID],
    });

    expect(res.status).toBe(200);
  });

  it('should return 422 for empty columnIds array', async () => {
    const res = await patchJson(app, `/api/v1/boards/${BOARD_ID}/columns/reorder`, {
      columnIds: [],
    });

    expect(res.status).toBe(422);
  });

  it('should return 422 for missing columnIds', async () => {
    const res = await patchJson(app, `/api/v1/boards/${BOARD_ID}/columns/reorder`, {});

    expect(res.status).toBe(422);
  });

  it('should return 422 for invalid UUID in columnIds', async () => {
    const res = await patchJson(app, `/api/v1/boards/${BOARD_ID}/columns/reorder`, {
      columnIds: ['not-a-uuid'],
    });

    expect(res.status).toBe(422);
  });
});

// ─── PATCH /api/v1/boards/:boardId/columns/:columnId ─────────────────────────

describe('PATCH /api/v1/boards/:boardId/columns/:columnId', () => {
  const app = createTestApp();

  it('should return 200 for valid partial update', async () => {
    const res = await patchJson(app, `/api/v1/boards/${BOARD_ID}/columns/${COLUMN_ID}`, {
      name: 'Updated Column',
    });

    expect(res.status).toBe(200);
  });

  it('should return 200 for updating position', async () => {
    const res = await patchJson(app, `/api/v1/boards/${BOARD_ID}/columns/${COLUMN_ID}`, {
      position: 2,
    });

    expect(res.status).toBe(200);
  });

  it('should return 200 for empty body (no-op update)', async () => {
    const res = await patchJson(app, `/api/v1/boards/${BOARD_ID}/columns/${COLUMN_ID}`, {});

    expect(res.status).toBe(200);
  });

  it('should return 422 for empty name in update', async () => {
    const res = await patchJson(app, `/api/v1/boards/${BOARD_ID}/columns/${COLUMN_ID}`, {
      name: '',
    });

    expect(res.status).toBe(422);
  });

  it('should return 422 for name exceeding 50 chars in update', async () => {
    const res = await patchJson(app, `/api/v1/boards/${BOARD_ID}/columns/${COLUMN_ID}`, {
      name: 'a'.repeat(51),
    });

    expect(res.status).toBe(422);
  });

  it('should return 422 for invalid JSON body', async () => {
    const res = await app.request(
      `/api/v1/boards/${BOARD_ID}/columns/${COLUMN_ID}`,
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

// ─── DELETE /api/v1/boards/:boardId/columns/:columnId ────────────────────────

describe('DELETE /api/v1/boards/:boardId/columns/:columnId', () => {
  const app = createTestApp();

  it('should return 200 with success flag', async () => {
    const res = await deleteJson(app, `/api/v1/boards/${BOARD_ID}/columns/${COLUMN_ID}`);

    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, unknown>;

    expect(body.success).toBe(true);
  });
});
