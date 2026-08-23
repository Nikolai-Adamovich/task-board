import { Hono } from 'hono';
import type { AppEnv } from '../types/context.js';
import { validateBody } from '../middleware/validation.js';
import { FilterService } from '../services/filter.service.js';
import { FilterRepository } from '../repositories/filter.repository.js';
import { getCollection } from '../db/mongo.js';
import type { FilterDocument } from '../repositories/filter.repository.js';
import { CreateFilterSchema, UpdateFilterSchema } from '../schemas/filter.js';

export function createFilterRoutes(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  router.get('/projects/:projectId/filters', async (c) => {
    const projectId = c.req.param('projectId');
    const userId = c.get('userId');
    const service = createFilterService();
    const filters = await service.getFiltersByUserAndProject(userId, projectId);

    return c.json({ data: filters });
  });

  router.post('/projects/:projectId/filters', validateBody(CreateFilterSchema), async (c) => {
    const projectId = c.req.param('projectId');
    const userId = c.get('userId');
    const body = c.get('validatedBody' as never) as { name: string; filters: unknown; sort: unknown };
    const service = createFilterService();
    const filter = await service.createFilter(userId, projectId, body as never);

    return c.json({ data: filter }, 201);
  });

  router.patch('/filters/:filterId', validateBody(UpdateFilterSchema), async (c) => {
    const filterId = c.req.param('filterId');
    const userId = c.get('userId');
    const body = c.get('validatedBody' as never) as { name?: string; filters?: unknown; sort?: unknown };
    const service = createFilterService();
    const filter = await service.updateFilter(filterId, userId, body as never);

    return c.json({ data: filter });
  });

  router.delete('/filters/:filterId', async (c) => {
    const filterId = c.req.param('filterId');
    const userId = c.get('userId');
    const service = createFilterService();

    await service.deleteFilter(filterId, userId);

    return c.json({ data: { success: true } });
  });

  return router;
}

function createFilterService(): FilterService {
  const filterRepo = new FilterRepository(getCollection<FilterDocument>('filters'));

  return new FilterService(filterRepo);
}
