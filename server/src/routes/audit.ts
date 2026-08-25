import { Hono } from 'hono';
import type { AppEnv } from '../types/context.js';
import type { AuditQueryOptions } from '../repositories/audit-event.repository.js';

export function createAuditRoutes(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  /**
   * GET /projects/:projectId/audit — List audit events for a project.
   */
  router.get('/projects/:projectId/audit', async (c) => {
    const projectId = c.req.param('projectId');
    const pageStr = c.req.query('page');
    const limitStr = c.req.query('limit');
    const options: AuditQueryOptions = {
      page: pageStr ? parseInt(pageStr, 10) : 1,
      limit: limitStr ? parseInt(limitStr, 10) : 20,
      entityType: c.req.query('entityType'),
      entityId: c.req.query('entityId'),
    };
    const result = await c.get('svc').audit.queryByProject(projectId, options);

    return c.json({ data: result.data, pagination: result.pagination });
  });

  /**
   * GET /tenants/:tenantId/audit — List audit events for a tenant.
   */
  router.get('/tenants/:tenantId/audit', async (c) => {
    const tenantId = c.req.param('tenantId');
    const pageStr = c.req.query('page');
    const limitStr = c.req.query('limit');
    const options: AuditQueryOptions = {
      page: pageStr ? parseInt(pageStr, 10) : 1,
      limit: limitStr ? parseInt(limitStr, 10) : 20,
      entityType: c.req.query('entityType'),
      entityId: c.req.query('entityId'),
    };
    const result = await c.get('svc').audit.queryByTenant(tenantId, options);

    return c.json({ data: result.data, pagination: result.pagination });
  });

  return router;
}
