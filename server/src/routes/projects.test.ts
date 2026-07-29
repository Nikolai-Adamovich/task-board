/**
 * Tests for project CRUD and member management HTTP routes.
 *
 * Validates that the endpoints correctly enforce Zod schema validation
 * and return proper HTTP status codes and error responses.
 */
import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { createProjectRoutes } from './projects.js';
import { errorHandler } from '../middleware/error-handler.js';
import type { AppEnv } from '../types/context.js';

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('../db/mongo.js', () => ({
  getCollection: vi.fn(() => ({})),
}));

const mockProject = {
  id: '550e8400-e29b-41d4-a716-446655440010',
  tenantId: '550e8400-e29b-41d4-a716-446655440000',
  name: 'Test Project',
  slug: 'test-project',
  description: 'A test project',
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};
const mockProjectMember = {
  id: '550e8400-e29b-41d4-a716-446655440011',
  userId: '550e8400-e29b-41d4-a716-446655440002',
  projectId: '550e8400-e29b-41d4-a716-446655440010',
  tenantId: '550e8400-e29b-41d4-a716-446655440000',
  role: 'admin',
  createdAt: '2025-01-01T00:00:00.000Z',
};

vi.mock('../services/project.service.js', () => ({
  ProjectService: vi.fn().mockImplementation(() => ({
    listProjects: vi.fn().mockResolvedValue([mockProject]),
    createProject: vi.fn().mockResolvedValue(mockProject),
    getProject: vi.fn().mockResolvedValue(mockProject),
    updateProject: vi.fn().mockResolvedValue(mockProject),
    deleteProject: vi.fn().mockResolvedValue(undefined),
    getProjectMembers: vi.fn().mockResolvedValue([mockProjectMember]),
    addMember: vi.fn().mockResolvedValue(mockProjectMember),
    updateMemberRole: vi.fn().mockResolvedValue(mockProjectMember),
    removeMember: vi.fn().mockResolvedValue(undefined),
  })),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TEST_ENV = { JWT_SECRET: 'test-secret', MONGODB_URI: '', ALLOWED_ORIGINS: '*' };
const VALID_UUID = '550e8400-e29b-41d4-a716-446655440002';

function createTestApp() {
  const app = new Hono<AppEnv>();

  app.onError(errorHandler);

  // Set tenant context (tenantContextMiddleware equivalent)
  app.use('/api/v1/*', async (c, next) => {
    c.set('userId', VALID_UUID);
    c.set('tenantId', '550e8400-e29b-41d4-a716-446655440000');
    c.set('userRole', 'owner');
    await next();
  });

  app.route('/api/v1/projects', createProjectRoutes());

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

// ─── GET /api/v1/projects ────────────────────────────────────────────────────

describe('GET /api/v1/projects', () => {
  const app = createTestApp();

  it('should return 200 with a list of projects', async () => {
    const res = await getJson(app, '/api/v1/projects');

    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, unknown>;

    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('total');
  });
});

// ─── POST /api/v1/projects ───────────────────────────────────────────────────

describe('POST /api/v1/projects', () => {
  const app = createTestApp();
  const validBody = { name: 'New Project', slug: 'new-project', description: 'A new project' };

  it('should return 201 for valid project creation', async () => {
    const res = await postJson(app, '/api/v1/projects', validBody);

    expect(res.status).toBe(201);
  });

  it('should return 201 without optional description', async () => {
    const res = await postJson(app, '/api/v1/projects', { name: 'New Project', slug: 'new-project' });

    expect(res.status).toBe(201);
  });

  // ── Name validation ──────────────────────────────────────────────────────

  it('should return 422 for empty name', async () => {
    const res = await postJson(app, '/api/v1/projects', { ...validBody, name: '' });

    expect(res.status).toBe(422);

    const body = (await res.json()) as Record<string, unknown>;

    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('should return 422 for name exceeding 100 chars', async () => {
    const res = await postJson(app, '/api/v1/projects', { ...validBody, name: 'a'.repeat(101) });

    expect(res.status).toBe(422);
  });

  // ── Slug validation ──────────────────────────────────────────────────────

  it('should return 422 for slug shorter than 2 chars', async () => {
    const res = await postJson(app, '/api/v1/projects', { ...validBody, slug: 'a' });

    expect(res.status).toBe(422);
  });

  it('should return 422 for slug with invalid characters', async () => {
    const res = await postJson(app, '/api/v1/projects', { ...validBody, slug: 'Invalid Slug!' });

    expect(res.status).toBe(422);
  });

  // ── Missing fields ──────────────────────────────────────────────────────

  it('should return 422 for missing body', async () => {
    const res = await postJson(app, '/api/v1/projects', {});

    expect(res.status).toBe(422);
  });

  it('should return 422 for missing name', async () => {
    const res = await postJson(app, '/api/v1/projects', { slug: 'new-project' });

    expect(res.status).toBe(422);
  });

  it('should return 422 for missing slug', async () => {
    const res = await postJson(app, '/api/v1/projects', { name: 'New Project' });

    expect(res.status).toBe(422);
  });

  it('should return 422 for invalid JSON body', async () => {
    const res = await app.request(
      '/api/v1/projects',
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

// ─── GET /api/v1/projects/:projectId ─────────────────────────────────────────

describe('GET /api/v1/projects/:projectId', () => {
  const app = createTestApp();

  it('should return 200 for a valid project ID', async () => {
    const res = await getJson(app, '/api/v1/projects/550e8400-e29b-41d4-a716-446655440010');

    expect(res.status).toBe(200);
  });
});

// ─── PATCH /api/v1/projects/:projectId ───────────────────────────────────────

describe('PATCH /api/v1/projects/:projectId', () => {
  const app = createTestApp();

  it('should return 200 for valid partial update', async () => {
    const res = await patchJson(app, '/api/v1/projects/550e8400-e29b-41d4-a716-446655440010', {
      name: 'Updated Project',
    });

    expect(res.status).toBe(200);
  });

  it('should return 200 for empty body (no-op update)', async () => {
    const res = await patchJson(app, '/api/v1/projects/550e8400-e29b-41d4-a716-446655440010', {});

    expect(res.status).toBe(200);
  });

  it('should return 422 for empty name in update', async () => {
    const res = await patchJson(app, '/api/v1/projects/550e8400-e29b-41d4-a716-446655440010', {
      name: '',
    });

    expect(res.status).toBe(422);
  });

  it('should return 422 for invalid slug in update', async () => {
    const res = await patchJson(app, '/api/v1/projects/550e8400-e29b-41d4-a716-446655440010', {
      slug: 'a',
    });

    expect(res.status).toBe(422);
  });

  it('should return 422 for invalid JSON body', async () => {
    const res = await app.request(
      '/api/v1/projects/550e8400-e29b-41d4-a716-446655440010',
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

// ─── DELETE /api/v1/projects/:projectId ──────────────────────────────────────

describe('DELETE /api/v1/projects/:projectId', () => {
  const app = createTestApp();

  it('should return 200 with success flag', async () => {
    const res = await deleteJson(app, '/api/v1/projects/550e8400-e29b-41d4-a716-446655440010');

    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, unknown>;

    expect(body.success).toBe(true);
  });
});

// ─── GET /api/v1/projects/:projectId/members ─────────────────────────────────

describe('GET /api/v1/projects/:projectId/members', () => {
  const app = createTestApp();

  it('should return 200 with a list of members', async () => {
    const res = await getJson(app, '/api/v1/projects/550e8400-e29b-41d4-a716-446655440010/members');

    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, unknown>;

    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('total');
  });
});

// ─── POST /api/v1/projects/:projectId/members ────────────────────────────────

describe('POST /api/v1/projects/:projectId/members', () => {
  const app = createTestApp();

  it('should return 201 for valid member addition', async () => {
    const res = await postJson(app, '/api/v1/projects/550e8400-e29b-41d4-a716-446655440010/members', {
      userId: VALID_UUID,
      role: 'developer',
    });

    expect(res.status).toBe(201);
  });

  it('should return 422 for missing userId', async () => {
    const res = await postJson(app, '/api/v1/projects/550e8400-e29b-41d4-a716-446655440010/members', {
      role: 'developer',
    });

    expect(res.status).toBe(422);
  });

  it('should return 422 for missing role', async () => {
    const res = await postJson(app, '/api/v1/projects/550e8400-e29b-41d4-a716-446655440010/members', {
      userId: VALID_UUID,
    });

    expect(res.status).toBe(422);
  });

  it('should return 422 for invalid role', async () => {
    const res = await postJson(app, '/api/v1/projects/550e8400-e29b-41d4-a716-446655440010/members', {
      userId: VALID_UUID,
      role: 'invalid-role',
    });

    expect(res.status).toBe(422);
  });

  it('should return 422 for invalid userId format', async () => {
    const res = await postJson(app, '/api/v1/projects/550e8400-e29b-41d4-a716-446655440010/members', {
      userId: 'not-a-uuid',
      role: 'developer',
    });

    expect(res.status).toBe(422);
  });
});

// ─── PATCH /api/v1/projects/:projectId/members/:memberUserId ─────────────────

describe('PATCH /api/v1/projects/:projectId/members/:memberUserId', () => {
  const app = createTestApp();

  it('should return 200 for valid role update', async () => {
    const res = await patchJson(app, `/api/v1/projects/550e8400-e29b-41d4-a716-446655440010/members/${VALID_UUID}`, {
      role: 'viewer',
    });

    expect(res.status).toBe(200);
  });

  it('should return 422 for missing role', async () => {
    const res = await patchJson(app, `/api/v1/projects/550e8400-e29b-41d4-a716-446655440010/members/${VALID_UUID}`, {});

    expect(res.status).toBe(422);
  });

  it('should return 422 for invalid role', async () => {
    const res = await patchJson(app, `/api/v1/projects/550e8400-e29b-41d4-a716-446655440010/members/${VALID_UUID}`, {
      role: 'invalid-role',
    });

    expect(res.status).toBe(422);
  });
});

// ─── DELETE /api/v1/projects/:projectId/members/:memberUserId ────────────────

describe('DELETE /api/v1/projects/:projectId/members/:memberUserId', () => {
  const app = createTestApp();

  it('should return 200 with success flag', async () => {
    const res = await deleteJson(app, `/api/v1/projects/550e8400-e29b-41d4-a716-446655440010/members/${VALID_UUID}`);

    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, unknown>;

    expect(body.success).toBe(true);
  });
});
