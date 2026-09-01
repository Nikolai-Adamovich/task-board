import { z } from 'zod';
import { uuid } from '../validators/common.js';

/**
 * Board column schema — embedded value object.
 */
const BoardColumnSchema = z.object({
  id: uuid().optional(),
  statusIds: z.array(uuid()).min(1, 'Each column must have at least one status'),
  position: z.number().int().nonnegative(),
});

/**
 * Schema for updating the project's single board (columns/workflow).
 * The board itself cannot be created/deleted/renamed via the API — it is
 * created with the project and dies with it (single-board model, doc 102).
 */
export const UpdateBoardColumnsSchema = z.object({
  columns: z.array(BoardColumnSchema).min(1, 'Board must have at least one column'),
});
