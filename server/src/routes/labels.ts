import { Hono } from 'hono';
import type { AppEnv } from '../types/context.js';
import { validateBody } from '../middleware/validation.js';
import { LabelService } from '../services/label.service.js';
import { LabelRepository } from '../repositories/label.repository.js';
import { TaskRepository } from '../repositories/task.repository.js';
import { getCollection } from '../db/mongo.js';
import type { LabelDocument } from '../repositories/label.repository.js';
import type { TaskDocument } from '../repositories/task.repository.js';
import { CreateLabelSchema, UpdateLabelSchema } from '../schemas/label.js';

export function createLabelRoutes(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  router.get('/projects/:projectId/labels', async (c) => {
    const projectId = c.req.param('projectId');
    const service = createLabelService();
    const labels = await service.getLabelsByProject(projectId);

    return c.json({ data: labels });
  });

  router.post('/projects/:projectId/labels', validateBody(CreateLabelSchema), async (c) => {
    const projectId = c.req.param('projectId');
    const body = c.get('validatedBody' as never) as { name: string };
    const service = createLabelService();
    const label = await service.createLabel(projectId, body);

    return c.json({ data: label }, 201);
  });

  router.patch('/labels/:labelId', validateBody(UpdateLabelSchema), async (c) => {
    const labelId = c.req.param('labelId');
    const body = c.get('validatedBody' as never) as { name: string };
    const service = createLabelService();
    const label = await service.updateLabel(labelId, body);

    return c.json({ data: label });
  });

  router.delete('/labels/:labelId', async (c) => {
    const labelId = c.req.param('labelId');
    const service = createLabelService();

    await service.deleteLabel(labelId);

    return c.json({ data: { success: true } });
  });

  return router;
}

function createLabelService(): LabelService {
  const labelRepo = new LabelRepository(getCollection<LabelDocument>('labels'));
  const taskRepo = new TaskRepository(getCollection<TaskDocument>('tasks')) as never;

  return new LabelService(labelRepo, taskRepo);
}
