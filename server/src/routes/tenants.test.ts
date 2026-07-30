/**
 * Tests for tenant CRUD and member management HTTP routes.
 *
 * Validates that the endpoints correctly enforce Zod schema validation
 * and return proper HTTP status codes and error responses.
 */
import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { createTenantRoutes } from './tenants.js';
import { errorHandler } from '../middleware/error-handler.js';
import type { AppEnv } from '../types/context.js';

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('../db/mongo.js', () => ({
  getCollection: vi.fn(() => ({})),
}));

const mockTenant = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  name: 'Test Tenant',
  slug: 'test-tenant',
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};
const mockMember = {
  id: '550e8400-e29b-41d4-a716-446655440001',
  userId: '550e8400-e29b-41d4-a716-446655440002',
  tenantId: '550e8400-e29b-41d4-a716-446655440000',
  role: 'owner',
  createdAt: '2025-01-01T00:00:00.000Z',
};

vi.mock('../services/tenant.service.js', () => ({
  TenantService: vi.fn().mockImplementation(() => ({
    listTenantsForUser: vi.fn().mockResolvedValue([mockTenant]),
    listTenantsWithRole: vi.fn().mockResolvedValue([{ ...mockTenant, role: 'owner' }]),
    createTenant: vi.fn().mockResolvedValue(mockTenant),
    getTenant: vi.fn().mockResolvedValue(mockTenant),
    updateTenant: vi.fn().mockResolvedValue(mockTenant),
    deleteTenant: vi.fn().mockResolvedValue(undefined),
    getTenantMembers: vi.fn().mockResolvedValue([mockMember]),
    inviteMember: vi.fn().mockResolvedValue(mockMember),
    updateMemberRole: vi.fn().mockResolvedValue(mockMember),
    removeMember: vi.fn().mockResolvedValue(undefined),
    getPendingInvitationsByTenant: vi.fn().mockResolvedValue([]),
    revokeAccess: vi.fn().mockResolvedValue(undefined),
    resendInvitation: vi.fn().mockResolvedValue(undefined),
    hardDeleteMember: vi.fn().mockResolvedValue(undefined),
  })),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TEST_ENV = { JWT_SECRET: 'test-secret', MONGODB_URI: '', ALLOWED_ORIGINS: '*' };

function createTestApp() {
  const app = new Hono<AppEnv>();

  app.onError(errorHandler);

  // Set userId on context (auth middleware equivalent)
  app.use('/api/v1/*', async (c, next) => {
    c.set('userId', '550e8400-e29b-41d4-a716-446655440002');
    await next();
  });

  app.route('/api/v1/tenants', createTenantRoutes());

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

// ─── GET /api/v1/tenants ─────────────────────────────────────────────────────

describe('GET /api/v1/tenants', () => {
  const app = createTestApp();

  it('should return 200 with a list of tenants', async () => {
    const res = await getJson(app, '/api/v1/tenants');

    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, unknown>;

    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('total');
  });
});

// ─── POST /api/v1/tenants ────────────────────────────────────────────────────

describe('POST /api/v1/tenants', () => {
  const app = createTestApp();
  const validBody = { name: 'New Tenant', slug: 'new-tenant' };

  it('should return 201 for valid tenant creation', async () => {
    const res = await postJson(app, '/api/v1/tenants', validBody);

    expect(res.status).toBe(201);
  });

  // ── Name validation ──────────────────────────────────────────────────────

  it('should return 422 for empty name', async () => {
    const res = await postJson(app, '/api/v1/tenants', { ...validBody, name: '' });

    expect(res.status).toBe(422);

    const body = (await res.json()) as Record<string, unknown>;

    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('should return 422 for name exceeding 100 chars', async () => {
    const res = await postJson(app, '/api/v1/tenants', { ...validBody, name: 'a'.repeat(101) });

    expect(res.status).toBe(422);
  });

  it('should accept name at maximum boundary (100 chars)', async () => {
    const res = await postJson(app, '/api/v1/tenants', { ...validBody, name: 'a'.repeat(100) });

    expect(res.status).toBe(201);
  });

  // ── Slug validation ──────────────────────────────────────────────────────

  it('should return 422 for slug shorter than 2 chars', async () => {
    const res = await postJson(app, '/api/v1/tenants', { ...validBody, slug: 'a' });

    expect(res.status).toBe(422);
  });

  it('should return 422 for slug with invalid characters', async () => {
    const res = await postJson(app, '/api/v1/tenants', { ...validBody, slug: 'Invalid Slug!' });

    expect(res.status).toBe(422);
  });

  it('should accept valid slug', async () => {
    const res = await postJson(app, '/api/v1/tenants', { ...validBody, slug: 'my-org' });

    expect(res.status).toBe(201);
  });

  // ── Missing fields ──────────────────────────────────────────────────────

  it('should return 422 for missing body', async () => {
    const res = await postJson(app, '/api/v1/tenants', {});

    expect(res.status).toBe(422);
  });

  it('should return 422 for missing name', async () => {
    const res = await postJson(app, '/api/v1/tenants', { slug: 'new-tenant' });

    expect(res.status).toBe(422);
  });

  it('should return 422 for missing slug', async () => {
    const res = await postJson(app, '/api/v1/tenants', { name: 'New Tenant' });

    expect(res.status).toBe(422);
  });

  it('should return 422 for invalid JSON body', async () => {
    const res = await app.request(
      '/api/v1/tenants',
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

// ─── GET /api/v1/tenants/:tenantId ───────────────────────────────────────────

describe('GET /api/v1/tenants/:tenantId', () => {
  const app = createTestApp();

  it('should return 200 for a valid tenant ID', async () => {
    const res = await getJson(app, '/api/v1/tenants/550e8400-e29b-41d4-a716-446655440000');

    expect(res.status).toBe(200);
  });
});

// ─── PATCH /api/v1/tenants/:tenantId ─────────────────────────────────────────

describe('PATCH /api/v1/tenants/:tenantId', () => {
  const app = createTestApp();

  it('should return 200 for valid partial update', async () => {
    const res = await patchJson(app, '/api/v1/tenants/550e8400-e29b-41d4-a716-446655440000', {
      name: 'Updated Tenant',
    });

    expect(res.status).toBe(200);
  });

  it('should return 200 for empty body (no-op update)', async () => {
    const res = await patchJson(app, '/api/v1/tenants/550e8400-e29b-41d4-a716-446655440000', {});

    expect(res.status).toBe(200);
  });

  it('should return 422 for empty name in update', async () => {
    const res = await patchJson(app, '/api/v1/tenants/550e8400-e29b-41d4-a716-446655440000', {
      name: '',
    });

    expect(res.status).toBe(422);
  });

  it('should return 422 for invalid slug in update', async () => {
    const res = await patchJson(app, '/api/v1/tenants/550e8400-e29b-41d4-a716-446655440000', {
      slug: 'a',
    });

    expect(res.status).toBe(422);
  });

  it('should return 422 for invalid JSON body', async () => {
    const res = await app.request(
      '/api/v1/tenants/550e8400-e29b-41d4-a716-446655440000',
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

// ─── DELETE /api/v1/tenants/:tenantId ────────────────────────────────────────

describe('DELETE /api/v1/tenants/:tenantId', () => {
  const app = createTestApp();

  it('should return 200 with success flag', async () => {
    const res = await deleteJson(app, '/api/v1/tenants/550e8400-e29b-41d4-a716-446655440000');

    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, unknown>;

    expect(body.success).toBe(true);
  });
});

// ─── GET /api/v1/tenants/:tenantId/members ───────────────────────────────────

describe('GET /api/v1/tenants/:tenantId/members', () => {
  const app = createTestApp();

  it('should return 200 with a list of members', async () => {
    const res = await getJson(app, '/api/v1/tenants/550e8400-e29b-41d4-a716-446655440000/members');

    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, unknown>;

    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('total');
  });
});

// ─── POST /api/v1/tenants/:tenantId/members ──────────────────────────────────

describe('POST /api/v1/tenants/:tenantId/members', () => {
  const app = createTestApp();

  it('should return 201 for valid invite', async () => {
    const res = await postJson(app, '/api/v1/tenants/550e8400-e29b-41d4-a716-446655440000/members', {
      email: 'new@test.com',
      role: 'member',
    });

    expect(res.status).toBe(201);
  });
});

// ─── PATCH /api/v1/tenants/:tenantId/members/:memberUserId ───────────────────

describe('PATCH /api/v1/tenants/:tenantId/members/:memberUserId', () => {
  const app = createTestApp();

  it('should return 200 for valid role update', async () => {
    const res = await patchJson(
      app,
      '/api/v1/tenants/550e8400-e29b-41d4-a716-446655440000/members/550e8400-e29b-41d4-a716-446655440002',
      { role: 'admin' },
    );

    expect(res.status).toBe(200);
  });
});

// ─── DELETE /api/v1/tenants/:tenantId/members/:memberUserId ──────────────────

describe('DELETE /api/v1/tenants/:tenantId/members/:memberUserId', () => {
  const app = createTestApp();

  it('should return 200 with success flag', async () => {
    const res = await deleteJson(
      app,
      '/api/v1/tenants/550e8400-e29b-41d4-a716-446655440000/members/550e8400-e29b-41d4-a716-446655440002',
    );

    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, unknown>;

    expect(body.success).toBe(true);
  });
});
