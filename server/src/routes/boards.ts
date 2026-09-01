import { Hono } from 'hono';
import type { AppEnv } from '../types/context.js';
import { validateBody } from '../middleware/validation.js';
import { requirePermission } from '../middleware/rbac.js';
import { UpdateBoardColumnsSchema } from '../schemas/board.js';

// ─── Board Routes (single-board model — doc 102) ─────────────────────────────
// A project owns exactly one board identified by its projectId. There is no
// board CRUD: the board is created with the project (seed) and deleted with it
// (cascade). The only mutations are reads and column/workflow edits.

export function createBoardRoutes(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  /**
   * GET /projects/:projectId/board — the project's single board.
   */
  router.get('/projects/:projectId/board', async (c) => {
    const projectId = c.req.param('projectId');
    const board = await c.get('svc').boards.getBoardByProject(projectId);

    return c.json({ data: board });
  });

  /**
   * PATCH /projects/:projectId/board — update the board's columns (workflow).
   * Coarse gate at the route (projectRole resolved by tenantContextMiddleware),
   * fine-grained re-check inside the service.
   */
  router.patch(
    '/projects/:projectId/board',
    requirePermission('manage_boards', true),
    validateBody(UpdateBoardColumnsSchema),
    async (c) => {
      const projectId = c.req.param('projectId');
      const userId = c.get('userId');
      const tenantRole = c.get('tenantRole');
      const body = c.req.valid('json');
      const board = await c.get('svc').boards.updateColumns(projectId, body, userId, tenantRole);

      return c.json({ data: board });
    },
  );

  return router;
}
