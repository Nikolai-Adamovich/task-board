import { Hono } from 'hono';
import type { AppEnv } from '../types/context.js';
import { validateQuery } from '../middleware/validation.js';
import { AuditQuerySchema } from '../schemas/audit.js';
import type { AuditQueryOptions } from '../repositories/audit-event.repository.js';

export function createAuditRoutes(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  /**
   * GET /projects/:projectId/audit — List audit events for a project.
   * R3-P7: events are enriched with human-readable labels (entityLabel +
   * per-change oldLabel/newLabel) so the UI never renders raw UUIDs.
   */
  // M-07: validateQuery throws ValidationError → the standard
  // `{ error: { code, message } }` envelope (raw zValidator returned a plain 400).
  router.get('/projects/:projectId/audit', validateQuery(AuditQuerySchema), async (c) => {
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
  router.get('/tenants/:tenantId/audit', validateQuery(AuditQuerySchema), async (c) => {
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
