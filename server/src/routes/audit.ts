import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { AppEnv } from '../types/context.js';
import { AuditQuerySchema } from '../schemas/audit.js';
import type { AuditQueryOptions } from '../repositories/audit-event.repository.js';

export function createAuditRoutes(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  /**
   * GET /projects/:projectId/audit — List audit events for a project.
   * R3-P7: events are enriched with human-readable labels (entityLabel +
   * per-change oldLabel/newLabel) so the UI never renders raw UUIDs.
   */
  router.get('/projects/:projectId/audit', zValidator('query', AuditQuerySchema), async (c) => {
    const projectId = c.req.param('projectId');
    const query = c.req.valid('query');
    const options: AuditQueryOptions = {
      page: query.page,
      limit: query.limit,
      entityType: query.entityType,
      entityId: query.entityId,
      action: query.action,
      actorId: query.actorId,
      sort: query.sort,
    };
    const result = await c.get('svc').audit.queryByProject(projectId, options);

    return c.json({ data: result.data, pagination: result.pagination });
  });

  /**
   * GET /tenants/:tenantId/audit — List audit events for a tenant.
   */
  router.get('/tenants/:tenantId/audit', zValidator('query', AuditQuerySchema), async (c) => {
    const tenantId = c.req.param('tenantId');
    const query = c.req.valid('query');
    const options: AuditQueryOptions = {
      page: query.page,
      limit: query.limit,
      entityType: query.entityType,
      entityId: query.entityId,
      action: query.action,
      actorId: query.actorId,
      sort: query.sort,
    };
    const result = await c.get('svc').audit.queryByTenant(tenantId, options);

    return c.json({ data: result.data, pagination: result.pagination });
  });

  return router;
}
