import type { z } from 'zod';
import type { UserSchema, CreateUserSchema } from '../schemas/user.js';

/** User entity type */
export type User = z.infer<typeof UserSchema>;

/** Create user request body type */
export type CreateUser = z.infer<typeof CreateUserSchema>;
