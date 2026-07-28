import { z } from 'zod';
import { UserSchema } from './user.js';

/**
 * Schema for login request body.
 */
export const LoginRequestSchema = z.object({
  email: z.email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

/** Inferred LoginRequest type */
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

/**
 * Schema for registration request body.
 */
export const RegisterRequestSchema = z.object({
  email: z.email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters'),
  displayName: z.string().min(1, 'Display name is required').max(100, 'Display name must be at most 100 characters'),
});

/** Inferred RegisterRequest type */
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

/**
 * Schema for authentication response (returned by login/register).
 * Contains a JWT token and the authenticated user.
 */
export const AuthResponseSchema = z.object({
  /** JWT access token */
  token: z.string(),
  /** Authenticated user */
  user: UserSchema,
});

/** Inferred AuthResponse type */
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
