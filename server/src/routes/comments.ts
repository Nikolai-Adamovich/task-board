import { Hono } from 'hono';
import type { AppEnv } from '../types/context.js';
import { validateBody } from '../middleware/validation.js';
import { CreateCommentSchema, UpdateCommentSchema } from '../schemas/comment.js';

export function createCommentRoutes(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  router.get('/tasks/:taskId/comments', async (c) => {
    const taskId = c.req.param('taskId');
    const tenantId = c.get('tenantId');
    // M-02: bare task ids are tenant-asserted inside the service
    const comments = await c.get('svc').comments.getCommentsByTask(taskId, tenantId);

    return c.json({ data: comments });
  });

  router.post('/tasks/:taskId/comments', validateBody(CreateCommentSchema), async (c) => {
    const taskId = c.req.param('taskId');
    const userId = c.get('userId');
    const tenantId = c.get('tenantId');
    const tenantRole = c.get('tenantRole');
    const body = c.req.valid('json');
    // Authorization (create_comment) is enforced inside the service after the
    // task's project is resolved — the route path carries no projectId.
    // M-06: resolve the task once via the comment service's own task repo so
    // the action is audit-logged with its tenant/project context.
    const task = await c.get('svc').comments.resolveTask(taskId);
    const comment = await c
      .get('svc')
      .comments.createComment(taskId, userId, body, { tenantId, projectId: task.projectId }, tenantRole);

    return c.json({ data: comment }, 201);
  });

  router.patch('/comments/:commentId', validateBody(UpdateCommentSchema), async (c) => {
    const commentId = c.req.param('commentId');
    const userId = c.get('userId');
    const tenantId = c.get('tenantId');
    const tenantRole = c.get('tenantRole');
    const body = c.req.valid('json');
    // M-06: resolve the comment's task once so the update is audit-logged.
    const task = await c.get('svc').comments.resolveTaskForComment(commentId);
    const comment = await c
      .get('svc')
      .comments.updateComment(commentId, userId, tenantRole, body, { tenantId, projectId: task.projectId });

    return c.json({ data: comment });
  });

  router.delete('/comments/:commentId', async (c) => {
    const commentId = c.req.param('commentId');
    const userId = c.get('userId');
    const tenantId = c.get('tenantId');
    const tenantRole = c.get('tenantRole');
    // M-06: resolve the comment's task once so the delete is audit-logged.
    const task = await c.get('svc').comments.resolveTaskForComment(commentId);

    await c.get('svc').comments.deleteComment(commentId, userId, tenantRole, { tenantId, projectId: task.projectId });

    return c.json({ data: { success: true } });
  });

  return router;
}
