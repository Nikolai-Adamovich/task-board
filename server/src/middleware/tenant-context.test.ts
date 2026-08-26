import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { tenantContextMiddleware } from './tenant-context.js';
import { errorHandler } from './error-handler.js';
import type { AppEnv } from '../types/context.js';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockMemberFindOne = vi.fn();
const mockTenantFindOne = vi.fn();

vi.mock('../db/mongo.js', () => ({
  getCollection: vi.fn((name: string) =>
    name === 'tenants' ? { findOne: mockTenantFindOne } : { findOne: mockMemberFindOne },
  ),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createTestApp() {
  const app = new Hono<AppEnv>();

  app.onError(errorHandler);

  // Simulate auth middleware setting userId
  app.use('/tenant-protected/*', async (c, next) => {
    c.set('userId', 'user-1');
    await next();
  });
  app.use('/tenant-protected/*', tenantContextMiddleware);

  app.get('/tenant-protected/resource', (c) => {
    return c.json({
      tenantId: c.get('tenantId'),
      tenantRole: c.get('tenantRole'),
    });
  });

  return app;
}

function createTestAppWithoutAuth() {
  const app = new Hono<AppEnv>();

  app.onError(errorHandler);
  app.use('/tenant-protected/*', tenantContextMiddleware);

  app.get('/tenant-protected/resource', (c) => {
    return c.json({ tenantId: c.get('tenantId') });
  });

  return app;
}

const TEST_ENV = {
  JWT_SECRET: 'test-secret',
  MONGODB_URI: 'mongodb://localhost:27017/test',
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('tenantContextMiddleware', () => {
  beforeEach(() => {
    mockMemberFindOne.mockReset();
    mockTenantFindOne.mockReset();
  });

  // ── DEC-032: resolution by slug (backward compatible with id) ────────────

  it('resolves the tenant context by slug when the header value is not a tenant id', async () => {
    mockMemberFindOne
      .mockResolvedValueOnce(null) // no membership for the raw value
      .mockResolvedValueOnce({ userId: 'user-1', tenantId: 'tenant-1', role: 'MEMBER', status: 'ACTIVE' });
    mockTenantFindOne.mockResolvedValue({ id: 'tenant-1', slug: 'my-workspace' });

    const app = createTestApp();
    const res = await app.request(
      '/tenant-protected/resource',
      { headers: { 'X-Tenant-Id': 'my-workspace' } },
      TEST_ENV,
    );

    expect(res.status).toBe(200);

    const body = (await res.json()) as { tenantId: string; tenantRole: string };

    expect(body.tenantId).toBe('tenant-1');
    expect(body.tenantRole).toBe('MEMBER');
    expect(mockMemberFindOne).toHaveBeenNthCalledWith(2, { userId: 'user-1', tenantId: 'tenant-1' });
  });

  it('returns 403 when the slug resolves to a tenant the user is not a member of', async () => {
    mockMemberFindOne.mockResolvedValue(null);
    mockTenantFindOne.mockResolvedValue({ id: 'tenant-9', slug: 'other-workspace' });

    const app = createTestApp();
    const res = await app.request(
      '/tenant-protected/resource',
      { headers: { 'X-Tenant-Id': 'other-workspace' } },
      TEST_ENV,
    );

    expect(res.status).toBe(403);

    const json = (await res.json()) as { error: { code: string; message: string } };

    expect(json.error.code).toBe('FORBIDDEN');
    expect(json.error.message).toBe('You are not a member of this tenant');
  });

  it('does not query tenants by slug when the id path matches a membership (backward compatible)', async () => {
    mockMemberFindOne.mockResolvedValue({
      userId: 'user-1',
      tenantId: 'tenant-1',
      role: 'OWNER',
      status: 'ACTIVE',
    });

    const app = createTestApp();
    const res = await app.request('/tenant-protected/resource', { headers: { 'X-Tenant-Id': 'tenant-1' } }, TEST_ENV);

    expect(res.status).toBe(200);
    expect(mockTenantFindOne).not.toHaveBeenCalled();
  });

  it('returns 403 when neither an id nor a slug matches', async () => {
    mockMemberFindOne.mockResolvedValue(null);
    mockTenantFindOne.mockResolvedValue(null);

    const app = createTestApp();
    const res = await app.request('/tenant-protected/resource', { headers: { 'X-Tenant-Id': 'nope' } }, TEST_ENV);

    expect(res.status).toBe(403);

    const json = (await res.json()) as { error: { code: string } };

    expect(json.error.code).toBe('FORBIDDEN');
  });

  it('returns 400 when X-Tenant-Id header is missing', async () => {
    const app = createTestApp();
    const res = await app.request('/tenant-protected/resource', {}, TEST_ENV);

    expect(res.status).toBe(400);

    const json = (await res.json()) as { error: { code: string; message: string } };

    expect(json.error.code).toBe('VALIDATION_ERROR');
    expect(json.error.message).toBe('Missing X-Tenant-Id header');
  });

  it('returns 403 when userId is not set (no auth)', async () => {
    const app = createTestAppWithoutAuth();
    const res = await app.request('/tenant-protected/resource', { headers: { 'X-Tenant-Id': 'tenant-1' } }, TEST_ENV);

    expect(res.status).toBe(403);

    const json = (await res.json()) as { error: { code: string; message: string } };

    expect(json.error.code).toBe('FORBIDDEN');
    expect(json.error.message).toBe('Authentication required for tenant context');
  });

  it('returns 403 when user is not a member of the tenant', async () => {
    mockMemberFindOne.mockResolvedValue(null);

    const app = createTestApp();
    const res = await app.request('/tenant-protected/resource', { headers: { 'X-Tenant-Id': 'tenant-1' } }, TEST_ENV);

    expect(res.status).toBe(403);

    const json = (await res.json()) as { error: { code: string; message: string } };

    expect(json.error.code).toBe('FORBIDDEN');
    expect(json.error.message).toBe('You are not a member of this tenant');
  });

  it('returns 403 when membership status is ACCESS_REVOKED', async () => {
    mockMemberFindOne.mockResolvedValue({
      userId: 'user-1',
      tenantId: 'tenant-1',
      role: 'MEMBER',
      status: 'ACCESS_REVOKED',
    });

    const app = createTestApp();
    const res = await app.request('/tenant-protected/resource', { headers: { 'X-Tenant-Id': 'tenant-1' } }, TEST_ENV);

    expect(res.status).toBe(403);

    const json = (await res.json()) as { error: { code: string; message: string } };

    expect(json.error.code).toBe('FORBIDDEN');
    expect(json.error.message).toBe('Your access to this tenant has been revoked');
  });

  // DEC-018: an invited-but-unaccepted member is stored as ACCESS_REVOKED + invitation PENDING;
  // the status gate alone must block them — no special-casing of "ACTIVE but pending invitation".
  it('blocks a member whose invitation is still PENDING (status ACCESS_REVOKED)', async () => {
    mockMemberFindOne.mockResolvedValue({
      userId: 'user-1',
      tenantId: 'tenant-1',
      role: 'MEMBER',
      status: 'ACCESS_REVOKED',
      invitation: { status: 'PENDING', tokenHash: 'hash', invitedBy: 'owner', invitedOn: new Date() },
    });

    const app = createTestApp();
    const res = await app.request('/tenant-protected/resource', { headers: { 'X-Tenant-Id': 'tenant-1' } }, TEST_ENV);

    expect(res.status).toBe(403);

    const json = (await res.json()) as { error: { code: string; message: string } };

    expect(json.error.code).toBe('FORBIDDEN');
  });

  it('returns 403 when membership status is unknown/non-active', async () => {
    mockMemberFindOne.mockResolvedValue({
      userId: 'user-1',
      tenantId: 'tenant-1',
      role: 'MEMBER',
      status: 'disabled',
    });

    const app = createTestApp();
    const res = await app.request('/tenant-protected/resource', { headers: { 'X-Tenant-Id': 'tenant-1' } }, TEST_ENV);

    expect(res.status).toBe(403);

    const json = (await res.json()) as { error: { code: string; message: string } };

    expect(json.error.code).toBe('FORBIDDEN');
    expect(json.error.message).toBe('Your membership is not active');
  });

  it('sets tenantId and tenantRole for ACTIVE membership', async () => {
    mockMemberFindOne.mockResolvedValue({
      userId: 'user-1',
      tenantId: 'tenant-1',
      role: 'ADMIN',
      status: 'ACTIVE',
    });

    const app = createTestApp();
    const res = await app.request('/tenant-protected/resource', { headers: { 'X-Tenant-Id': 'tenant-1' } }, TEST_ENV);

    expect(res.status).toBe(200);

    const body = (await res.json()) as { tenantId: string; tenantRole: string };

    expect(body.tenantId).toBe('tenant-1');
    expect(body.tenantRole).toBe('ADMIN');
  });

  it('queries tenant_members collection with correct filter', async () => {
    mockMemberFindOne.mockResolvedValue({
      userId: 'user-1',
      tenantId: 'tenant-42',
      role: 'OWNER',
      status: 'ACTIVE',
    });

    const app = createTestApp();

    await app.request('/tenant-protected/resource', { headers: { 'X-Tenant-Id': 'tenant-42' } }, TEST_ENV);

    expect(mockMemberFindOne).toHaveBeenCalledWith({
      userId: 'user-1',
      tenantId: 'tenant-42',
    });
  });

  it('sets correct tenantRole for OWNER', async () => {
    mockMemberFindOne.mockResolvedValue({
      userId: 'user-1',
      tenantId: 'tenant-1',
      role: 'OWNER',
      status: 'ACTIVE',
    });

    const app = createTestApp();
    const res = await app.request('/tenant-protected/resource', { headers: { 'X-Tenant-Id': 'tenant-1' } }, TEST_ENV);

    expect(res.status).toBe(200);

    const body = (await res.json()) as { tenantRole: string };

    expect(body.tenantRole).toBe('OWNER');
  });

  it('sets correct tenantRole for MEMBER', async () => {
    mockMemberFindOne.mockResolvedValue({
      userId: 'user-1',
      tenantId: 'tenant-1',
      role: 'MEMBER',
      status: 'ACTIVE',
    });

    const app = createTestApp();
    const res = await app.request('/tenant-protected/resource', { headers: { 'X-Tenant-Id': 'tenant-1' } }, TEST_ENV);

    expect(res.status).toBe(200);

    const body = (await res.json()) as { tenantRole: string };

    expect(body.tenantRole).toBe('MEMBER');
  });
});
