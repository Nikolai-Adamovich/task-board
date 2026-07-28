import { z } from 'zod';
import {
  BoardSchema,
  CreateBoardSchema,
  UpdateBoardSchema,
  ColumnSchema,
  CreateColumnSchema,
} from '../schemas/board.js';
import { ErrorResponseSchema } from '../schemas/common.js';

/**
 * Board-related API contracts.
 */
export const boardContracts = {
  /** Create a new board within a project */
  create: {
    method: 'POST' as const,
    path: '/boards',
    body: CreateBoardSchema,
    response: BoardSchema,
    error: ErrorResponseSchema,
  },

  /** List boards in a project */
  list: {
    method: 'GET' as const,
    path: '/boards',
    query: z.object({
      page: z.coerce.number().int().positive().default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
      projectId: z.string().uuid(),
    }),
    response: z.object({
      data: z.array(BoardSchema),
      total: z.number().int().nonnegative(),
      page: z.number().int().positive(),
      limit: z.number().int().positive(),
    }),
    error: ErrorResponseSchema,
  },

  /** Get a board by ID (includes columns) */
  getById: {
    method: 'GET' as const,
    path: '/boards/:id',
    response: BoardSchema,
    error: ErrorResponseSchema,
  },

  /** Update a board */
  update: {
    method: 'PATCH' as const,
    path: '/boards/:id',
    body: UpdateBoardSchema,
    response: BoardSchema,
    error: ErrorResponseSchema,
  },

  /** Delete a board */
  remove: {
    method: 'DELETE' as const,
    path: '/boards/:id',
    response: z.object({ success: z.literal(true) }),
    error: ErrorResponseSchema,
  },

  /** Add a column to a board */
  addColumn: {
    method: 'POST' as const,
    path: '/boards/:id/columns',
    body: CreateColumnSchema,
    response: ColumnSchema,
    error: ErrorResponseSchema,
  },

  /** List columns of a board */
  listColumns: {
    method: 'GET' as const,
    path: '/boards/:id/columns',
    response: z.object({
      data: z.array(ColumnSchema),
      total: z.number().int().nonnegative(),
    }),
    error: ErrorResponseSchema,
  },

  /** Update a column */
  updateColumn: {
    method: 'PATCH' as const,
    path: '/boards/:id/columns/:columnId',
    body: z.object({
      name: z.string().min(1).max(50).optional(),
      position: z.number().int().nonnegative().optional(),
    }),
    response: ColumnSchema,
    error: ErrorResponseSchema,
  },

  /** Delete a column */
  removeColumn: {
    method: 'DELETE' as const,
    path: '/boards/:id/columns/:columnId',
    response: z.object({ success: z.literal(true) }),
    error: ErrorResponseSchema,
  },
} as const;
