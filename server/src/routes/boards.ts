import { Hono } from 'hono';
import type { AppEnv } from '../types/context.js';
import { validateBody } from '../middleware/validation.js';
import { BoardService } from '../services/board.service.js';
import { BoardRepository } from '../repositories/board.repository.js';
import { ColumnRepository } from '../repositories/column.repository.js';
import { getCollection } from '../db/mongo.js';
import type { BoardDocument } from '../repositories/board.repository.js';
import type { ColumnDocument } from '../repositories/column.repository.js';
import { CreateBoardSchema, UpdateBoardSchema } from '../schemas/board.js';

// ─── Board Routes ────────────────────────────────────────────────────────────

/**
 * Creates and returns the board Hono app with all board-related routes.
 *
 * Tenant context is already resolved. Board routes expect `projectId` as a
 * query parameter for listing and as part of the body for creation.
 */
export function createBoardRoutes(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  /**
   * GET / — List boards for a project.
   * Requires `projectId` query parameter.
   */
  router.get('/', async (c) => {
    const tenantId = c.get('tenantId');
    const projectId = c.req.query('projectId');

    if (!projectId) {
      return c.json({ code: 'VALIDATION_ERROR', message: 'projectId query parameter is required' }, 422);
    }

    const service = createBoardService();
    const boards = await service.listBoards(tenantId, projectId);

    return c.json({
      data: boards,
      total: boards.length,
      page: 1,
      limit: boards.length,
    });
  });

  /**
   * POST / — Create a new board with default columns. Admin+ only.
   * Body includes `projectId` to associate the board with a project.
   */
  router.post('/', validateBody(CreateBoardSchema), async (c) => {
    const tenantId = c.get('tenantId');
    const userRole = c.get('userRole');
    const body = c.get('validatedBody' as never) as {
      name: string;
      description?: string;
      columnNames?: string[];
    };
    const projectId = c.req.query('projectId');

    if (!projectId) {
      return c.json({ code: 'VALIDATION_ERROR', message: 'projectId query parameter is required' }, 422);
    }

    const service = createBoardService();
    const result = await service.createBoard(tenantId, { ...body, projectId }, userRole);

    return c.json({ ...result.board, columns: result.columns }, 201);
  });

  /**
   * GET /:boardId — Get board with columns.
   */
  router.get('/:boardId', async (c) => {
    const tenantId = c.get('tenantId');
    const boardId = c.req.param('boardId');
    const service = createBoardService();
    const result = await service.getBoard(tenantId, boardId);

    return c.json({ ...result.board, columns: result.columns });
  });

  /**
   * PATCH /:boardId — Update board. Admin+ only.
   */
  router.patch('/:boardId', validateBody(UpdateBoardSchema), async (c) => {
    const tenantId = c.get('tenantId');
    const userRole = c.get('userRole');
    const boardId = c.req.param('boardId');
    const body = c.get('validatedBody' as never) as {
      name?: string;
      description?: string;
    };
    const service = createBoardService();
    const board = await service.updateBoard(tenantId, boardId, body, userRole);

    return c.json(board);
  });

  /**
   * DELETE /:boardId — Delete board. Admin+ only.
   */
  router.delete('/:boardId', async (c) => {
    const tenantId = c.get('tenantId');
    const userRole = c.get('userRole');
    const boardId = c.req.param('boardId');
    const service = createBoardService();

    await service.deleteBoard(tenantId, boardId, userRole);

    return c.json({ success: true as const });
  });

  return router;
}

// ─── Factory Helper ──────────────────────────────────────────────────────────

function createBoardService(): BoardService {
  const boardRepo = new BoardRepository(getCollection<BoardDocument>('boards'));
  const columnRepo = new ColumnRepository(getCollection<ColumnDocument>('columns'));

  return new BoardService(boardRepo, columnRepo);
}
