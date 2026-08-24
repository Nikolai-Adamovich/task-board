import type { TenantRole, TenantStatus, MemberStatus, InvitationStatus } from '../constants/roles.js';

/** Identity snapshot — denormalized display name at time of action */
export interface IdentitySnapshot {
  displayName: string;
}

/** Tenant (organization) entity type */
export interface Tenant {
  /** Unique tenant identifier (UUID v4) */
  id: string;
  /** Tenant display name */
  name: string;
  /** Optional description of the tenant */
  description: string | null;
  /** Tenant lifecycle status */
  status: TenantStatus;
  /** Scheduled deletion timestamp (ISO 8601, null if not scheduled) */
  deletionScheduledAt: string | null;
  /** Creation timestamp (ISO 8601) */
  createdAt: string;
  /** Last update timestamp (ISO 8601) */
  updatedAt: string;
}

/** Create tenant request body type */
export interface CreateTenant {
  name: string;
  description?: string;
}

/** Update tenant request body type */
export interface UpdateTenant {
  name?: string;
  description?: string;
}

/** Invitation embedded in a TenantMember */
export interface Invitation {
  /** Current invitation status */
  status: InvitationStatus;
  /** Hashed invitation token */
  tokenHash: string;
  /** User ID of the person who sent the invitation */
  invitedBy: string;
  /** Timestamp when the invitation was sent (ISO 8601) */
  invitedOn: string;
}

/** Tenant member type */
export interface TenantMember {
  /** Unique member identifier (UUID v4) */
  id: string;
  /** Tenant ID */
  tenantId: string;
  /** User ID of the member */
  userId: string;
  /** Role of the user within the tenant */
  role: TenantRole;
  /** Member status */
  status: MemberStatus;
  /** Embedded invitation data (null for direct members) */
  invitation: Invitation | null;
  /** Resolved user display name (null if user deleted/not found) */
  displayName: string | null;
  /** Resolved user email (null if user deleted/not found) */
  email: string | null;
  /** Creation timestamp (ISO 8601) */
  createdAt: string;
  /** Last update timestamp (ISO 8601) */
  updatedAt: string;
}

/** Pending invitation for the authenticated user, enriched with the tenant name (GET /invitations/my) */
export interface MyInvitation extends TenantMember {
  /** Display name of the tenant the invitation belongs to */
  tenantName: string;
}
