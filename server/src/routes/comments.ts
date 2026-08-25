import { Hono } from 'hono';
import type { AppEnv } from '../types/context.js';
import { validateBody } from '../middleware/validation.js';
import { CreateCommentSchema, UpdateCommentSchema } from '../schemas/comment.js';

export function createCommentRoutes(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  router.get('/tasks/:taskId/comments', async (c) => {
    const taskId = c.req.param('taskId');
    const comments = await c.get('svc').comments.getCommentsByTask(taskId);

    return c.json({ data: comments });
  });

  router.post('/tasks/:taskId/comments', validateBody(CreateCommentSchema), async (c) => {
    const taskId = c.req.param('taskId');
    const userId = c.get('userId');
    const body = c.req.valid('json');
    const comment = await c.get('svc').comments.createComment(taskId, userId, body);

    return c.json({ data: comment }, 201);
  });

  router.patch('/comments/:commentId', validateBody(UpdateCommentSchema), async (c) => {
    const commentId = c.req.param('commentId');
    const userId = c.get('userId');
    const tenantRole = c.get('tenantRole');
    const body = c.req.valid('json');
    const comment = await c.get('svc').comments.updateComment(commentId, userId, tenantRole, body);

    return c.json({ data: comment });
  });

  router.delete('/comments/:commentId', async (c) => {
    const commentId = c.req.param('commentId');
    const userId = c.get('userId');
    const tenantRole = c.get('tenantRole');

    await c.get('svc').comments.deleteComment(commentId, userId, tenantRole);

    return c.json({ data: { success: true } });
  });

  return router;
}
