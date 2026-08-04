import type { TenantRole } from '../constants/roles.js';
import type { MemberStatus } from '../constants/roles.js';

/** User entity type */
export interface User {
  /** Unique user identifier (UUID v4) */
  id: string;
  /** User's email address */
  email: string;
  /** User's display name */
  displayName: string;
  /** Account creation timestamp (ISO 8601) */
  createdAt: string;
  /** Last update timestamp (ISO 8601) */
  updatedAt: string;
}

/** Create user request body type */
export interface CreateUser {
  email: string;
  password: string;
  displayName: string;
}

/** Login request body type */
export interface LoginRequest {
  email: string;
  password: string;
}

/** Registration request body type */
export interface RegisterRequest {
  email: string;
  password: string;
  displayName: string;
}

/** Authentication response type */
export interface AuthResponse {
  /** JWT access token */
  token: string;
  /** Authenticated user */
  user: User;
}

/** Schema for accepting an invitation to join a tenant */
export interface AcceptInvitation {
  token: string;
  password?: string;
  displayName?: string;
}

/** Invitation details returned by GET /invitations/:token */
export interface InvitationDetails {
  email: string;
  tenantName: string;
  role: TenantRole;
  status: MemberStatus;
  isRegistered: boolean;
}

/** Invitation details visible to the current user */
export interface MyInvitation {
  /** Unique invitation identifier (UUID v4) */
  id: string;
  /** Tenant the invitation belongs to */
  tenantId: string;
  /** Display name of the tenant */
  tenantName: string;
  /** Role the invitee will receive */
  role: TenantRole;
  /** Email the invitation was sent to */
  invitedEmail: string;
  /** Timestamp when the invitation was sent (ISO 8601) */
  invitedAt: string | null;
}

/** Pending invitation visible to tenant owners/admins */
export interface PendingInvitation {
  /** Unique invitation identifier (UUID v4) */
  id: string;
  /** Tenant the invitation belongs to */
  tenantId: string;
  /** User ID if the invitee already has an account (null otherwise) */
  userId: string | null;
  /** Email the invitation was sent to */
  invitedEmail: string | null;
  /** Role the invitee will receive */
  role: TenantRole;
  /** Current invitation status */
  status: MemberStatus;
  /** Timestamp when the invitation was sent (ISO 8601) */
  invitedAt: string | null;
}
