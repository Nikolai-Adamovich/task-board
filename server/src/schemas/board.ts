import { z } from 'zod';
import { BoardTypeValues } from '@task-board/shared';
import { uuid, nonEmptyString } from '../validators/common.js';

/**
 * Board column schema — embedded value object.
 */
const BoardColumnSchema = z.object({
  id: uuid().optional(),
  statusIds: z.array(uuid()).min(1, 'Each column must have at least one status'),
  position: z.number().int().nonnegative(),
});

/**
 * Schema for creating a new board with embedded columns.
 */
export const CreateBoardSchema = z.object({
  name: nonEmptyString(200, 'Board name'),
  type: z.enum(BoardTypeValues),
  columns: z.array(BoardColumnSchema).min(1, 'Board must have at least one column'),
});

/**
 * Schema for updating an existing board.
 * All fields are optional (partial update).
 */
export const UpdateBoardSchema = z.object({
  name: nonEmptyString(200, 'Board name').optional(),
  columns: z.array(BoardColumnSchema).optional(),
});
