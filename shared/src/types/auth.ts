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

/** Invitation details returned by GET /invitations/:token */
export interface InvitationDetails {
  email: string;
  tenantName: string;
  role: TenantRole;
  status: InvitationStatus;
  isRegistered: boolean;
}
