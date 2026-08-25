import { Hono } from 'hono';
import type { AppEnv } from '../types/context.js';
import { validateBody } from '../middleware/validation.js';
import { CreateLabelSchema, UpdateLabelSchema } from '../schemas/label.js';

export function createLabelRoutes(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  router.get('/projects/:projectId/labels', async (c) => {
    const projectId = c.req.param('projectId');
    const labels = await c.get('svc').labels.getLabelsByProject(projectId);

    return c.json({ data: labels });
  });

  router.post('/projects/:projectId/labels', validateBody(CreateLabelSchema), async (c) => {
    const projectId = c.req.param('projectId');
    const body = c.req.valid('json');
    const label = await c.get('svc').labels.createLabel(projectId, body);

    return c.json({ data: label }, 201);
  });

  router.patch('/labels/:labelId', validateBody(UpdateLabelSchema), async (c) => {
    const labelId = c.req.param('labelId');
    const body = c.req.valid('json');
    const label = await c.get('svc').labels.updateLabel(labelId, body);

    return c.json({ data: label });
  });

  router.delete('/labels/:labelId', async (c) => {
    const labelId = c.req.param('labelId');

    await c.get('svc').labels.deleteLabel(labelId);

    return c.json({ data: { success: true } });
  });

  return router;
}
