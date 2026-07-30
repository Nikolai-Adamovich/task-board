import { z } from 'zod';
import { MemberStatus, SubscriptionTier, TenantRole } from '../constants/roles.js';

/**
 * Tenant (organization) entity schema.
 * A tenant is the top-level organizational unit that owns projects.
 */
export const TenantSchema = z.object({
  /** Unique tenant identifier (UUID v4) */
  id: z.uuid(),
  /** Tenant display name */
  name: z.string().min(1).max(100),
  /** URL-friendly slug for the tenant */
  slug: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/),
  /** Subscription tier */
  subscription: z.enum(SubscriptionTier),
  /** Creation timestamp (ISO 8601) */
  createdAt: z.iso.datetime(),
  /** Last update timestamp (ISO 8601) */
  updatedAt: z.iso.datetime(),
});

/** Inferred Tenant type */
export type Tenant = z.infer<typeof TenantSchema>;

/**
 * Schema for creating a new tenant.
 */
export const CreateTenantSchema = z.object({
  name: z.string().min(1, 'Tenant name is required').max(100, 'Tenant name must be at most 100 characters'),
  slug: z
    .string()
    .min(2, 'Slug must be at least 2 characters')
    .max(80, 'Slug must be at most 80 characters')
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  subscription: z.enum(SubscriptionTier).default('free'),
});

/** Inferred CreateTenant type */
export type CreateTenant = z.infer<typeof CreateTenantSchema>;

/**
 * Schema for updating an existing tenant.
 * All fields are optional (partial update).
 */
export const UpdateTenantSchema = z.object({
  name: z
    .string()
    .min(1, 'Tenant name cannot be empty')
    .max(100, 'Tenant name must be at most 100 characters')
    .optional(),
  slug: z
    .string()
    .min(2, 'Slug must be at least 2 characters')
    .max(80, 'Slug must be at most 80 characters')
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, 'Slug must contain only lowercase letters, numbers, and hyphens')
    .optional(),
});

/** Inferred UpdateTenant type */
export type UpdateTenant = z.infer<typeof UpdateTenantSchema>;

/**
 * Tenant membership schema.
 * Represents a user's membership in a tenant with a specific role.
 */
export const TenantMemberSchema = z.object({
  /** User ID of the member (null for pending invitations) */
  userId: z.uuid().nullable(),
  /** Tenant ID */
  tenantId: z.uuid(),
  /** Role of the user within the tenant */
  role: z.enum(TenantRole),
  /** Member status */
  status: z.enum(MemberStatus),
  /** Email address for pending invitations */
  invitedEmail: z.email().nullable(),
  /** Invitation token for pending invitations */
  invitationToken: z.string().nullable(),
  /** Timestamp when the invitation was sent (ISO 8601) */
  invitedAt: z.iso.datetime().nullable(),
});

/** Inferred TenantMember type */
export type TenantMember = z.infer<typeof TenantMemberSchema>;

/**
 * Schema for inviting a new member to a tenant.
 */
export const InviteMemberSchema = z.object({
  email: z.email({ message: 'Invalid email address', pattern: z.regexes.html5Email }),
  role: z.enum(TenantRole),
});

/** Inferred InviteMember type */
export type InviteMember = z.infer<typeof InviteMemberSchema>;

/**
 * Tenant entity with the current user's role.
 * Used by the "list my tenants" endpoint so the UI knows
 * what role the caller has without an extra request.
 */
export const TenantWithRoleSchema = TenantSchema.extend({
  role: z.enum(TenantRole),
});

/** Inferred TenantWithRole type */
export type TenantWithRole = z.infer<typeof TenantWithRoleSchema>;
