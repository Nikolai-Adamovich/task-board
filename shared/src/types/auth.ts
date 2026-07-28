import type { z } from 'zod';
import type { LoginRequestSchema, RegisterRequestSchema, AuthResponseSchema } from '../schemas/auth.js';

/** Login request body type */
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

/** Registration request body type */
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

/** Authentication response type */
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
