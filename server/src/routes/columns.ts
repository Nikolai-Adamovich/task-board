import { Hono } from 'hono';
import type { AppEnv } from '../types/context.js';
import { validateBody } from '../middleware/validation.js';
import { ColumnService } from '../services/column.service.js';
import { ColumnRepository } from '../repositories/column.repository.js';
import { getCollection } from '../db/mongo.js';
import type { ColumnDocument } from '../repositories/column.repository.js';
import { CreateColumnSchema } from '@task-board/shared';
import { z } from 'zod';

// ─── Schemas ─────────────────────────────────────────────────────────────────

const UpdateColumnSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  position: z.number().int().nonnegative().optional(),
});
const ReorderColumnsSchema = z.object({
  columnIds: z.array(z.uuid()).min(1),
});

// ─── Column Routes ───────────────────────────────────────────────────────────

/**
 * Creates and returns the column Hono app.
 *
 * These routes are nested under boards: `/boards/:boardId/columns`.
 * The `boardId` parameter is extracted from the parent route.
 */
export function createColumnRoutes(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  /**
   * GET / — List all columns for a board, sorted by position.
   */
  router.get('/', async (c) => {
    const tenantId = c.get('tenantId');
    const boardId = c.req.param('boardId') ?? '';
    const service = createColumnService();
    const columns = await service.listColumns(tenantId, boardId);

    return c.json({
      data: columns,
      total: columns.length,
    });
  });

  /**
   * POST / — Create a new column. Admin+ only.
   */
  router.post('/', validateBody(CreateColumnSchema), async (c) => {
    const tenantId = c.get('tenantId');
    const userRole = c.get('userRole');
    const boardId = c.req.param('boardId') ?? '';
    const body = c.get('validatedBody' as never) as {
      name: string;
      position?: number;
    };
    const service = createColumnService();
    const column = await service.createColumn(tenantId, boardId, body, userRole);

    return c.json(column, 201);
  });

  /**
   * PATCH /reorder — Reorder columns within a board. Admin+ only.
   * Must be registered before /:columnId to avoid route conflicts.
   */
  router.patch('/reorder', validateBody(ReorderColumnsSchema), async (c) => {
    const tenantId = c.get('tenantId');
    const userRole = c.get('userRole');
    const boardId = c.req.param('boardId') ?? '';
    const body = c.get('validatedBody' as never) as { columnIds: string[] };
    const service = createColumnService();
    const columns = await service.reorderColumns(tenantId, boardId, body.columnIds, userRole);

    return c.json({ data: columns });
  });

  /**
   * PATCH /:columnId — Update a column. Admin+ only.
   */
  router.patch('/:columnId', validateBody(UpdateColumnSchema), async (c) => {
    const tenantId = c.get('tenantId');
    const userRole = c.get('userRole');
    const columnId = c.req.param('columnId');
    const body = c.get('validatedBody' as never) as {
      name?: string;
      position?: number;
    };
    const service = createColumnService();
    const column = await service.updateColumn(tenantId, columnId, body, userRole);

    return c.json(column);
  });

  /**
   * DELETE /:columnId — Delete a column. Admin+ only.
   */
  router.delete('/:columnId', async (c) => {
    const tenantId = c.get('tenantId');
    const userRole = c.get('userRole');
    const columnId = c.req.param('columnId');
    const service = createColumnService();

    await service.deleteColumn(tenantId, columnId, userRole);

    return c.json({ success: true as const });
  });

  return router;
}

// ─── Factory Helper ──────────────────────────────────────────────────────────

function createColumnService(): ColumnService {
  const columnRepo = new ColumnRepository(getCollection<ColumnDocument>('columns'));

  return new ColumnService(columnRepo);
}
