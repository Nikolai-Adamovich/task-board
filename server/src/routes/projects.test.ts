/**
 * Tests for project CRUD and member management HTTP routes.
 */
import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { createProjectRoutes } from './projects.js';
import { ProjectService } from '../services/project.service.js';
import { errorHandler } from '../middleware/error-handler.js';
import { ForbiddenError } from '../errors/app-error.js';
import type { AppEnv } from '../types/context.js';

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('../db/mongo.js', () => ({
  getCollection: vi.fn(() => ({
    insertOne: vi.fn(),
    findOne: vi.fn(),
    find: vi.fn(),
    findOneAndUpdate: vi.fn(),
    deleteOne: vi.fn(),
  })),
}));

const mockProject = {
  id: '550e8400-e29b-41d4-a716-446655440010',
  tenantId: '550e8400-e29b-41d4-a716-446655440000',
  key: 'TEST',
  name: 'Test Project',
  description: null,
  status: 'ACTIVE',
  defaultStatusId: 'status-1',
  archiveReason: null,
  deletionScheduledAt: null,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};
const mockProjectMember = {
  id: '550e8400-e29b-41d4-a716-446655440011',
  userId: '550e8400-e29b-41d4-a716-446655440002',
  projectId: '550e8400-e29b-41d4-a716-446655440010',
  role: 'PROJECT_ADMIN',
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

vi.mock('../services/project.service.js', () => ({
  ProjectService: vi.fn().mockImplementation(() => ({
    listProjects: vi.fn().mockResolvedValue([mockProject]),
    // Simulates the real service-level enforcement (requireTenantAdmin)
    createProject: vi
      .fn()
      .mockImplementation((_tenantId: string, _userId: string, userRole: string) =>
        userRole === 'OWNER' || userRole === 'ADMIN'
          ? Promise.resolve(mockProject)
          : Promise.reject(new ForbiddenError('Only owner or admin can perform this action')),
      ),
    getProject: vi.fn().mockResolvedValue(mockProject),
    updateProject: vi.fn().mockResolvedValue(mockProject),
    deleteProject: vi.fn().mockResolvedValue(undefined),
    archiveProject: vi.fn().mockResolvedValue(undefined),
    restoreProject: vi.fn().mockResolvedValue(undefined),
    cancelDeletion: vi.fn().mockResolvedValue(undefined),
    getProjectMembers: vi.fn().mockResolvedValue([mockProjectMember]),
    addMember: vi.fn().mockResolvedValue(mockProjectMember),
    updateMemberRole: vi.fn().mockResolvedValue(mockProjectMember),
    removeMember: vi.fn().mockResolvedValue(undefined),
  })),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TEST_ENV = { JWT_SECRET: 'test-secret', MONGODB_URI: '', ALLOWED_ORIGINS: '*' };
const VALID_UUID = '550e8400-e29b-41d4-a716-446655440002';

function createTestApp(tenantRole = 'OWNER') {
  const app = new Hono<AppEnv>();

  app.onError(errorHandler);

  app.use('/api/*', async (c, next) => {
    const MockProjects = ProjectService as unknown as new () => InstanceType<typeof ProjectService>;

    c.set('userId', VALID_UUID);
    c.set('tenantId', '550e8400-e29b-41d4-a716-446655440000');
    c.set('tenantRole', tenantRole as 'OWNER');
    c.set('svc', { projects: new MockProjects() } as never);
    await next();
  });

  app.route('/api/projects', createProjectRoutes());

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

// ─── GET /api/projects ────────────────────────────────────────────────────

describe('GET /api/projects', () => {
  const app = createTestApp();

  it('should return 200 with { data } envelope', async () => {
    const res = await getJson(app, '/api/projects');

    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, unknown>;

    expect(body).toHaveProperty('data');
    expect(Array.isArray(body.data)).toBe(true);
  });
});

// ─── POST /api/projects ───────────────────────────────────────────────────

describe('POST /api/projects', () => {
  const app = createTestApp();
  const validBody = { key: 'TEST', name: 'New Project', description: 'A new project' };

  it('should return 201 for valid project creation', async () => {
    const res = await postJson(app, '/api/projects', validBody);

    expect(res.status).toBe(201);
  });

  it('should return 201 without optional description', async () => {
    const res = await postJson(app, '/api/projects', { key: 'TEST', name: 'New Project' });

    expect(res.status).toBe(201);
  });

  // ── Key validation ──────────────────────────────────────────────────────

  it('should return 422 for missing key', async () => {
    const res = await postJson(app, '/api/projects', { name: 'New Project' });

    expect(res.status).toBe(400);
  });

  it('should return 422 for lowercase key', async () => {
    const res = await postJson(app, '/api/projects', { key: 'abc', name: 'New Project' });

    expect(res.status).toBe(400);
  });

  it('should return 422 for key starting with digit', async () => {
    const res = await postJson(app, '/api/projects', { key: '1ABC', name: 'New Project' });

    expect(res.status).toBe(400);
  });

  // ── Name validation ──────────────────────────────────────────────────────

  it('should return 422 for empty name', async () => {
    const res = await postJson(app, '/api/projects', { ...validBody, name: '' });

    expect(res.status).toBe(400);
  });

  it('should return 422 for name exceeding 200 chars', async () => {
    const res = await postJson(app, '/api/projects', { ...validBody, name: 'a'.repeat(201) });

    expect(res.status).toBe(400);
  });

  it('should return 422 for missing name', async () => {
    const res = await postJson(app, '/api/projects', { key: 'TEST' });

    expect(res.status).toBe(400);
  });
});

// ─── GET /api/projects/:projectId ─────────────────────────────────────────

describe('GET /api/projects/:projectId', () => {
  const app = createTestApp();

  it('should return 200 with { data } envelope', async () => {
    const res = await getJson(app, '/api/projects/550e8400-e29b-41d4-a716-446655440010');

    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, unknown>;

    expect(body).toHaveProperty('data');
  });
});

// ─── PATCH /api/projects/:projectId ───────────────────────────────────────

describe('PATCH /api/projects/:projectId', () => {
  const app = createTestApp();

  it('should return 200 for valid partial update', async () => {
    const res = await patchJson(app, '/api/projects/550e8400-e29b-41d4-a716-446655440010', {
      name: 'Updated Project',
    });

    expect(res.status).toBe(200);
  });

  it('should return 422 for empty name in update', async () => {
    const res = await patchJson(app, '/api/projects/550e8400-e29b-41d4-a716-446655440010', { name: '' });

    expect(res.status).toBe(400);
  });
});

// ─── DELETE /api/projects/:projectId ──────────────────────────────────────

describe('DELETE /api/projects/:projectId', () => {
  const app = createTestApp();

  it('should return 200 with { data } envelope', async () => {
    const res = await deleteJson(app, '/api/projects/550e8400-e29b-41d4-a716-446655440010');

    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, unknown>;

    expect(body).toHaveProperty('data');
  });
});

// ─── GET /api/projects/:projectId/members ─────────────────────────────────

describe('GET /api/projects/:projectId/members', () => {
  const app = createTestApp();

  it('should return 200 with { data } envelope', async () => {
    const res = await getJson(app, '/api/projects/550e8400-e29b-41d4-a716-446655440010/members');

    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, unknown>;

    expect(body).toHaveProperty('data');
    expect(Array.isArray(body.data)).toBe(true);
  });
});

// ─── POST /api/projects/:projectId/members ────────────────────────────────

describe('POST /api/projects/:projectId/members', () => {
  const app = createTestApp();

  it('should return 201 for valid member addition', async () => {
    const res = await postJson(app, '/api/projects/550e8400-e29b-41d4-a716-446655440010/members', {
      userId: VALID_UUID,
      role: 'EDITOR',
    });

    expect(res.status).toBe(201);
  });

  it('should return 422 for invalid role', async () => {
    const res = await postJson(app, '/api/projects/550e8400-e29b-41d4-a716-446655440010/members', {
      userId: VALID_UUID,
      role: 'invalid-role',
    });

    expect(res.status).toBe(400);
  });
});

// ─── DELETE /api/projects/:projectId/members/:memberUserId ────────────────

describe('DELETE /api/projects/:projectId/members/:memberUserId', () => {
  const app = createTestApp();

  it('should return 200 with { data } envelope', async () => {
    const res = await deleteJson(app, `/api/projects/550e8400-e29b-41d4-a716-446655440010/members/${VALID_UUID}`);

    expect(res.status).toBe(200);
  });
});

// ─── DEC-017: per-action authorization on projects routes ─────────────────

describe('DEC-017 per-action authorization', () => {
  it('allows MEMBER to list projects', async () => {
    const res = await getJson(createTestApp('MEMBER'), '/api/projects');

    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, unknown>;

    expect(body).toHaveProperty('data');
  });

  it('allows MEMBER to get a single project', async () => {
    const res = await getJson(createTestApp('MEMBER'), '/api/projects/550e8400-e29b-41d4-a716-446655440010');

    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, unknown>;

    expect(body).toHaveProperty('data');
  });

  it('allows MEMBER to list project members', async () => {
    const res = await getJson(createTestApp('MEMBER'), '/api/projects/550e8400-e29b-41d4-a716-446655440010/members');

    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, unknown>;

    expect(body).toHaveProperty('data');
  });

  it('denies MEMBER project creation with 403 (service-level check)', async () => {
    const res = await postJson(createTestApp('MEMBER'), '/api/projects', {
      key: 'TEST',
      name: 'New Project',
    });

    expect(res.status).toBe(403);

    const body = (await res.json()) as { error?: { code?: string } };

    expect(body.error?.code).toBe('FORBIDDEN');
  });

  it('still allows ADMIN project creation', async () => {
    const res = await postJson(createTestApp('ADMIN'), '/api/projects', {
      key: 'TEST',
      name: 'New Project',
    });

    expect(res.status).toBe(201);
  });
});
