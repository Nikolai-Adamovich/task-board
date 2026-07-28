import { z } from 'zod';

/**
 * Board entity schema.
 * A board belongs to a project and contains columns and tasks.
 */
export const BoardSchema = z.object({
  /** Unique board identifier (UUID v4) */
  id: z.string().uuid(),
  /** Owning tenant ID */
  tenantId: z.string().uuid(),
  /** Parent project ID */
  projectId: z.string().uuid(),
  /** Board name */
  name: z.string().min(1).max(100),
  /** Optional board description */
  description: z.string().max(500).nullable().optional(),
  /** Creation timestamp (ISO 8601) */
  createdAt: z.string().datetime(),
  /** Last update timestamp (ISO 8601) */
  updatedAt: z.string().datetime(),
});

/** Inferred Board type */
export type Board = z.infer<typeof BoardSchema>;

/**
 * Schema for creating a new board.
 * Includes optional column names; defaults will be used if not provided.
 */
export const CreateBoardSchema = z.object({
  name: z.string().min(1, 'Board name is required').max(100, 'Board name must be at most 100 characters'),
  description: z.string().max(500).optional(),
  /** Custom column names for the board (optional — defaults are used otherwise) */
  columnNames: z.array(z.string().min(1).max(50)).optional(),
});

/** Inferred CreateBoard type */
export type CreateBoard = z.infer<typeof CreateBoardSchema>;

/**
 * Schema for updating an existing board.
 * All fields are optional (partial update).
 */
export const UpdateBoardSchema = z.object({
  name: z
    .string()
    .min(1, 'Board name cannot be empty')
    .max(100, 'Board name must be at most 100 characters')
    .optional(),
  description: z.string().max(500).optional(),
});

/** Inferred UpdateBoard type */
export type UpdateBoard = z.infer<typeof UpdateBoardSchema>;

/**
 * Column entity schema.
 * A column belongs to a board and holds ordered tasks.
 */
export const ColumnSchema = z.object({
  /** Unique column identifier (UUID v4) */
  id: z.string().uuid(),
  /** Parent board ID */
  boardId: z.string().uuid(),
  /** Owning tenant ID */
  tenantId: z.string().uuid(),
  /** Column display name */
  name: z.string().min(1).max(50),
  /** Position/order of the column within the board (0-based) */
  position: z.number().int().nonnegative(),
  /** Whether this is a default column (cannot be deleted) */
  isDefault: z.boolean(),
  /** Creation timestamp (ISO 8601) */
  createdAt: z.string().datetime(),
});

/** Inferred Column type */
export type Column = z.infer<typeof ColumnSchema>;

/**
 * Schema for creating a new column in a board.
 */
export const CreateColumnSchema = z.object({
  name: z.string().min(1, 'Column name is required').max(50, 'Column name must be at most 50 characters'),
  /** Position/order within the board. If omitted, column is appended at the end. */
  position: z.number().int().nonnegative().optional(),
});

/** Inferred CreateColumn type */
export type CreateColumn = z.infer<typeof CreateColumnSchema>;
