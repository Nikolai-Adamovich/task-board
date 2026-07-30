import type { z } from 'zod';
import type {
  LoginRequestSchema,
  RegisterRequestSchema,
  AuthResponseSchema,
  MyInvitationSchema,
  PendingInvitationSchema,
} from '../schemas/auth.js';

/** Login request body type */
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

/** Registration request body type */
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

/** Authentication response type */
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

/** Invitation details visible to the current user */
export type MyInvitation = z.infer<typeof MyInvitationSchema>;

/** Pending invitation visible to tenant owners/admins */
export type PendingInvitation = z.infer<typeof PendingInvitationSchema>;
