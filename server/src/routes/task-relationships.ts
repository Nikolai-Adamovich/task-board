import { Hono } from 'hono';
import type { AppEnv } from '../types/context.js';
import { validateBody } from '../middleware/validation.js';
import { CreateTaskRelationshipSchema } from '../schemas/task-relationship.js';

export function createTaskRelationshipRoutes(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  router.get('/tasks/:taskId/relationships', async (c) => {
    const taskId = c.req.param('taskId');
    const relationships = await c.get('svc').relationships.getRelationshipsByTask(taskId);

    return c.json({ data: relationships });
  });

  router.post('/tasks/:taskId/relationships', validateBody(CreateTaskRelationshipSchema), async (c) => {
    const taskId = c.req.param('taskId');
    const userId = c.get('userId');
    const body = c.req.valid('json');
    const relationship = await c.get('svc').relationships.createRelationship(taskId, userId, body);

    return c.json({ data: relationship }, 201);
  });

  router.delete('/task-relationships/:relationshipId', async (c) => {
    const relationshipId = c.req.param('relationshipId');

    await c.get('svc').relationships.deleteRelationship(relationshipId);

    return c.json({ data: { success: true } });
  });

  return router;
}
