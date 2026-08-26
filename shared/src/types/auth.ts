import type { TenantRole, InvitationStatus } from '../constants/roles.js';
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
