/**
 * Tests for sprint CRUD and task association HTTP routes.
 *
 * Validates that the endpoints correctly enforce Zod schema validation
 * and return proper HTTP status codes and error responses.
 */
import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { createSprintRoutes } from './sprints.js';
import { errorHandler } from '../middleware/error-handler.js';
import type { AppEnv } from '../types/context.js';

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('../db/mongo.js', () => ({
  getCollection: vi.fn(() => ({})),
}));

const mockSprint = {
  id: '550e8400-e29b-41d4-a716-446655440050',
  tenantId: '550e8400-e29b-41d4-a716-446655440000',
  projectId: '550e8400-e29b-41d4-a716-446655440010',
  name: 'Sprint 1',
  startDate: '2025-01-01T00:00:00.000Z',
  endDate: '2025-01-15T00:00:00.000Z',
  goal: 'Complete feature X',
  status: 'planned',
  taskIds: [],
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

vi.mock('../services/sprint.service.js', () => ({
  SprintService: vi.fn().mockImplementation(() => ({
    listSprints: vi.fn().mockResolvedValue([mockSprint]),
    listAllSprints: vi.fn().mockResolvedValue([mockSprint]),
    createSprint: vi.fn().mockResolvedValue(mockSprint),
    getSprint: vi.fn().mockResolvedValue({ sprint: mockSprint, tasks: [] }),
    updateSprint: vi.fn().mockResolvedValue(mockSprint),
    deleteSprint: vi.fn().mockResolvedValue(undefined),
    addTaskToSprint: vi.fn().mockResolvedValue(mockSprint),
    removeTaskFromSprint: vi.fn().mockResolvedValue(mockSprint),
  })),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TEST_ENV = { JWT_SECRET: 'test-secret', MONGODB_URI: '', ALLOWED_ORIGINS: '*' };
const PROJECT_ID = '550e8400-e29b-41d4-a716-446655440010';
const SPRINT_ID = '550e8400-e29b-41d4-a716-446655440050';
const TASK_ID = '550e8400-e29b-41d4-a716-446655440040';

function createTestApp() {
  const app = new Hono<AppEnv>();

  app.onError(errorHandler);

  app.use('/api/v1/*', async (c, next) => {
    c.set('userId', '550e8400-e29b-41d4-a716-446655440002');
    c.set('tenantId', '550e8400-e29b-41d4-a716-446655440000');
    c.set('userRole', 'owner');
    await next();
  });

  app.route('/api/v1/sprints', createSprintRoutes());

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

// ─── GET /api/v1/sprints ─────────────────────────────────────────────────────

describe('GET /api/v1/sprints', () => {
  const app = createTestApp();

  it('should return 200 with sprints when projectId is provided', async () => {
    const res = await getJson(app, `/api/v1/sprints?projectId=${PROJECT_ID}`);

    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, unknown>;

    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('total');
  });

  it('should return all tenant sprints when projectId is omitted', async () => {
    const res = await getJson(app, '/api/v1/sprints');

    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, unknown>;

    expect(body.data).toBeDefined();
  });
});

// ─── POST /api/v1/sprints ────────────────────────────────────────────────────

describe('POST /api/v1/sprints', () => {
  const app = createTestApp();
  const validBody = {
    name: 'Sprint 1',
    startDate: '2025-01-01T00:00:00.000Z',
    endDate: '2025-01-15T00:00:00.000Z',
    goal: 'Complete feature X',
  };

  it('should return 201 for valid sprint creation', async () => {
    const res = await postJson(app, `/api/v1/sprints?projectId=${PROJECT_ID}`, validBody);

    expect(res.status).toBe(201);
  });

  it('should return 201 without optional goal', async () => {
    const res = await postJson(app, `/api/v1/sprints?projectId=${PROJECT_ID}`, {
      name: 'Sprint 1',
      startDate: '2025-01-01T00:00:00.000Z',
      endDate: '2025-01-15T00:00:00.000Z',
    });

    expect(res.status).toBe(201);
  });

  it('should return 422 when projectId is missing', async () => {
    const res = await postJson(app, '/api/v1/sprints', validBody);

    expect(res.status).toBe(422);
  });

  // ── Name validation ──────────────────────────────────────────────────────

  it('should return 422 for empty name', async () => {
    const res = await postJson(app, `/api/v1/sprints?projectId=${PROJECT_ID}`, {
      ...validBody,
      name: '',
    });

    expect(res.status).toBe(422);

    const body = (await res.json()) as Record<string, unknown>;

    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('should return 422 for name exceeding 100 chars', async () => {
    const res = await postJson(app, `/api/v1/sprints?projectId=${PROJECT_ID}`, {
      ...validBody,
      name: 'a'.repeat(101),
    });

    expect(res.status).toBe(422);
  });

  it('should accept name at maximum boundary (100 chars)', async () => {
    const res = await postJson(app, `/api/v1/sprints?projectId=${PROJECT_ID}`, {
      ...validBody,
      name: 'a'.repeat(100),
    });

    expect(res.status).toBe(201);
  });

  // ── Date validation ──────────────────────────────────────────────────────

  it('should return 422 for invalid startDate', async () => {
    const res = await postJson(app, `/api/v1/sprints?projectId=${PROJECT_ID}`, {
      ...validBody,
      startDate: 'not-a-date',
    });

    expect(res.status).toBe(422);
  });

  it('should return 422 for invalid endDate', async () => {
    const res = await postJson(app, `/api/v1/sprints?projectId=${PROJECT_ID}`, {
      ...validBody,
      endDate: 'not-a-date',
    });

    expect(res.status).toBe(422);
  });

  // ── Missing fields ──────────────────────────────────────────────────────

  it('should return 422 for missing body', async () => {
    const res = await postJson(app, `/api/v1/sprints?projectId=${PROJECT_ID}`, {});

    expect(res.status).toBe(422);
  });

  it('should return 422 for missing name', async () => {
    const res = await postJson(app, `/api/v1/sprints?projectId=${PROJECT_ID}`, {
      startDate: '2025-01-01T00:00:00.000Z',
      endDate: '2025-01-15T00:00:00.000Z',
    });

    expect(res.status).toBe(422);
  });

  it('should return 422 for missing startDate', async () => {
    const res = await postJson(app, `/api/v1/sprints?projectId=${PROJECT_ID}`, {
      name: 'Sprint 1',
      endDate: '2025-01-15T00:00:00.000Z',
    });

    expect(res.status).toBe(422);
  });

  it('should return 422 for missing endDate', async () => {
    const res = await postJson(app, `/api/v1/sprints?projectId=${PROJECT_ID}`, {
      name: 'Sprint 1',
      startDate: '2025-01-01T00:00:00.000Z',
    });

    expect(res.status).toBe(422);
  });

  it('should return 422 for invalid JSON body', async () => {
    const res = await app.request(
      `/api/v1/sprints?projectId=${PROJECT_ID}`,
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

// ─── GET /api/v1/sprints/:sprintId ───────────────────────────────────────────

describe('GET /api/v1/sprints/:sprintId', () => {
  const app = createTestApp();

  it('should return 200 for a valid sprint ID', async () => {
    const res = await getJson(app, `/api/v1/sprints/${SPRINT_ID}`);

    expect(res.status).toBe(200);
  });
});

// ─── PATCH /api/v1/sprints/:sprintId ─────────────────────────────────────────

describe('PATCH /api/v1/sprints/:sprintId', () => {
  const app = createTestApp();

  it('should return 200 for valid partial update', async () => {
    const res = await patchJson(app, `/api/v1/sprints/${SPRINT_ID}`, {
      name: 'Updated Sprint',
    });

    expect(res.status).toBe(200);
  });

  it('should return 200 for status update', async () => {
    const res = await patchJson(app, `/api/v1/sprints/${SPRINT_ID}`, {
      status: 'active',
    });

    expect(res.status).toBe(200);
  });

  it('should return 200 for empty body (no-op update)', async () => {
    const res = await patchJson(app, `/api/v1/sprints/${SPRINT_ID}`, {});

    expect(res.status).toBe(200);
  });

  it('should return 422 for empty name in update', async () => {
    const res = await patchJson(app, `/api/v1/sprints/${SPRINT_ID}`, {
      name: '',
    });

    expect(res.status).toBe(422);
  });

  it('should return 422 for invalid startDate in update', async () => {
    const res = await patchJson(app, `/api/v1/sprints/${SPRINT_ID}`, {
      startDate: 'not-a-date',
    });

    expect(res.status).toBe(422);
  });

  it('should return 422 for invalid status in update', async () => {
    const res = await patchJson(app, `/api/v1/sprints/${SPRINT_ID}`, {
      status: 'invalid-status',
    });

    expect(res.status).toBe(422);
  });

  it('should return 422 for invalid JSON body', async () => {
    const res = await app.request(
      `/api/v1/sprints/${SPRINT_ID}`,
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

// ─── DELETE /api/v1/sprints/:sprintId ────────────────────────────────────────

describe('DELETE /api/v1/sprints/:sprintId', () => {
  const app = createTestApp();

  it('should return 200 with success flag', async () => {
    const res = await deleteJson(app, `/api/v1/sprints/${SPRINT_ID}`);

    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, unknown>;

    expect(body.success).toBe(true);
  });
});

// ─── POST /api/v1/sprints/:sprintId/tasks ────────────────────────────────────

describe('POST /api/v1/sprints/:sprintId/tasks', () => {
  const app = createTestApp();

  it('should return 200 for valid task addition', async () => {
    const res = await postJson(app, `/api/v1/sprints/${SPRINT_ID}/tasks`, {
      taskId: TASK_ID,
    });

    expect(res.status).toBe(200);
  });

  it('should return 422 for missing taskId', async () => {
    const res = await postJson(app, `/api/v1/sprints/${SPRINT_ID}/tasks`, {});

    expect(res.status).toBe(422);

    const body = (await res.json()) as Record<string, unknown>;

    expect(body.code).toBe('VALIDATION_ERROR');
  });
});

// ─── DELETE /api/v1/sprints/:sprintId/tasks/:taskId ──────────────────────────

describe('DELETE /api/v1/sprints/:sprintId/tasks/:taskId', () => {
  const app = createTestApp();

  it('should return 200 for valid task removal', async () => {
    const res = await deleteJson(app, `/api/v1/sprints/${SPRINT_ID}/tasks/${TASK_ID}`);

    expect(res.status).toBe(200);
  });
});
