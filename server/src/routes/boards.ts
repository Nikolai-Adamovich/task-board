import { Hono } from 'hono';
import type { AppEnv } from '../types/context.js';
import { validateBody } from '../middleware/validation.js';
import { CreateBoardSchema, UpdateBoardSchema } from '../schemas/board.js';

// ─── Board Routes ────────────────────────────────────────────────────────────

export function createBoardRoutes(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  /**
   * GET /projects/:projectId/boards — List boards for a project.
   */
  router.get('/projects/:projectId/boards', async (c) => {
    const projectId = c.req.param('projectId');
    const boards = await c.get('svc').boards.getBoardsByProject(projectId);

    return c.json({ data: boards });
  });

  /**
   * POST /projects/:projectId/boards — Create a board.
   */
  router.post('/projects/:projectId/boards', validateBody(CreateBoardSchema), async (c) => {
    const projectId = c.req.param('projectId');
    const body = c.req.valid('json');
    const board = await c.get('svc').boards.createBoard(projectId, body);

    return c.json({ data: board }, 201);
  });

  /**
   * GET /boards/:boardId — Get board details.
   */
  router.get('/boards/:boardId', async (c) => {
    const boardId = c.req.param('boardId');
    const board = await c.get('svc').boards.getBoard(boardId);

    return c.json({ data: board });
  });

  /**
   * PATCH /boards/:boardId — Update board.
   */
  router.patch('/boards/:boardId', validateBody(UpdateBoardSchema), async (c) => {
    const boardId = c.req.param('boardId');
    const body = c.req.valid('json');
    const board = await c.get('svc').boards.updateBoard(boardId, body);

    return c.json({ data: board });
  });

  /**
   * DELETE /boards/:boardId — Delete board.
   */
  router.delete('/boards/:boardId', async (c) => {
    const boardId = c.req.param('boardId');

    await c.get('svc').boards.deleteBoard(boardId);

    return c.json({ data: { success: true } });
  });

  return router;
}
