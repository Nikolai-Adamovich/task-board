import type { SubscriptionTier } from '../constants/roles.js';
import type { TenantRole } from '../constants/roles.js';
import type { MemberStatus } from '../constants/roles.js';

/** Tenant (organization) entity type */
export interface Tenant {
  /** Unique tenant identifier (UUID v4) */
  id: string;
  /** Tenant display name */
  name: string;
  /** URL-friendly slug for the tenant */
  slug: string;
  /** Optional description of the tenant */
  description?: string | null;
  /** Subscription tier */
  subscription: SubscriptionTier;
  /** Creation timestamp (ISO 8601) */
  createdAt: string;
  /** Last update timestamp (ISO 8601) */
  updatedAt: string;
}

/** Create tenant request body type */
export interface CreateTenant {
  name: string;
  slug: string;
  description?: string;
  subscription: SubscriptionTier;
}

/** Update tenant request body type */
export interface UpdateTenant {
  name?: string;
  slug?: string;
  description?: string;
}

/** Tenant member type */
export interface TenantMember {
  /** User ID of the member (null for pending invitations) */
  userId: string | null;
  /** Tenant ID */
  tenantId: string;
  /** Role of the user within the tenant */
  role: TenantRole;
  /** Member status */
  status: MemberStatus;
  /** Email address for pending invitations */
  invitedEmail: string | null;
  /** Invitation token for pending invitations */
  invitationToken: string | null;
  /** Timestamp when the invitation was sent (ISO 8601) */
  invitedAt: string | null;
}

/** Invite member to tenant request body type */
export interface InviteMember {
  email: string;
  role: TenantRole;
}

/** Tenant with the current user's role */
export interface TenantWithRole extends Tenant {
  role: TenantRole;
}
