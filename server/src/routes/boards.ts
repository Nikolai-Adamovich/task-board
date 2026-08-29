import { Hono } from 'hono';
import type { AppEnv } from '../types/context.js';
import { validateBody } from '../middleware/validation.js';
import { requirePermission } from '../middleware/rbac.js';
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
   * Coarse gate at the route (projectRole resolved by tenantContextMiddleware),
   * fine-grained re-check inside the service.
   */
  router.post(
    '/projects/:projectId/boards',
    requirePermission('manage_boards', true),
    validateBody(CreateBoardSchema),
    async (c) => {
      const projectId = c.req.param('projectId');
      const body = c.req.valid('json');
      const board = await c.get('svc').boards.createBoard(projectId, body);

      return c.json({ data: board }, 201);
    },
  );

  /**
   * GET /boards/:boardId — Get board details.
   */
  router.get('/boards/:boardId', async (c) => {
    const boardId = c.req.param('boardId');
    // M-02: bare board ids are tenant-asserted inside the service
    const board = await c.get('svc').boards.getBoard(boardId, c.get('tenantId'));

    return c.json({ data: board });
  });

  /**
   * PATCH /boards/:boardId — Update board.
   * Authorization (manage_boards) is enforced inside the service after the
   * board's project is resolved — the route path carries no projectId.
   */
  router.patch('/boards/:boardId', validateBody(UpdateBoardSchema), async (c) => {
    const boardId = c.req.param('boardId');
    const userId = c.get('userId');
    const tenantId = c.get('tenantId');
    const tenantRole = c.get('tenantRole');
    const body = c.req.valid('json');
    const board = await c.get('svc').boards.updateBoard(boardId, tenantId, body, userId, tenantRole);

    return c.json({ data: board });
  });

  /**
   * DELETE /boards/:boardId — Delete board.
   * Authorization (manage_boards) is enforced inside the service.
   */
  router.delete('/boards/:boardId', async (c) => {
    const boardId = c.req.param('boardId');
    const userId = c.get('userId');
    const tenantRole = c.get('tenantRole');

    await c.get('svc').boards.deleteBoard(boardId, userId, tenantRole);

    return c.json({ data: { success: true } });
  });

  return router;
}
