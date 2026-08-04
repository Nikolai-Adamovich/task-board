import { z } from 'zod';
import { SubscriptionTierValues, TenantRoleValues, MemberStatusValues } from '@task-board/shared';
import {
  uuid,
  slug,
  nonEmptyString,
  optionalString,
  nullableOptionalString,
  email,
  isoDateTime,
  nullableIsoDateTime,
} from '../validators/common.js';

/**
 * Tenant (organization) entity schema.
 * A tenant is the top-level organizational unit that owns projects.
 */
export const TenantSchema = z.object({
  /** Unique tenant identifier (UUID v4) */
  id: uuid(),
  /** Tenant display name */
  name: nonEmptyString(100, 'Tenant name'),
  /** URL-friendly slug for the tenant */
  slug: slug(),
  /** Optional description of the tenant */
  description: nullableOptionalString(500),
  /** Subscription tier */
  subscription: z.enum(SubscriptionTierValues),
  /** Creation timestamp (ISO 8601) */
  createdAt: isoDateTime(),
  /** Last update timestamp (ISO 8601) */
  updatedAt: isoDateTime(),
});

/**
 * Schema for creating a new tenant.
 */
export const CreateTenantSchema = z.object({
  name: nonEmptyString(100, 'Tenant name'),
  slug: slug(),
  description: optionalString(500),
  subscription: z.enum(SubscriptionTierValues).default('free'),
});

/**
 * Schema for updating an existing tenant.
 * All fields are optional (partial update).
 */
export const UpdateTenantSchema = z.object({
  name: nonEmptyString(100, 'Tenant name').optional(),
  slug: slug().optional(),
  description: optionalString(500),
});

/**
 * Tenant membership schema.
 * Represents a user's membership in a tenant with a specific role.
 */
export const TenantMemberSchema = z.object({
  /** User ID of the member (null for pending invitations) */
  userId: uuid().nullable(),
  /** Tenant ID */
  tenantId: uuid(),
  /** Role of the user within the tenant */
  role: z.enum(TenantRoleValues),
  /** Member status */
  status: z.enum(MemberStatusValues),
  /** Email address for pending invitations */
  invitedEmail: email().nullable(),
  /** Invitation token for pending invitations */
  invitationToken: z.string().nullable(),
  /** Timestamp when the invitation was sent (ISO 8601) */
  invitedAt: nullableIsoDateTime(),
});

/**
 * Schema for inviting a new member to a tenant.
 */
export const InviteMemberSchema = z.object({
  email: email(),
  role: z.enum(TenantRoleValues),
});

/**
 * Tenant entity with the current user's role.
 * Used by the "list my tenants" endpoint so the UI knows
 * what role the caller has without an extra request.
 */
export const TenantWithRoleSchema = TenantSchema.extend({
  role: z.enum(TenantRoleValues),
});
