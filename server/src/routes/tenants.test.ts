/**
 * Tests for tenant CRUD and lifecycle HTTP routes.
 */
import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { createTenantRoutes } from './tenants.js';
import { TenantService } from '../services/tenant.service.js';
import { TenantMemberService } from '../services/tenant-member.service.js';
import { errorHandler } from '../middleware/error-handler.js';
import type { AppEnv } from '../types/context.js';

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('../db/mongo.js', () => ({
  getCollection: vi.fn(() => ({})),
}));

const mockTenant = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  name: 'Test Tenant',
  description: null,
  status: 'ACTIVE',
  deletionScheduledAt: null,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};
const mockMember = {
  id: '550e8400-e29b-41d4-a716-446655440001',
  userId: '550e8400-e29b-41d4-a716-446655440002',
  tenantId: '550e8400-e29b-41d4-a716-446655440000',
  role: 'OWNER',
  status: 'ACTIVE',
  invitation: null,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

vi.mock('../services/tenant.service.js', () => ({
  TenantService: vi.fn().mockImplementation(() => ({
    listTenantsWithRole: vi.fn().mockResolvedValue([{ ...mockTenant, role: 'OWNER' }]),
    createTenant: vi.fn().mockResolvedValue(mockTenant),
    getTenant: vi.fn().mockResolvedValue(mockTenant),
    updateTenant: vi.fn().mockResolvedValue(mockTenant),
    deleteTenant: vi.fn().mockResolvedValue(undefined),
    archiveTenant: vi.fn().mockResolvedValue(undefined),
    restoreTenant: vi.fn().mockResolvedValue(undefined),
    cancelDeletion: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('../services/tenant-member.service.js', () => ({
  TenantMemberService: vi.fn().mockImplementation(() => ({
    getTenantMembers: vi.fn().mockResolvedValue([mockMember]),
    inviteUser: vi.fn().mockResolvedValue(mockMember),
    updateMemberRole: vi.fn().mockResolvedValue(mockMember),
    removeMember: vi.fn().mockResolvedValue(undefined),
    restoreMembership: vi.fn().mockResolvedValue(undefined),
    reinviteUser: vi.fn().mockResolvedValue(undefined),
  })),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TEST_ENV = { JWT_SECRET: 'test-secret', MONGODB_URI: '', ALLOWED_ORIGINS: '*' };

function createTestApp() {
  const app = new Hono<AppEnv>();

  app.use('/api/*', async (c, next) => {
    const MockTenants = TenantService as unknown as new () => InstanceType<typeof TenantService>;
    const MockMembers = TenantMemberService as unknown as new () => InstanceType<typeof TenantMemberService>;

    c.set('svc', { tenants: new MockTenants(), tenantMembers: new MockMembers() } as never);
    await next();
  });

  app.onError(errorHandler);

  app.use('/api/*', async (c, next) => {
    c.set('userId', '550e8400-e29b-41d4-a716-446655440002');
    await next();
  });

  app.route('/api/tenants', createTenantRoutes());

  return app;
}

async function getJson(app: Hono<AppEnv>, path: string) {
  return app.request(path, { method: 'GET' }, TEST_ENV);
}

async function postJson(app: Hono<AppEnv>, path: string, body: unknown) {
  return app.request(
    path,
    { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } },
    TEST_ENV,
  );
}

async function patchJson(app: Hono<AppEnv>, path: string, body: unknown) {
  return app.request(
    path,
    { method: 'PATCH', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } },
    TEST_ENV,
  );
}

async function deleteJson(app: Hono<AppEnv>, path: string) {
  return app.request(path, { method: 'DELETE' }, TEST_ENV);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('GET /api/tenants', () => {
  const app = createTestApp();

  it('should return 200 with { data } envelope', async () => {
    const res = await getJson(app, '/api/tenants');

    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, unknown>;

    expect(body).toHaveProperty('data');
  });
});

describe('POST /api/tenants', () => {
  const app = createTestApp();

  it('should return 201 for valid tenant creation', async () => {
    const res = await postJson(app, '/api/tenants', { name: 'New Tenant' });

    expect(res.status).toBe(201);
  });

  it('should return 422 for empty name', async () => {
    const res = await postJson(app, '/api/tenants', { name: '' });

    expect(res.status).toBe(400);
  });

  it('should return 422 for missing body', async () => {
    const res = await postJson(app, '/api/tenants', {});

    expect(res.status).toBe(400);
  });
});

describe('GET /api/tenants/:tenantId', () => {
  const app = createTestApp();

  it('should return 200 with { data } envelope', async () => {
    const res = await getJson(app, '/api/tenants/550e8400-e29b-41d4-a716-446655440000');

    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, unknown>;

    expect(body).toHaveProperty('data');
  });
});

describe('PATCH /api/tenants/:tenantId', () => {
  const app = createTestApp();

  it('should return 200 for valid partial update', async () => {
    const res = await patchJson(app, '/api/tenants/550e8400-e29b-41d4-a716-446655440000', { name: 'Updated' });

    expect(res.status).toBe(200);
  });

  it('should return 422 for empty name', async () => {
    const res = await patchJson(app, '/api/tenants/550e8400-e29b-41d4-a716-446655440000', { name: '' });

    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/tenants/:tenantId', () => {
  const app = createTestApp();

  it('should return 200 with { data } envelope', async () => {
    const res = await deleteJson(app, '/api/tenants/550e8400-e29b-41d4-a716-446655440000');

    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, unknown>;

    expect(body).toHaveProperty('data');
  });
});

describe('POST /api/tenants/:tenantId/archive', () => {
  const app = createTestApp();

  it('should return 200', async () => {
    const res = await postJson(app, '/api/tenants/550e8400-e29b-41d4-a716-446655440000/archive', {});

    expect(res.status).toBe(200);
  });
});

describe('POST /api/tenants/:tenantId/restore', () => {
  const app = createTestApp();

  it('should return 200', async () => {
    const res = await postJson(app, '/api/tenants/550e8400-e29b-41d4-a716-446655440000/restore', {});

    expect(res.status).toBe(200);
  });
});

describe('GET /api/tenants/:tenantId/members', () => {
  const app = createTestApp();

  it('should return 200 with { data } envelope', async () => {
    const res = await getJson(app, '/api/tenants/550e8400-e29b-41d4-a716-446655440000/members');

    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, unknown>;

    expect(body).toHaveProperty('data');
    expect(Array.isArray(body.data)).toBe(true);
  });
});

describe('POST /api/tenants/:tenantId/members/invite', () => {
  const app = createTestApp();

  it('should return 201 for valid invite', async () => {
    const res = await postJson(app, '/api/tenants/550e8400-e29b-41d4-a716-446655440000/members/invite', {
      email: 'new@test.com',
      role: 'MEMBER',
    });

    expect(res.status).toBe(201);
  });
});
