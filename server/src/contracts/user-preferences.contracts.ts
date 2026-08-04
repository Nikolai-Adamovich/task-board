import { HttpMethod } from '@task-board/shared';
import { UserPreferencesSchema, UpdateUserPreferencesSchema } from '../schemas/user-preferences.js';
import { ErrorResponseSchema } from '../schemas/common.js';

/**
 * User-preferences API contracts.
 */
export const userPreferencesContracts = {
  /** Get user preferences by user ID */
  get: {
    method: HttpMethod.Get,
    path: '/users/:id/preferences',
    response: UserPreferencesSchema,
    error: ErrorResponseSchema,
  },

  /** Update user preferences (partial) */
  update: {
    method: HttpMethod.Put,
    path: '/users/:id/preferences',
    body: UpdateUserPreferencesSchema,
    response: UserPreferencesSchema,
    error: ErrorResponseSchema,
  },
} as const;
