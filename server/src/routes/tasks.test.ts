/**
 * Tests for task HTTP routes — focused on the Q10 (RQ-04 ③) bulk-update
 * endpoint PATCH /projects/:projectId/tasks/bulk.
 */
import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { createTaskRoutes } from './tasks.js';
import { TaskService } from '../services/task.service.js';
import { errorHandler } from '../middleware/error-handler.js';
import { ForbiddenError, NotFoundError } from '../errors/app-error.js';
import type { AppEnv } from '../types/context.js';

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('../db/mongo.js', () => ({
  getCollection: vi.fn().mockReturnValue({
    findOne: vi.fn(),
    find: vi.fn(),
    insertOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
    deleteOne: vi.fn(),
    updateMany: vi.fn(),
    countDocuments: vi.fn(),
  }),
}));

vi.mock('../services/task.service.js', () => ({
  TaskService: vi.fn(),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TEST_ENV = { JWT_SECRET: 'test-secret', MONGODB_URI: '', ALLOWED_ORIGINS: '*' };
const USER_ID = '550e8400-e29b-41d4-a716-446655440002';
const PROJECT_ID = '550e8400-e29b-41d4-a716-446655440010';

function createTestApp(
  tenantRole = 'MEMBER',
  bulkImpl?: (...args: unknown[]) => unknown,
  tasksOverride?: Record<string, unknown>,
) {
  const bulkUpdateTasks = vi.fn(bulkImpl ?? (() => Promise.resolve({ updated: 1 })));

  // NOTE: plain `function` (not an arrow) — the mock is constructed with
  // `new` below, and vitest only supports `new` on function implementations.
  // eslint-disable-next-line prefer-arrow-callback -- the mock is constructed with `new`, which requires a function implementation.
  (TaskService as unknown as ReturnType<typeof vi.fn>).mockImplementation(function mockTasksService() {
    return tasksOverride ?? { bulkUpdateTasks };
  });

  const app = new Hono<AppEnv>();

  app.onError(errorHandler);

  app.use('/api/*', async (c, next) => {
    c.set('userId', USER_ID);
    c.set('tenantId', '550e8400-e29b-41d4-a716-446655440000');
    c.set('tenantRole', tenantRole as 'OWNER');

    const MockTasks = TaskService as unknown as new () => object;

    c.set('svc', { tasks: new MockTasks() } as never);
    await next();
  });
  app.route('/api', createTaskRoutes());

  return { app, bulkUpdateTasks };
}

function patchJson(app: Hono<AppEnv>, path: string, body: unknown) {
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

const VALID_UUIDS = [
  '550e8400-e29b-41d4-a716-446655440021',
  '550e8400-e29b-41d4-a716-446655440022',
  '550e8400-e29b-41d4-a716-446655440023',
];

// ─── Existing exports ────────────────────────────────────────────────────────

describe('Task Routes', () => {
  it('exports createTaskRoutes function', async () => {
    const mod = await import('./tasks.js');

    expect(typeof mod.createTaskRoutes).toBe('function');
  });
});

// ─── PATCH /api/projects/:projectId/tasks/bulk ───────────────────────────────

describe('PATCH /api/projects/:projectId/tasks/bulk', () => {
  it('returns 200 with { data: { updated } } on success and passes parsed body to the service', async () => {
    const { app, bulkUpdateTasks } = createTestApp('MEMBER', () => Promise.resolve({ updated: 2 }));
    const res = await patchJson(app, `/api/projects/${PROJECT_ID}/tasks/bulk`, {
      taskIds: VALID_UUIDS.slice(0, 2),
      data: { statusId: '550e8400-e29b-41d4-a716-446655440030' },
    });

    expect(res.status).toBe(200);

    const body = (await res.json()) as { data: { updated: number } };

    expect(body.data.updated).toBe(2);
    expect(bulkUpdateTasks).toHaveBeenCalledWith(
      PROJECT_ID,
      VALID_UUIDS.slice(0, 2),
      { statusId: '550e8400-e29b-41d4-a716-446655440030' },
      USER_ID,
      'MEMBER',
    );
  });

  it('reports per-task failures without failing the request (partial failure)', async () => {
    const { app } = createTestApp('MEMBER', () =>
      Promise.resolve({
        updated: 1,
        failed: [{ taskId: VALID_UUIDS[1], reason: 'TASK_NOT_IN_PROJECT' }],
      }),
    );
    const res = await patchJson(app, `/api/projects/${PROJECT_ID}/tasks/bulk`, {
      taskIds: [VALID_UUIDS[0], VALID_UUIDS[1]],
      data: { assigneeId: null },
    });

    expect(res.status).toBe(200);

    const body = (await res.json()) as { data: { updated: number; failed: { taskId: string; reason: string }[] } };

    expect(body.data.updated).toBe(1);
    expect(body.data.failed).toEqual([{ taskId: VALID_UUIDS[1], reason: 'TASK_NOT_IN_PROJECT' }]);
  });

  it('rejects an empty taskIds array with 400 VALIDATION_ERROR', async () => {
    const { app, bulkUpdateTasks } = createTestApp();
    const res = await patchJson(app, `/api/projects/${PROJECT_ID}/tasks/bulk`, {
      taskIds: [],
      data: { statusId: '550e8400-e29b-41d4-a716-446655440030' },
    });

    expect(res.status).toBe(400);

    const body = (await res.json()) as { error: { code: string } };

    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(bulkUpdateTasks).not.toHaveBeenCalled();
  });

  it('rejects more than 100 task ids with 400', async () => {
    const { app } = createTestApp();
    const manyIds = Array.from({ length: 101 }, (_, i) => `550e8400-e29b-41d4-a716-${String(i).padStart(12, '0')}`);
    const res = await patchJson(app, `/api/projects/${PROJECT_ID}/tasks/bulk`, {
      taskIds: manyIds,
      data: { sprintId: null },
    });

    expect(res.status).toBe(400);
  });

  it('rejects multiple data fields with 400 (exactly-one contract)', async () => {
    const { app, bulkUpdateTasks } = createTestApp();
    const res = await patchJson(app, `/api/projects/${PROJECT_ID}/tasks/bulk`, {
      taskIds: VALID_UUIDS,
      data: { statusId: '550e8400-e29b-41d4-a716-446655440030', assigneeId: USER_ID },
    });

    expect(res.status).toBe(400);

    const body = (await res.json()) as { error: { code: string; details?: { message?: string }[] } };

    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(JSON.stringify(body)).toContain('Exactly one');
    expect(bulkUpdateTasks).not.toHaveBeenCalled();
  });

  it('rejects zero data fields with 400', async () => {
    const { app, bulkUpdateTasks } = createTestApp();
    const res = await patchJson(app, `/api/projects/${PROJECT_ID}/tasks/bulk`, {
      taskIds: VALID_UUIDS,
      data: {},
    });

    expect(res.status).toBe(400);
    expect(bulkUpdateTasks).not.toHaveBeenCalled();
  });

  it('maps a service-level permission denial to 403 FORBIDDEN envelope', async () => {
    const { app } = createTestApp('VIEWER', () => Promise.reject(new ForbiddenError('Not allowed to edit tasks')));
    const res = await patchJson(app, `/api/projects/${PROJECT_ID}/tasks/bulk`, {
      taskIds: VALID_UUIDS,
      data: { statusId: '550e8400-e29b-41d4-a716-446655440030' },
    });

    expect(res.status).toBe(403);

    const body = (await res.json()) as { error: { code: string } };

    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('propagates unexpected service errors via the error handler', async () => {
    const { app } = createTestApp('MEMBER', () => Promise.reject(new NotFoundError('Project not found')));
    const res = await patchJson(app, `/api/projects/${PROJECT_ID}/tasks/bulk`, {
      taskIds: VALID_UUIDS,
      data: { statusId: '550e8400-e29b-41d4-a716-446655440030' },
    });

    expect(res.status).toBe(404);

    const body = (await res.json()) as { error: { code: string } };

    expect(body.error.code).toBe('NOT_FOUND');
  });
});

// ─── GET /api/projects/:projectId/tasks/status-summary (S-05) ────────────────

describe('GET /api/projects/:projectId/tasks/status-summary', () => {
  it('returns { data: [{ statusId, count }] } from a single service call', async () => {
    const getStatusSummary = vi.fn().mockResolvedValue([
      { statusId: 's1', count: 5 },
      { statusId: 's2', count: 2 },
    ]);
    const { app } = createTestApp('MEMBER', undefined, { getStatusSummary });
    const res = await app.request(`/api/projects/${PROJECT_ID}/tasks/status-summary`, {}, TEST_ENV);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      data: [
        { statusId: 's1', count: 5 },
        { statusId: 's2', count: 2 },
      ],
    });
    expect(getStatusSummary).toHaveBeenCalledWith(PROJECT_ID);
  });

  it('maps a service-level error to the error envelope', async () => {
    const getStatusSummary = vi.fn().mockRejectedValue(new NotFoundError('Project not found'));
    const { app } = createTestApp('MEMBER', undefined, { getStatusSummary });
    const res = await app.request(`/api/projects/${PROJECT_ID}/tasks/status-summary`, {}, TEST_ENV);

    expect(res.status).toBe(404);

    const json = (await res.json()) as { error: { code: string } };

    expect(json.error.code).toBe('NOT_FOUND');
  });
});

// ─── GET /api/projects/:projectId/tasks/board (board column pages) ───────────

describe('GET /api/projects/:projectId/tasks/board', () => {
  const COL_A = '550e8400-e29b-41d4-a716-4466554400a1';

  async function getBoard(app: Hono<AppEnv>, query: string) {
    return app.request(`/api/projects/${PROJECT_ID}/tasks/board${query}`, { method: 'GET' }, TEST_ENV);
  }

  it('returns { data: BoardPage } and forwards decoded cursors plus filters', async () => {
    const { encodeBoardCursor } = await import('@task-board/shared');
    const cursor = encodeBoardCursor({ priorityLevel: 2, number: 184 });
    const page = { [COL_A]: { tasks: [], hasMore: false, nextCursor: null } };
    const getBoardPages = vi.fn().mockResolvedValue(page);
    const { app } = createTestApp('MEMBER', undefined, { getBoardPages });
    const res = await getBoard(app, `?cursor.${COL_A}=${cursor}&priorityLevel=3`);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: page });
    expect(getBoardPages).toHaveBeenCalledWith(PROJECT_ID, {
      cursors: { [COL_A]: { priorityLevel: 2, number: 184 } },
      sprintId: undefined,
      assigneeId: undefined,
      priorityLevel: 3,
    });
  });

  it('loads every column on initial load (no cursor params)', async () => {
    const getBoardPages = vi.fn().mockResolvedValue({});
    const { app } = createTestApp('MEMBER', undefined, { getBoardPages });
    const res = await getBoard(app, '');

    expect(res.status).toBe(200);
    expect(getBoardPages).toHaveBeenCalledWith(PROJECT_ID, {
      cursors: {},
      sprintId: undefined,
      assigneeId: undefined,
      priorityLevel: undefined,
    });
  });

  it('rejects a malformed cursor with 400 without calling the service', async () => {
    const getBoardPages = vi.fn();
    const { app } = createTestApp('MEMBER', undefined, { getBoardPages });
    const res = await getBoard(app, `?cursor.${COL_A}=tampered!!!`);

    expect(res.status).toBe(400);

    const body = (await res.json()) as { error: { code: string } };

    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(getBoardPages).not.toHaveBeenCalled();
  });

  it('rejects a non-uuid column id with 400', async () => {
    const getBoardPages = vi.fn();
    const { app } = createTestApp('MEMBER', undefined, { getBoardPages });
    const res = await getBoard(app, '?cursor.not-a-column=abc');

    expect(res.status).toBe(400);
    expect(getBoardPages).not.toHaveBeenCalled();
  });
});
