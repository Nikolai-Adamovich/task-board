import { Hono } from 'hono';
import type { AppEnv } from '../types/context.js';
import { AuditService } from '../services/audit.service.js';
import { AuditEventRepository, type AuditQueryOptions } from '../repositories/audit-event.repository.js';
import { UserRepository } from '../repositories/user.repository.js';
import { getCollection } from '../db/mongo.js';
import type { AuditEventDocument } from '../repositories/audit-event.repository.js';
import type { UserDocument } from '../repositories/user.repository.js';

export function createAuditRoutes(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  /**
   * GET /projects/:projectId/audit — List audit events for a project.
   */
  router.get('/projects/:projectId/audit', async (c) => {
    const projectId = c.req.param('projectId');
    const pageStr1 = c.req.query('page');
    const limitStr1 = c.req.query('limit');
    const options: AuditQueryOptions = {
      page: pageStr1 ? parseInt(pageStr1, 10) : 1,
      limit: limitStr1 ? parseInt(limitStr1, 10) : 20,
      entityType: c.req.query('entityType'),
      entityId: c.req.query('entityId'),
    };
    const service = createAuditService();
    const result = await service.queryByProject(projectId, options);

    return c.json({ data: result.data, pagination: result.pagination });
  });

  /**
   * GET /tenants/:tenantId/audit — List audit events for a tenant.
   */
  router.get('/tenants/:tenantId/audit', async (c) => {
    const tenantId = c.req.param('tenantId');
    const pageStr2 = c.req.query('page');
    const limitStr2 = c.req.query('limit');
    const options2: AuditQueryOptions = {
      page: pageStr2 ? parseInt(pageStr2, 10) : 1,
      limit: limitStr2 ? parseInt(limitStr2, 10) : 20,
      entityType: c.req.query('entityType'),
      entityId: c.req.query('entityId'),
    };
    const service2 = createAuditService();
    const result = await service2.queryByTenant(tenantId, options2);

    return c.json({ data: result.data, pagination: result.pagination });
  });

  return router;
}

function createAuditService(): AuditService {
  const auditRepo = new AuditEventRepository(getCollection<AuditEventDocument>('audit_events'));
  const userRepo = new UserRepository(getCollection<UserDocument>('users')) as never;

  return new AuditService(auditRepo, userRepo);
}
