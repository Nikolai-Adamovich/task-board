import { z } from 'zod';
import {
  uuid,
  nonEmptyString,
  optionalString,
  nullableOptionalString,
  isoDateTime,
  nonNegativeInt,
} from '../validators/common.js';

/**
 * Board entity schema.
 * A board belongs to a project and contains columns and tasks.
 */
export const BoardSchema = z.object({
  /** Unique board identifier (UUID v4) */
  id: uuid(),
  /** Owning tenant ID */
  tenantId: uuid(),
  /** Parent project ID */
  projectId: uuid(),
  /** Board name */
  name: nonEmptyString(100, 'Board name'),
  /** Optional board description */
  description: nullableOptionalString(500),
  /** Creation timestamp (ISO 8601) */
  createdAt: isoDateTime(),
  /** Last update timestamp (ISO 8601) */
  updatedAt: isoDateTime(),
});

/** Inferred Board type */
export type Board = z.infer<typeof BoardSchema>;

/**
 * Schema for creating a new board.
 * Includes optional column names; defaults will be used if not provided.
 */
export const CreateBoardSchema = z.object({
  name: nonEmptyString(100, 'Board name'),
  description: optionalString(500),
  /** Custom column names for the board (optional — defaults are used otherwise) */
  columnNames: z.array(nonEmptyString(50, 'Column name')).optional(),
});

/** Inferred CreateBoard type */
export type CreateBoard = z.infer<typeof CreateBoardSchema>;

/**
 * Schema for updating an existing board.
 * All fields are optional (partial update).
 */
export const UpdateBoardSchema = z.object({
  name: nonEmptyString(100, 'Board name').optional(),
  description: optionalString(500),
});

/** Inferred UpdateBoard type */
export type UpdateBoard = z.infer<typeof UpdateBoardSchema>;

/**
 * Column entity schema.
 * A column belongs to a board and holds ordered tasks.
 */
export const ColumnSchema = z.object({
  /** Unique column identifier (UUID v4) */
  id: uuid(),
  /** Parent board ID */
  boardId: uuid(),
  /** Owning tenant ID */
  tenantId: uuid(),
  /** Column display name */
  name: nonEmptyString(50, 'Column name'),
  /** Position/order of the column within the board (0-based) */
  position: nonNegativeInt(),
  /** Whether this is a default column (cannot be deleted) */
  isDefault: z.boolean(),
  /** Creation timestamp (ISO 8601) */
  createdAt: isoDateTime(),
});

/** Inferred Column type */
export type Column = z.infer<typeof ColumnSchema>;

/**
 * Schema for creating a new column in a board.
 */
export const CreateColumnSchema = z.object({
  name: nonEmptyString(50, 'Column name'),
  /** Position/order within the board. If omitted, column is appended at the end. */
  position: nonNegativeInt().optional(),
});

/** Inferred CreateColumn type */
export type CreateColumn = z.infer<typeof CreateColumnSchema>;
