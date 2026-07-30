import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { tenantContextMiddleware } from './tenant-context.js';
import { errorHandler } from './error-handler.js';
import type { AppEnv } from '../types/context.js';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockFindOne = vi.fn();

vi.mock('../db/mongo.js', () => ({
  getCollection: vi.fn(() => ({
    findOne: mockFindOne,
  })),
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
      userRole: c.get('userRole'),
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
    mockFindOne.mockReset();
  });

  it('returns 400 when X-Tenant-Id header is missing', async () => {
    const app = createTestApp();
    const res = await app.request('/tenant-protected/resource', {}, TEST_ENV);

    expect(res.status).toBe(422);

    const body = (await res.json()) as Record<string, unknown>;

    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.message).toBe('Missing X-Tenant-Id header');
  });

  it('returns 403 when userId is not set (no auth)', async () => {
    const app = createTestAppWithoutAuth();
    const res = await app.request('/tenant-protected/resource', { headers: { 'X-Tenant-Id': 'tenant-1' } }, TEST_ENV);

    expect(res.status).toBe(403);

    const body = (await res.json()) as Record<string, unknown>;

    expect(body.code).toBe('FORBIDDEN');
    expect(body.message).toBe('Authentication required for tenant context');
  });

  it('returns 403 when user is not a member of the tenant', async () => {
    mockFindOne.mockResolvedValue(null);

    const app = createTestApp();
    const res = await app.request('/tenant-protected/resource', { headers: { 'X-Tenant-Id': 'tenant-1' } }, TEST_ENV);

    expect(res.status).toBe(403);

    const body = (await res.json()) as Record<string, unknown>;

    expect(body.code).toBe('FORBIDDEN');
    expect(body.message).toBe('You are not a member of this tenant');
  });

  it('returns 403 when membership status is pending', async () => {
    mockFindOne.mockResolvedValue({
      userId: 'user-1',
      tenantId: 'tenant-1',
      role: 'member',
      status: 'pending',
    });

    const app = createTestApp();
    const res = await app.request('/tenant-protected/resource', { headers: { 'X-Tenant-Id': 'tenant-1' } }, TEST_ENV);

    expect(res.status).toBe(403);

    const body = (await res.json()) as Record<string, unknown>;

    expect(body.code).toBe('FORBIDDEN');
    expect(body.message).toBe('Your membership is pending. Please accept the invitation first.');
  });

  it('returns 403 when membership status is declined', async () => {
    mockFindOne.mockResolvedValue({
      userId: 'user-1',
      tenantId: 'tenant-1',
      role: 'member',
      status: 'declined',
    });

    const app = createTestApp();
    const res = await app.request('/tenant-protected/resource', { headers: { 'X-Tenant-Id': 'tenant-1' } }, TEST_ENV);

    expect(res.status).toBe(403);

    const body = (await res.json()) as Record<string, unknown>;

    expect(body.code).toBe('FORBIDDEN');
    expect(body.message).toBe('Your membership has been declined.');
  });

  it('returns 403 when membership status is inactive', async () => {
    mockFindOne.mockResolvedValue({
      userId: 'user-1',
      tenantId: 'tenant-1',
      role: 'member',
      status: 'disabled',
    });

    const app = createTestApp();
    const res = await app.request('/tenant-protected/resource', { headers: { 'X-Tenant-Id': 'tenant-1' } }, TEST_ENV);

    expect(res.status).toBe(403);

    const body = (await res.json()) as Record<string, unknown>;

    expect(body.code).toBe('FORBIDDEN');
    expect(body.message).toBe('Your membership is not active');
  });

  it('sets tenantId and userRole for active membership', async () => {
    mockFindOne.mockResolvedValue({
      userId: 'user-1',
      tenantId: 'tenant-1',
      role: 'admin',
      status: 'active',
    });

    const app = createTestApp();
    const res = await app.request('/tenant-protected/resource', { headers: { 'X-Tenant-Id': 'tenant-1' } }, TEST_ENV);

    expect(res.status).toBe(200);

    const body = (await res.json()) as { tenantId: string; userRole: string };

    expect(body.tenantId).toBe('tenant-1');
    expect(body.userRole).toBe('admin');
  });

  it('queries tenant_members collection with correct filter', async () => {
    mockFindOne.mockResolvedValue({
      userId: 'user-1',
      tenantId: 'tenant-42',
      role: 'owner',
      status: 'active',
    });

    const app = createTestApp();

    await app.request('/tenant-protected/resource', { headers: { 'X-Tenant-Id': 'tenant-42' } }, TEST_ENV);

    expect(mockFindOne).toHaveBeenCalledWith({
      userId: 'user-1',
      tenantId: 'tenant-42',
    });
  });
});
