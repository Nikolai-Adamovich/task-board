import { z } from 'zod';

/**
 * User entity schema.
 * Represents a user in the system. Note: passwordHash is intentionally
 * excluded from the shared package — it is server-only.
 */
export const UserSchema = z.object({
  /** Unique user identifier (UUID v4) */
  id: z.uuid(),
  /** User's email address */
  email: z.email({ pattern: z.regexes.html5Email }),
  /** User's display name */
  displayName: z.string().min(1).max(100),
  /** Account creation timestamp (ISO 8601) */
  createdAt: z.iso.datetime(),
  /** Last update timestamp (ISO 8601) */
  updatedAt: z.iso.datetime(),
});

/** Inferred User type */
export type User = z.infer<typeof UserSchema>;

/**
 * Schema for creating a new user (registration).
 * Includes the plaintext password which will be hashed server-side.
 */
export const CreateUserSchema = z.object({
  email: z.email({ message: 'Invalid email address', pattern: z.regexes.html5Email }),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters'),
  displayName: z.string().min(1, 'Display name is required').max(100, 'Display name must be at most 100 characters'),
});

/** Inferred CreateUser type */
export type CreateUser = z.infer<typeof CreateUserSchema>;
