import { z } from 'zod';
import { MemberStatus, TenantRole } from '../constants/roles.js';
import { UserSchema } from './user.js';

/**
 * Schema for login request body.
 */
export const LoginRequestSchema = z.object({
  email: z.email({ message: 'Invalid email address', pattern: z.regexes.html5Email }),
  password: z.string().min(1, 'Password is required'),
});

/** Inferred LoginRequest type */
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

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

/**
 * Schema for accepting an invitation to join a tenant.
 */
export const AcceptInvitationSchema = z.object({
  token: z.string().min(1, 'Invitation token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128).optional(),
  displayName: z.string().min(1).max(100).optional(),
});

/** Inferred AcceptInvitation type */
export type AcceptInvitation = z.infer<typeof AcceptInvitationSchema>;

/**
 * Schema for invitation details (returned by GET /invitations/:token).
 */
export const InvitationDetailsSchema = z.object({
  email: z.email(),
  tenantName: z.string(),
  role: z.enum(TenantRole),
  status: z.enum(MemberStatus),
  isRegistered: z.boolean(),
});

/** Inferred InvitationDetails type */
export type InvitationDetails = z.infer<typeof InvitationDetailsSchema>;

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
  role: z.enum(TenantRole),
  /** Email the invitation was sent to */
  invitedEmail: z.email(),
  /** Timestamp when the invitation was sent (ISO 8601) */
  invitedAt: z.iso.datetime().nullable(),
});

/** Inferred MyInvitation type */
export type MyInvitation = z.infer<typeof MyInvitationSchema>;

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
  role: z.enum(TenantRole),
  /** Current invitation status */
  status: z.enum(MemberStatus),
  /** Timestamp when the invitation was sent (ISO 8601) */
  invitedAt: z.iso.datetime().nullable(),
});

/** Inferred PendingInvitation type */
export type PendingInvitation = z.infer<typeof PendingInvitationSchema>;
