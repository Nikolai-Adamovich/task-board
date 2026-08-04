import { z } from 'zod';
import { HttpMethod } from '@task-board/shared';
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
    method: HttpMethod.Post,
    path: '/boards',
    body: CreateBoardSchema,
    response: BoardSchema,
    error: ErrorResponseSchema,
  },

  /** List boards in a project */
  list: {
    method: HttpMethod.Get,
    path: '/boards',
    query: z.object({
      page: z.coerce.number().int().positive().default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
      projectId: z.uuid(),
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
    method: HttpMethod.Get,
    path: '/boards/:id',
    response: BoardSchema,
    error: ErrorResponseSchema,
  },

  /** Update a board */
  update: {
    method: HttpMethod.Patch,
    path: '/boards/:id',
    body: UpdateBoardSchema,
    response: BoardSchema,
    error: ErrorResponseSchema,
  },

  /** Delete a board */
  remove: {
    method: HttpMethod.Delete,
    path: '/boards/:id',
    response: z.object({ success: z.literal(true) }),
    error: ErrorResponseSchema,
  },

  /** Add a column to a board */
  addColumn: {
    method: HttpMethod.Post,
    path: '/boards/:id/columns',
    body: CreateColumnSchema,
    response: ColumnSchema,
    error: ErrorResponseSchema,
  },

  /** List columns of a board */
  listColumns: {
    method: HttpMethod.Get,
    path: '/boards/:id/columns',
    response: z.object({
      data: z.array(ColumnSchema),
      total: z.number().int().nonnegative(),
    }),
    error: ErrorResponseSchema,
  },

  /** Update a column */
  updateColumn: {
    method: HttpMethod.Patch,
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
    method: HttpMethod.Delete,
    path: '/boards/:id/columns/:columnId',
    response: z.object({ success: z.literal(true) }),
    error: ErrorResponseSchema,
  },
} as const;
