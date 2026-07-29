/**
 * Tests for task CRUD, move, and assign HTTP routes.
 *
 * Validates that the endpoints correctly enforce Zod schema validation
 * and return proper HTTP status codes and error responses.
 */
import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { createTaskRoutes } from './tasks.js';
import { errorHandler } from '../middleware/error-handler.js';
import type { AppEnv } from '../types/context.js';

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('../db/mongo.js', () => ({
  getCollection: vi.fn(() => ({})),
}));

const mockTask = {
  id: '550e8400-e29b-41d4-a716-446655440040',
  tenantId: '550e8400-e29b-41d4-a716-446655440000',
  projectId: '550e8400-e29b-41d4-a716-446655440010',
  boardId: '550e8400-e29b-41d4-a716-446655440020',
  columnId: '550e8400-e29b-41d4-a716-446655440030',
  sprintId: null,
  title: 'Test Task',
  description: 'A test task',
  assigneeIds: [],
  priority: 'medium',
  position: 0,
  createdBy: '550e8400-e29b-41d4-a716-446655440002',
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

vi.mock('../services/task.service.js', () => ({
  TaskService: vi.fn().mockImplementation(() => ({
    listTasks: vi.fn().mockResolvedValue({
      data: [mockTask],
      total: 1,
      page: 1,
      limit: 20,
    }),
    createTask: vi.fn().mockResolvedValue(mockTask),
    getTask: vi.fn().mockResolvedValue(mockTask),
    updateTask: vi.fn().mockResolvedValue(mockTask),
    deleteTask: vi.fn().mockResolvedValue(undefined),
    moveTask: vi.fn().mockResolvedValue(mockTask),
    assignTask: vi.fn().mockResolvedValue(mockTask),
  })),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TEST_ENV = { JWT_SECRET: 'test-secret', MONGODB_URI: '', ALLOWED_ORIGINS: '*' };
const VALID_UUID = '550e8400-e29b-41d4-a716-446655440002';
const TASK_ID = '550e8400-e29b-41d4-a716-446655440040';
const PROJECT_ID = '550e8400-e29b-41d4-a716-446655440010';
const BOARD_ID = '550e8400-e29b-41d4-a716-446655440020';
const COLUMN_ID = '550e8400-e29b-41d4-a716-446655440030';

function createTestApp() {
  const app = new Hono<AppEnv>();

  app.onError(errorHandler);

  app.use('/api/v1/*', async (c, next) => {
    c.set('userId', VALID_UUID);
    c.set('tenantId', '550e8400-e29b-41d4-a716-446655440000');
    c.set('userRole', 'owner');
    await next();
  });

  app.route('/api/v1/tasks', createTaskRoutes());

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

// ─── GET /api/v1/tasks ───────────────────────────────────────────────────────

describe('GET /api/v1/tasks', () => {
  const app = createTestApp();

  it('should return 200 with a list of tasks', async () => {
    const res = await getJson(app, '/api/v1/tasks');

    expect(res.status).toBe(200);
  });

  it('should return 200 with filter query parameters', async () => {
    const res = await getJson(
      app,
      `/api/v1/tasks?projectId=${PROJECT_ID}&boardId=${BOARD_ID}&columnId=${COLUMN_ID}&page=1&limit=10`,
    );

    expect(res.status).toBe(200);
  });
});

// ─── POST /api/v1/tasks ──────────────────────────────────────────────────────

describe('POST /api/v1/tasks', () => {
  const app = createTestApp();
  const validBody = {
    title: 'New Task',
    description: 'Task description',
    projectId: PROJECT_ID,
    boardId: BOARD_ID,
    columnId: COLUMN_ID,
    priority: 'medium',
    assigneeIds: [VALID_UUID],
  };

  it('should return 201 for valid task creation', async () => {
    const res = await postJson(app, '/api/v1/tasks', validBody);

    expect(res.status).toBe(201);
  });

  it('should return 201 with minimal required fields', async () => {
    const res = await postJson(app, '/api/v1/tasks', {
      title: 'New Task',
      projectId: PROJECT_ID,
      boardId: BOARD_ID,
      columnId: COLUMN_ID,
    });

    expect(res.status).toBe(201);
  });

  // ── Title validation ─────────────────────────────────────────────────────

  it('should return 422 for empty title', async () => {
    const res = await postJson(app, '/api/v1/tasks', { ...validBody, title: '' });

    expect(res.status).toBe(422);

    const body = (await res.json()) as Record<string, unknown>;

    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('should return 422 for title exceeding 200 chars', async () => {
    const res = await postJson(app, '/api/v1/tasks', { ...validBody, title: 'a'.repeat(201) });

    expect(res.status).toBe(422);
  });

  it('should accept title at maximum boundary (200 chars)', async () => {
    const res = await postJson(app, '/api/v1/tasks', { ...validBody, title: 'a'.repeat(200) });

    expect(res.status).toBe(201);
  });

  // ── UUID field validation ────────────────────────────────────────────────

  it('should return 422 for invalid projectId', async () => {
    const res = await postJson(app, '/api/v1/tasks', { ...validBody, projectId: 'not-a-uuid' });

    expect(res.status).toBe(422);
  });

  it('should return 422 for invalid boardId', async () => {
    const res = await postJson(app, '/api/v1/tasks', { ...validBody, boardId: 'not-a-uuid' });

    expect(res.status).toBe(422);
  });

  it('should return 422 for invalid columnId', async () => {
    const res = await postJson(app, '/api/v1/tasks', { ...validBody, columnId: 'not-a-uuid' });

    expect(res.status).toBe(422);
  });

  // ── Priority validation ──────────────────────────────────────────────────

  it.each(['low', 'medium', 'high', 'critical'])('should accept priority: %s', async (priority) => {
    const res = await postJson(app, '/api/v1/tasks', { ...validBody, priority });

    expect(res.status).toBe(201);
  });

  it('should return 422 for invalid priority', async () => {
    const res = await postJson(app, '/api/v1/tasks', { ...validBody, priority: 'invalid' });

    expect(res.status).toBe(422);
  });

  // ── Missing fields ──────────────────────────────────────────────────────

  it('should return 422 for missing body', async () => {
    const res = await postJson(app, '/api/v1/tasks', {});

    expect(res.status).toBe(422);
  });

  it('should return 422 for missing title', async () => {
    const res = await postJson(app, '/api/v1/tasks', {
      projectId: PROJECT_ID,
      boardId: BOARD_ID,
      columnId: COLUMN_ID,
    });

    expect(res.status).toBe(422);
  });

  it('should return 422 for missing projectId', async () => {
    const res = await postJson(app, '/api/v1/tasks', {
      title: 'New Task',
      boardId: BOARD_ID,
      columnId: COLUMN_ID,
    });

    expect(res.status).toBe(422);
  });

  it('should return 422 for invalid JSON body', async () => {
    const res = await app.request(
      '/api/v1/tasks',
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

// ─── GET /api/v1/tasks/:taskId ───────────────────────────────────────────────

describe('GET /api/v1/tasks/:taskId', () => {
  const app = createTestApp();

  it('should return 200 for a valid task ID', async () => {
    const res = await getJson(app, `/api/v1/tasks/${TASK_ID}`);

    expect(res.status).toBe(200);
  });
});

// ─── PATCH /api/v1/tasks/:taskId ─────────────────────────────────────────────

describe('PATCH /api/v1/tasks/:taskId', () => {
  const app = createTestApp();

  it('should return 200 for valid partial update', async () => {
    const res = await patchJson(app, `/api/v1/tasks/${TASK_ID}`, {
      title: 'Updated Task',
    });

    expect(res.status).toBe(200);
  });

  it('should return 200 for empty body (no-op update)', async () => {
    const res = await patchJson(app, `/api/v1/tasks/${TASK_ID}`, {});

    expect(res.status).toBe(200);
  });

  it('should return 422 for empty title in update', async () => {
    const res = await patchJson(app, `/api/v1/tasks/${TASK_ID}`, {
      title: '',
    });

    expect(res.status).toBe(422);
  });

  it('should return 422 for title exceeding 200 chars in update', async () => {
    const res = await patchJson(app, `/api/v1/tasks/${TASK_ID}`, {
      title: 'a'.repeat(201),
    });

    expect(res.status).toBe(422);
  });

  it('should return 422 for invalid priority in update', async () => {
    const res = await patchJson(app, `/api/v1/tasks/${TASK_ID}`, {
      priority: 'invalid',
    });

    expect(res.status).toBe(422);
  });

  it('should return 422 for invalid JSON body', async () => {
    const res = await app.request(
      `/api/v1/tasks/${TASK_ID}`,
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

// ─── DELETE /api/v1/tasks/:taskId ────────────────────────────────────────────

describe('DELETE /api/v1/tasks/:taskId', () => {
  const app = createTestApp();

  it('should return 200 with success flag', async () => {
    const res = await deleteJson(app, `/api/v1/tasks/${TASK_ID}`);

    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, unknown>;

    expect(body.success).toBe(true);
  });
});

// ─── PATCH /api/v1/tasks/:taskId/move ────────────────────────────────────────

describe('PATCH /api/v1/tasks/:taskId/move', () => {
  const app = createTestApp();
  const targetColumnId = '550e8400-e29b-41d4-a716-446655440031';

  it('should return 200 for valid move', async () => {
    const res = await patchJson(app, `/api/v1/tasks/${TASK_ID}/move`, {
      taskId: TASK_ID,
      targetColumnId,
    });

    expect(res.status).toBe(200);
  });

  it('should return 200 for move with target sprint', async () => {
    const res = await patchJson(app, `/api/v1/tasks/${TASK_ID}/move`, {
      taskId: TASK_ID,
      targetColumnId,
      targetSprintId: '550e8400-e29b-41d4-a716-446655440050',
    });

    expect(res.status).toBe(200);
  });

  it('should return 422 for missing targetColumnId', async () => {
    const res = await patchJson(app, `/api/v1/tasks/${TASK_ID}/move`, {
      taskId: TASK_ID,
    });

    expect(res.status).toBe(422);
  });

  it('should return 422 for invalid targetColumnId', async () => {
    const res = await patchJson(app, `/api/v1/tasks/${TASK_ID}/move`, {
      taskId: TASK_ID,
      targetColumnId: 'not-a-uuid',
    });

    expect(res.status).toBe(422);
  });

  it('should return 422 for invalid JSON body', async () => {
    const res = await app.request(
      `/api/v1/tasks/${TASK_ID}/move`,
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

// ─── PATCH /api/v1/tasks/:taskId/assign ──────────────────────────────────────

describe('PATCH /api/v1/tasks/:taskId/assign', () => {
  const app = createTestApp();

  it('should return 200 for valid assign', async () => {
    const res = await patchJson(app, `/api/v1/tasks/${TASK_ID}/assign`, {
      taskId: TASK_ID,
      assigneeIds: [VALID_UUID],
    });

    expect(res.status).toBe(200);
  });

  it('should return 200 for unassign (empty assigneeIds)', async () => {
    const res = await patchJson(app, `/api/v1/tasks/${TASK_ID}/assign`, {
      taskId: TASK_ID,
      assigneeIds: [],
    });

    expect(res.status).toBe(200);
  });

  it('should return 422 for missing assigneeIds', async () => {
    const res = await patchJson(app, `/api/v1/tasks/${TASK_ID}/assign`, {
      taskId: TASK_ID,
    });

    expect(res.status).toBe(422);
  });

  it('should return 422 for invalid UUID in assigneeIds', async () => {
    const res = await patchJson(app, `/api/v1/tasks/${TASK_ID}/assign`, {
      taskId: TASK_ID,
      assigneeIds: ['not-a-uuid'],
    });

    expect(res.status).toBe(422);
  });

  it('should return 422 for invalid JSON body', async () => {
    const res = await app.request(
      `/api/v1/tasks/${TASK_ID}/assign`,
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
