import { Hono } from 'hono';
import type { AppEnv } from '../types/context.js';
import { validateBody } from '../middleware/validation.js';
import { TaskRelationshipService } from '../services/task-relationship.service.js';
import { TaskRelationshipRepository } from '../repositories/task-relationship.repository.js';
import { TaskRepository } from '../repositories/task.repository.js';
import { getCollection } from '../db/mongo.js';
import type { TaskRelationshipDocument } from '../repositories/task-relationship.repository.js';
import type { TaskDocument } from '../repositories/task.repository.js';
import { CreateTaskRelationshipSchema } from '../schemas/task-relationship.js';

export function createTaskRelationshipRoutes(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  router.get('/tasks/:taskId/relationships', async (c) => {
    const taskId = c.req.param('taskId');
    const service = createTaskRelationshipService();
    const relationships = await service.getRelationshipsByTask(taskId);

    return c.json({ data: relationships });
  });

  router.post('/tasks/:taskId/relationships', validateBody(CreateTaskRelationshipSchema), async (c) => {
    const taskId = c.req.param('taskId');
    const userId = c.get('userId');
    const body = c.get('validatedBody' as never) as { targetTaskId: string; type: string };
    const service = createTaskRelationshipService();
    const relationship = await service.createRelationship(taskId, userId, body as never);

    return c.json({ data: relationship }, 201);
  });

  router.delete('/task-relationships/:relationshipId', async (c) => {
    const relationshipId = c.req.param('relationshipId');
    const service = createTaskRelationshipService();

    await service.deleteRelationship(relationshipId);

    return c.json({ data: { success: true } });
  });

  return router;
}

function createTaskRelationshipService(): TaskRelationshipService {
  const relationshipRepo = new TaskRelationshipRepository(
    getCollection<TaskRelationshipDocument>('task_relationships'),
  );
  const taskRepo = new TaskRepository(getCollection<TaskDocument>('tasks')) as never;

  return new TaskRelationshipService(relationshipRepo, taskRepo);
}
