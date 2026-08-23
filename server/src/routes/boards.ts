import { Hono } from 'hono';
import type { AppEnv } from '../types/context.js';
import { validateBody } from '../middleware/validation.js';
import { BoardService } from '../services/board.service.js';
import { BoardRepository } from '../repositories/board.repository.js';
import { StatusRepository } from '../repositories/status.repository.js';
import { getCollection } from '../db/mongo.js';
import type { BoardDocument } from '../repositories/board.repository.js';
import type { StatusDocument } from '../repositories/status.repository.js';
import { CreateBoardSchema, UpdateBoardSchema } from '../schemas/board.js';

// ─── Board Routes ────────────────────────────────────────────────────────────

export function createBoardRoutes(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  /**
   * GET /projects/:projectId/boards — List boards for a project.
   */
  router.get('/projects/:projectId/boards', async (c) => {
    const projectId = c.req.param('projectId');
    const service = createBoardService();
    const boards = await service.getBoardsByProject(projectId);

    return c.json({ data: boards });
  });

  /**
   * POST /projects/:projectId/boards — Create a board.
   */
  router.post('/projects/:projectId/boards', validateBody(CreateBoardSchema), async (c) => {
    const projectId = c.req.param('projectId');
    const body = c.get('validatedBody' as never) as {
      name: string;
      type: 'KANBAN' | 'SPRINT';
      columns: { statusIds: string[]; position: number }[];
    };
    const service = createBoardService();
    const board = await service.createBoard(projectId, body);

    return c.json({ data: board }, 201);
  });

  /**
   * GET /boards/:boardId — Get board details.
   */
  router.get('/boards/:boardId', async (c) => {
    const boardId = c.req.param('boardId');
    const service = createBoardService();
    const board = await service.getBoard(boardId);

    return c.json({ data: board });
  });

  /**
   * PATCH /boards/:boardId — Update board.
   */
  router.patch('/boards/:boardId', validateBody(UpdateBoardSchema), async (c) => {
    const boardId = c.req.param('boardId');
    const body = c.get('validatedBody' as never) as {
      name?: string;
      columns?: { id?: string; statusIds: string[]; position: number }[];
    };
    const service = createBoardService();
    const board = await service.updateBoard(boardId, body);

    return c.json({ data: board });
  });

  /**
   * DELETE /boards/:boardId — Delete board.
   */
  router.delete('/boards/:boardId', async (c) => {
    const boardId = c.req.param('boardId');
    const service = createBoardService();

    await service.deleteBoard(boardId);

    return c.json({ data: { success: true } });
  });

  return router;
}

// ─── Factory Helper ──────────────────────────────────────────────────────────

function createBoardService(): BoardService {
  const boardRepo = new BoardRepository(getCollection<BoardDocument>('boards'));
  const statusRepo = new StatusRepository(getCollection<StatusDocument>('statuses'));

  return new BoardService(boardRepo, statusRepo);
}
