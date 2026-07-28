import type { z } from 'zod';
import type {
  BoardSchema,
  CreateBoardSchema,
  UpdateBoardSchema,
  ColumnSchema,
  CreateColumnSchema,
} from '../schemas/board.js';

/** Board entity type */
export type Board = z.infer<typeof BoardSchema>;

/** Create board request body type */
export type CreateBoard = z.infer<typeof CreateBoardSchema>;

/** Update board request body type */
export type UpdateBoard = z.infer<typeof UpdateBoardSchema>;

/** Column entity type */
export type Column = z.infer<typeof ColumnSchema>;

/** Create column request body type */
export type CreateColumn = z.infer<typeof CreateColumnSchema>;
