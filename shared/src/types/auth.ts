import type { TenantRole, InvitationStatus } from '../constants/roles.js';
import type { Tenant } from './tenant.js';
import type { User } from './user.js';

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

/** Tenant enriched with the caller's role (shape returned by GET /tenants) */
export type TenantWithRole = Tenant & { role: TenantRole };

/**
 * Session bootstrap payload (GET /auth/bootstrap): the authenticated user and
 * the tenant list in ONE round-trip, so cold loads don't pay the sequential
 * /auth/me → /tenants waterfall. Pure composition of the two existing
 * endpoints — semantics are identical to /auth/me + /tenants.
 */
export interface AuthBootstrap {
  /** Authenticated user (same shape as GET /auth/me) */
  user: User;
  /** Active memberships with tenant documents (same shape as GET /tenants) */
  tenants: TenantWithRole[];
}

/** Schema for accepting an invitation to join a tenant */
export interface AcceptInvitation {
  token: string;
  password?: string;
  displayName?: string;
}

/** Forgot-password request body type (POST /auth/forgot-password) */
export interface ForgotPasswordRequest {
  email: string;
}

/** Reset-password request body type (POST /auth/reset-password) */
export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

/** Neutral response returned by POST /auth/forgot-password regardless of account existence */
export interface ForgotPasswordResponse {
  message: string;
}

/** Invitation details returned by GET /invitations/:token */
export interface InvitationDetails {
  email: string;
  tenantName: string;
  role: TenantRole;
  status: InvitationStatus;
  isRegistered: boolean;
}
