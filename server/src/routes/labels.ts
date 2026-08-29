import { Hono } from 'hono';
import type { AppEnv } from '../types/context.js';
import { validateBody } from '../middleware/validation.js';
import { requirePermission } from '../middleware/rbac.js';
import { CreateLabelSchema, UpdateLabelSchema } from '../schemas/label.js';

export function createLabelRoutes(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  router.get('/projects/:projectId/labels', async (c) => {
    const projectId = c.req.param('projectId');
    const labels = await c.get('svc').labels.getLabelsByProject(projectId);

    return c.json({ data: labels });
  });

  /**
   * Coarse gate at the route (projectRole resolved by tenantContextMiddleware),
   * fine-grained re-check inside the service.
   */
  router.post(
    '/projects/:projectId/labels',
    requirePermission('manage_labels', true),
    validateBody(CreateLabelSchema),
    async (c) => {
      const projectId = c.req.param('projectId');
      const body = c.req.valid('json');
      const label = await c.get('svc').labels.createLabel(projectId, body);

      return c.json({ data: label }, 201);
    },
  );

  /**
   * Authorization (manage_labels) is enforced inside the service after the
   * label's project is resolved — the route path carries no projectId.
   */
  router.patch('/labels/:labelId', validateBody(UpdateLabelSchema), async (c) => {
    const labelId = c.req.param('labelId');
    const userId = c.get('userId');
    const tenantRole = c.get('tenantRole');
    const body = c.req.valid('json');
    const label = await c.get('svc').labels.updateLabel(labelId, body, userId, tenantRole);

    return c.json({ data: label });
  });

  /**
   * Authorization (manage_labels) is enforced inside the service.
   */
  router.delete('/labels/:labelId', async (c) => {
    const labelId = c.req.param('labelId');
    const userId = c.get('userId');
    const tenantRole = c.get('tenantRole');

    await c.get('svc').labels.deleteLabel(labelId, userId, tenantRole);

    return c.json({ data: { success: true } });
  });

  return router;
}
