import { Hono } from 'hono';
import type { AppEnv } from '../types/context.js';
import { validateBody } from '../middleware/validation.js';
import { CommentService } from '../services/comment.service.js';
import { CommentRepository } from '../repositories/comment.repository.js';
import { UserRepository } from '../repositories/user.repository.js';
import { getCollection } from '../db/mongo.js';
import type { CommentDocument } from '../repositories/comment.repository.js';
import type { UserDocument } from '../repositories/user.repository.js';
import { CreateCommentSchema, UpdateCommentSchema } from '../schemas/comment.js';

export function createCommentRoutes(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  router.get('/tasks/:taskId/comments', async (c) => {
    const taskId = c.req.param('taskId');
    const service = createCommentService();
    const comments = await service.getCommentsByTask(taskId);

    return c.json({ data: comments });
  });

  router.post('/tasks/:taskId/comments', validateBody(CreateCommentSchema), async (c) => {
    const taskId = c.req.param('taskId');
    const userId = c.get('userId');
    const body = c.get('validatedBody' as never) as { body: string };
    const service = createCommentService();
    const comment = await service.createComment(taskId, userId, body);

    return c.json({ data: comment }, 201);
  });

  router.patch('/comments/:commentId', validateBody(UpdateCommentSchema), async (c) => {
    const commentId = c.req.param('commentId');
    const userId = c.get('userId');
    const tenantRole = c.get('tenantRole');
    const body = c.get('validatedBody' as never) as { body: string };
    const service = createCommentService();
    const comment = await service.updateComment(commentId, userId, tenantRole, body);

    return c.json({ data: comment });
  });

  router.delete('/comments/:commentId', async (c) => {
    const commentId = c.req.param('commentId');
    const userId = c.get('userId');
    const tenantRole = c.get('tenantRole');
    const service = createCommentService();

    await service.deleteComment(commentId, userId, tenantRole);

    return c.json({ data: { success: true } });
  });

  return router;
}

function createCommentService(): CommentService {
  const commentRepo = new CommentRepository(getCollection<CommentDocument>('comments'));
  const userRepo = new UserRepository(getCollection<UserDocument>('users')) as never;

  return new CommentService(commentRepo, userRepo);
}
