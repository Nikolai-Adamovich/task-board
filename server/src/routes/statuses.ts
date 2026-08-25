import { Hono } from 'hono';
import type { AppEnv } from '../types/context.js';
import { validateBody } from '../middleware/validation.js';
import { CreateStatusSchema, UpdateStatusSchema, DeleteStatusSchema, ReorderStatusSchema } from '../schemas/status.js';

// ─── Status Routes ───────────────────────────────────────────────────────────

export function createStatusRoutes(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  /**
   * GET /projects/:projectId/statuses — List statuses for a project.
   */
  router.get('/projects/:projectId/statuses', async (c) => {
    const projectId = c.req.param('projectId');
    const statuses = await c.get('svc').statuses.getStatusesByProject(projectId);

    return c.json({ data: statuses });
  });

  /**
   * POST /projects/:projectId/statuses — Create a status.
   */
  router.post('/projects/:projectId/statuses', validateBody(CreateStatusSchema), async (c) => {
    const projectId = c.req.param('projectId');
    const userId = c.get('userId');
    const body = c.req.valid('json');
    const status = await c.get('svc').statuses.createStatus(projectId, body, userId);

    return c.json({ data: status }, 201);
  });

  /**
   * PATCH /projects/:projectId/statuses/reorder — Reorder statuses in one bulk pass.
   */
  router.patch('/projects/:projectId/statuses/reorder', validateBody(ReorderStatusSchema), async (c) => {
    const projectId = c.req.param('projectId');
    const body = c.req.valid('json');
    const statuses = await c.get('svc').statuses.reorder(projectId, body.items);

    return c.json({ data: statuses });
  });

  /**
   * PATCH /statuses/:statusId — Update a status.
   */
  router.patch('/statuses/:statusId', validateBody(UpdateStatusSchema), async (c) => {
    const statusId = c.req.param('statusId');
    const userId = c.get('userId');
    const body = c.req.valid('json');
    const status = await c.get('svc').statuses.updateStatus(statusId, body, userId);

    return c.json({ data: status });
  });

  /**
   * DELETE /statuses/:statusId — Delete a status (with optional replacement via body).
   */
  router.delete('/statuses/:statusId', validateBody(DeleteStatusSchema), async (c) => {
    const statusId = c.req.param('statusId');
    const userId = c.get('userId');
    const body = c.req.valid('json');

    await c.get('svc').statuses.deleteStatus(statusId, body.replacementStatusId, userId);

    return c.json({ data: { success: true } });
  });

  return router;
}
