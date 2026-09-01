import * as z from 'zod';
import {
  TenantRoleValues,
  MemberStatusValues,
  TenantStatusValues,
  InvitationStatusValues,
  TENANT_SLUG_MAX_LENGTH,
  TENANT_SLUG_PATTERN,
} from '@task-board/shared';
import {
  uuid,
  nonEmptyString,
  optionalString,
  nullableOptionalString,
  email,
  isoDateTime,
  nullableIsoDateTime,
} from '../validators/common.js';

/**
 * Tenant slug validator (DEC-032): lowercase `[a-z0-9-]`, no leading/trailing
 * hyphen, max 48 characters.
 */
export const tenantSlug = () =>
  z
    .string()
    .max(TENANT_SLUG_MAX_LENGTH, `Slug must be at most ${TENANT_SLUG_MAX_LENGTH} characters`)
    .regex(
      TENANT_SLUG_PATTERN,
      'Slug must contain only lowercase letters, numbers, and hyphens, and must start/end with an alphanumeric character',
    );

/**
 * Tenant (organization) entity schema.
 */
export const TenantSchema = z.object({
  id: uuid(),
  name: nonEmptyString(200, 'Tenant name'),
  slug: tenantSlug(),
  description: nullableOptionalString(120),
  status: z.enum(TenantStatusValues),
  deletionScheduledAt: nullableIsoDateTime(),
  createdAt: isoDateTime(),
  updatedAt: isoDateTime(),
});

/**
 * Schema for creating a new tenant. The slug is optional — it is generated
 * from the name when omitted (DEC-032).
 */
export const CreateTenantSchema = z.object({
  name: nonEmptyString(200, 'Tenant name'),
  slug: tenantSlug().optional(),
  description: optionalString(120),
});

/**
 * Query schema for GET /tenants/slug-available (DEC-032).
 */
export const SlugAvailableQuerySchema = z.object({
  slug: z.string().min(1),
});

/**
 * Schema for updating an existing tenant.
 */
export const UpdateTenantSchema = z.object({
  name: nonEmptyString(200, 'Tenant name').optional(),
  description: optionalString(120),
});

/**
 * Tenant membership schema.
 */
export const TenantMemberSchema = z.object({
  id: uuid(),
  tenantId: uuid(),
  userId: uuid(),
  role: z.enum(TenantRoleValues),
  status: z.enum(MemberStatusValues),
  /** DEC-055: membership expiration (null = never expires) */
  expiresAt: nullableIsoDateTime(),
  createdAt: isoDateTime(),
  updatedAt: isoDateTime(),
});

/**
 * Schema for inviting a new member to a tenant.
 * Role must be ADMIN or MEMBER (not OWNER).
 */
export const InviteMemberSchema = z.object({
  email: email(),
  role: z.enum([TenantRoleValues[1], TenantRoleValues[2]] as [string, ...string[]]),
});

/**
 * Schema for updating a member's role.
 */
export const UpdateMemberRoleSchema = z.object({
  role: z.enum([TenantRoleValues[1], TenantRoleValues[2]] as [string, ...string[]]),
});

/**
 * DEC-055: full member update — role, expiration date and the underlying
 * user's profile (display name / email). All fields optional; the service
 * applies only the provided ones.
 */
export const UpdateMemberSchema = z.object({
  role: z.enum([TenantRoleValues[1], TenantRoleValues[2]] as [string, ...string[]]).optional(),
  /** ISO 8601 datetime or null (null clears the expiration) */
  expiresAt: nullableIsoDateTime().optional(),
  /** Updates the underlying USER record's display name */
  name: nonEmptyString(200, 'Member name').optional(),
  /** Updates the underlying USER record's email (uniqueness enforced in the service) */
  email: email().optional(),
});

/**
 * Invitation embedded in a TenantMember (mirrors `shared/src/types/tenant.ts` `Invitation`).
 */
export const InvitationSchema = z.object({
  status: z.enum(InvitationStatusValues),
  tokenHash: z.string(),
  invitedBy: z.string(),
  invitedOn: isoDateTime(),
});

/**
 * Pending invitation for the authenticated user, enriched with the tenant name
 * (GET /invitations/my). Single source of truth for the shared `MyInvitation`
 * type — parity is enforced by a compile-time equality test in
 * `schemas/tenant.test.ts` (shared/ is runtime-library-free, so the Zod schema
 * lives server-side and the shared interface mirrors it).
 *
 * This is a read-boundary mapping schema, not a request validator: id fields are
 * plain strings (exactly like the shared type) and only the enum fields that the
 * former `as` casts papered over are validated. `tenantName` deliberately allows
 * `''` (the service falls back to it when the tenant lookup misses).
 */
export const MyInvitationSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  userId: z.string(),
  role: z.enum(TenantRoleValues),
  status: z.enum(MemberStatusValues),
  /** DEC-055: membership expiration (null = never expires) */
  expiresAt: nullableIsoDateTime(),
  invitation: InvitationSchema.nullable(),
  /** Resolved user display name (null if user deleted/not found) */
  displayName: z.string().nullable(),
  /** Resolved user email (null if user deleted/not found) */
  email: z.string().nullable(),
  /** Display name of the tenant the invitation belongs to */
  tenantName: z.string(),
  createdAt: isoDateTime(),
  updatedAt: isoDateTime(),
});

/**
 * Tenant entity with the current user's role.
 */
export const TenantWithRoleSchema = TenantSchema.extend({
  role: z.enum(TenantRoleValues),
});
