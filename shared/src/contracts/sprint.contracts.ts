import { z } from 'zod';
import { SprintSchema, CreateSprintSchema, UpdateSprintSchema } from '../schemas/sprint.js';
import { ErrorResponseSchema } from '../schemas/common.js';

/**
 * Sprint-related API contracts.
 */
export const sprintContracts = {
  /** Create a new sprint within a project */
  create: {
    method: 'POST' as const,
    path: '/sprints',
    body: CreateSprintSchema,
    response: SprintSchema,
    error: ErrorResponseSchema,
  },

  /** List sprints in a project */
  list: {
    method: 'GET' as const,
    path: '/sprints',
    query: z.object({
      page: z.coerce.number().int().positive().default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
      projectId: z.uuid(),
      status: z.enum(['planned', 'active', 'completed']).optional(),
    }),
    response: z.object({
      data: z.array(SprintSchema),
      total: z.number().int().nonnegative(),
      page: z.number().int().positive(),
      limit: z.number().int().positive(),
    }),
    error: ErrorResponseSchema,
  },

  /** Get a sprint by ID */
  getById: {
    method: 'GET' as const,
    path: '/sprints/:id',
    response: SprintSchema,
    error: ErrorResponseSchema,
  },

  /** Update a sprint */
  update: {
    method: 'PATCH' as const,
    path: '/sprints/:id',
    body: UpdateSprintSchema,
    response: SprintSchema,
    error: ErrorResponseSchema,
  },

  /** Delete a sprint */
  remove: {
    method: 'DELETE' as const,
    path: '/sprints/:id',
    response: z.object({ success: z.literal(true) }),
    error: ErrorResponseSchema,
  },
} as const;
