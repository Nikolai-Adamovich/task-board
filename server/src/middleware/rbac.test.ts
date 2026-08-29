import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { requireRole, requirePermission } from './rbac.js';
import { errorHandler } from './error-handler.js';
import type { AppEnv } from '../types/context.js';
import type { TenantRole } from '@task-board/shared';

function createTestAppWithRoles(roles: TenantRole[]) {
  const app = new Hono<AppEnv>();

  app.onError(errorHandler);

  // Simulate auth + tenant context setting tenantRole
  app.use('/test/*', async (c, next) => {
    const role = (c.req.header('X-Test-Role') ?? 'MEMBER') as TenantRole;

    c.set('tenantRole', role);
    await next();
  });

  app.get('/test/resource', requireRole(...(roles as [TenantRole, ...TenantRole[]])), (c) => {
    return c.json({ message: 'access granted' });
  });

  return app;
}

describe('requireRole middleware', () => {
  it('allows access when user has the required role', async () => {
    const app = createTestAppWithRoles(['ADMIN', 'MEMBER']);
    const res = await app.request('/test/resource', {
      headers: { 'X-Test-Role': 'ADMIN' },
    });

    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, unknown>;

    expect(body.message).toBe('access granted');
  });

  it('denies access when user role is not in the allowed list', async () => {
    const app = createTestAppWithRoles(['OWNER', 'ADMIN']);
    const res = await app.request('/test/resource', {
      headers: { 'X-Test-Role': 'MEMBER' },
    });

    expect(res.status).toBe(403);

    const json = (await res.json()) as { error: { code: string } };

    expect(json.error.code).toBe('FORBIDDEN');
  });

  it('allows owner to bypass all role restrictions', async () => {
    const app = createTestAppWithRoles(['ADMIN']);
    const res = await app.request('/test/resource', {
      headers: { 'X-Test-Role': 'OWNER' },
    });

    expect(res.status).toBe(200);
  });

  it('returns 403 when no tenantRole is set', async () => {
    const app = new Hono<AppEnv>();

    app.onError(errorHandler);
    app.get('/test/resource', requireRole('ADMIN'), (c) => {
      return c.json({ message: 'access granted' });
    });

    const res = await app.request('/test/resource');

    expect(res.status).toBe(403);
  });
});

describe('requirePermission middleware', () => {
  function createPermissionTestApp(action: string, projectLevel = false) {
    const app = new Hono<AppEnv>();

    app.onError(errorHandler);

    app.use('/test/*', async (c, next) => {
      const tenantRole = (c.req.header('X-Tenant-Role') ?? 'MEMBER') as TenantRole;
      const projectRole = c.req.header('X-Project-Role') ?? undefined;

      // Simulate authMiddleware: it always sets userId before role checks.
      // X-Test-No-User simulates a misconfigured chain where auth never ran.
      if (!c.req.header('X-Test-No-User')) {
        c.set('userId', c.req.header('X-Test-User-Id') ?? 'user-1');
      }
      c.set('tenantRole', tenantRole);
      if (projectRole) {
        c.set('projectRole', projectRole as 'PROJECT_ADMIN' | 'EDITOR' | 'VIEWER');
      }
      await next();
    });

    app.get('/test/resource', requirePermission(action as 'manage_tenant', projectLevel), (c) =>
      c.json({ message: 'access granted' }),
    );

    return app;
  }

  it('allows OWNER to manage_tenant', async () => {
    const app = createPermissionTestApp('manage_tenant');
    const res = await app.request('/test/resource', {
      headers: { 'X-Tenant-Role': 'OWNER' },
    });

    expect(res.status).toBe(200);
  });

  it('denies MEMBER from manage_tenant', async () => {
    const app = createPermissionTestApp('manage_tenant');
    const res = await app.request('/test/resource', {
      headers: { 'X-Tenant-Role': 'MEMBER' },
    });

    expect(res.status).toBe(403);
  });

  it('allows EDITOR to create_task (project-level)', async () => {
    const app = createPermissionTestApp('create_task', true);
    const res = await app.request('/test/resource', {
      headers: { 'X-Tenant-Role': 'MEMBER', 'X-Project-Role': 'EDITOR' },
    });

    expect(res.status).toBe(200);
  });

  it('denies VIEWER from create_task (project-level)', async () => {
    const app = createPermissionTestApp('create_task', true);
    const res = await app.request('/test/resource', {
      headers: { 'X-Tenant-Role': 'MEMBER', 'X-Project-Role': 'VIEWER' },
    });

    expect(res.status).toBe(403);
  });

  it('allows ADMIN to bypass project-level checks', async () => {
    const app = createPermissionTestApp('create_task', true);
    const res = await app.request('/test/resource', {
      headers: { 'X-Tenant-Role': 'ADMIN' },
    });

    expect(res.status).toBe(200);
  });

  it('returns 403 when userId is not set (S-18 defense-in-depth)', async () => {
    const app = createPermissionTestApp('manage_tenant');
    const res = await app.request('/test/resource', {
      // Role present, but authMiddleware never ran → no userId in context
      headers: { 'X-Tenant-Role': 'OWNER', 'X-Test-No-User': '1' },
    });

    expect(res.status).toBe(403);

    const json = (await res.json()) as { error: { code: string; message: string } };

    expect(json.error.code).toBe('FORBIDDEN');
    expect(json.error.message).toBe('Authentication required');
  });
});
