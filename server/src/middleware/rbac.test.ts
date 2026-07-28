import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { requireRole } from './rbac.js';
import { errorHandler } from './error-handler.js';
import type { AppEnv } from '../types/context.js';
import { TenantRole } from '@task-board/shared';

type TenantRoleType = (typeof TenantRole)[number];

function createTestAppWithRoles(roles: TenantRoleType[]) {
  const app = new Hono<AppEnv>();
  app.onError(errorHandler);

  // Simulate auth + tenant context setting userRole
  app.use('/test/*', async (c, next) => {
    const role = c.req.header('X-Test-Role') ?? 'member';
    c.set('userRole', role);
    await next();
  });

  app.get('/test/resource', requireRole(...(roles as [TenantRoleType, ...TenantRoleType[]])), (c) => {
    return c.json({ message: 'access granted' });
  });

  return app;
}

describe('requireRole middleware', () => {
  it('allows access when user has the required role', async () => {
    const app = createTestAppWithRoles(['admin', 'member']);

    const res = await app.request('/test/resource', {
      headers: { 'X-Test-Role': 'admin' },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.message).toBe('access granted');
  });

  it('denies access when user role is not in the allowed list', async () => {
    const app = createTestAppWithRoles(['owner', 'admin']);

    const res = await app.request('/test/resource', {
      headers: { 'X-Test-Role': 'member' },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.code).toBe('FORBIDDEN');
  });

  it('allows owner to bypass all role restrictions', async () => {
    const app = createTestAppWithRoles(['admin']);

    const res = await app.request('/test/resource', {
      headers: { 'X-Test-Role': 'owner' },
    });
    expect(res.status).toBe(200);
  });

  it('returns 403 when no userRole is set', async () => {
    const app = new Hono<AppEnv>();
    app.onError(errorHandler);
    app.get('/test/resource', requireRole('admin'), (c) => {
      return c.json({ message: 'access granted' });
    });

    const res = await app.request('/test/resource');
    expect(res.status).toBe(403);
  });
});
