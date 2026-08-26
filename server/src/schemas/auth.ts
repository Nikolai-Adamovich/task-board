import { z } from 'zod';
import { TenantRoleValues, MemberStatusValues } from '@task-board/shared';
import { UserSchema } from './user.js';

/**
 * Schema for login request body.
 */
export const LoginRequestSchema = z.object({
  email: z.email({ message: 'Invalid email address', pattern: z.regexes.html5Email }),
  password: z.string().min(1, 'Password is required'),
});

/**
 * Schema for registration request body.
 */
export const RegisterRequestSchema = z.object({
  email: z.email({ message: 'Invalid email address', pattern: z.regexes.html5Email }),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters'),
  displayName: z.string().min(1, 'Display name is required').max(100, 'Display name must be at most 100 characters'),
});

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

/**
 * Schema for the forgot-password request body.
 */
export const ForgotPasswordSchema = z.object({
  email: z.email({ message: 'Invalid email address', pattern: z.regexes.html5Email }),
});

/**
 * Schema for the reset-password request body.
 */
export const ResetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters'),
});

/**
 * Schema for accepting an invitation to join a tenant.
 */
export const AcceptInvitationSchema = z.object({
  token: z.string().min(1, 'Invitation token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128).optional(),
  displayName: z.string().min(1).max(100).optional(),
});

/**
 * Schema for invitation details (returned by GET /invitations/:token).
 */
export const InvitationDetailsSchema = z.object({
  email: z.email(),
  tenantName: z.string(),
  role: z.enum(TenantRoleValues),
  status: z.enum(MemberStatusValues),
  isRegistered: z.boolean(),
});

/**
 * Schema for invitation details visible to the current user.
 * Returned by GET /invitations/my.
 */
export const MyInvitationSchema = z.object({
  /** Unique invitation identifier (UUID v4) */
  id: z.uuid(),
  /** Tenant the invitation belongs to */
  tenantId: z.uuid(),
  /** Display name of the tenant */
  tenantName: z.string(),
  /** Role the invitee will receive */
  role: z.enum(TenantRoleValues),
  /** Email the invitation was sent to */
  invitedEmail: z.email(),
  /** Timestamp when the invitation was sent (ISO 8601) */
  invitedAt: z.iso.datetime().nullable(),
});

/**
 * Schema for pending (outstanding) invitations visible to tenant owners/admins.
 * Returned by a tenant's member-management endpoint.
 */
export const PendingInvitationSchema = z.object({
  /** Unique invitation identifier (UUID v4) */
  id: z.uuid(),
  /** Tenant the invitation belongs to */
  tenantId: z.uuid(),
  /** User ID if the invitee already has an account (null otherwise) */
  userId: z.uuid().nullable(),
  /** Email the invitation was sent to */
  invitedEmail: z.email().nullable(),
  /** Role the invitee will receive */
  role: z.enum(TenantRoleValues),
  /** Current invitation status */
  status: z.enum(MemberStatusValues),
  /** Timestamp when the invitation was sent (ISO 8601) */
  invitedAt: z.iso.datetime().nullable(),
});
