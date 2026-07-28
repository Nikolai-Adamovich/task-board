import { LoginRequestSchema, RegisterRequestSchema, AuthResponseSchema } from '../schemas/auth.js';
import { UserSchema } from '../schemas/user.js';
import { ErrorResponseSchema } from '../schemas/common.js';

/**
 * Auth-related API contracts.
 */
export const authContracts = {
  /** Register a new user account */
  register: {
    method: 'POST' as const,
    path: '/auth/register',
    body: RegisterRequestSchema,
    response: AuthResponseSchema,
    error: ErrorResponseSchema,
  },

  /** Log in with email and password */
  login: {
    method: 'POST' as const,
    path: '/auth/login',
    body: LoginRequestSchema,
    response: AuthResponseSchema,
    error: ErrorResponseSchema,
  },

  /** Get the currently authenticated user */
  me: {
    method: 'GET' as const,
    path: '/auth/me',
    response: UserSchema,
    error: ErrorResponseSchema,
  },
} as const;
