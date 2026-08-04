import { z } from 'zod';
import { HttpMethod } from '@task-board/shared';
import { UserSchema } from '../schemas/user.js';
import { ErrorResponseSchema } from '../schemas/common.js';

/**
 * User-related API contracts.
 * Note: user creation is handled via the auth/register endpoint.
 */
export const userContracts = {
  /** Get a user by ID */
  getById: {
    method: HttpMethod.Get,
    path: '/users/:id',
    response: UserSchema,
    error: ErrorResponseSchema,
  },

  /** List all users (admin endpoint) */
  list: {
    method: HttpMethod.Get,
    path: '/users',
    query: z.object({
      page: z.coerce.number().int().positive().default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
      search: z.string().optional(),
    }),
    response: z.object({
      data: z.array(UserSchema),
      total: z.number().int().nonnegative(),
      page: z.number().int().positive(),
      limit: z.number().int().positive(),
    }),
    error: ErrorResponseSchema,
  },
} as const;
