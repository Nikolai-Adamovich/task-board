import { Hono } from 'hono';
import type { AppEnv } from '../types/context.js';
import { validateBody } from '../middleware/validation.js';
import { CreateFilterSchema, UpdateFilterSchema } from '../schemas/filter.js';

export function createFilterRoutes(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  router.get('/projects/:projectId/filters', async (c) => {
    const projectId = c.req.param('projectId');
    const userId = c.get('userId');
    const filters = await c.get('svc').filters.getFiltersByUserAndProject(userId, projectId);

    return c.json({ data: filters });
  });

  router.post('/projects/:projectId/filters', validateBody(CreateFilterSchema), async (c) => {
    const projectId = c.req.param('projectId');
    const userId = c.get('userId');
    const body = c.req.valid('json');
    const filter = await c.get('svc').filters.createFilter(userId, projectId, body);

    return c.json({ data: filter }, 201);
  });

  router.patch('/filters/:filterId', validateBody(UpdateFilterSchema), async (c) => {
    const filterId = c.req.param('filterId');
    const userId = c.get('userId');
    const body = c.req.valid('json');
    const filter = await c.get('svc').filters.updateFilter(filterId, userId, body);

    return c.json({ data: filter });
  });

  router.delete('/filters/:filterId', async (c) => {
    const filterId = c.req.param('filterId');
    const userId = c.get('userId');

    await c.get('svc').filters.deleteFilter(filterId, userId);

    return c.json({ data: { success: true } });
  });

  return router;
}
