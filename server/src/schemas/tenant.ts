import { z } from 'zod';
import {
  TenantRoleValues,
  MemberStatusValues,
  TenantStatusValues,
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
  description: nullableOptionalString(500),
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
  description: optionalString(500),
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
  description: optionalString(500),
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
 * Tenant entity with the current user's role.
 */
export const TenantWithRoleSchema = TenantSchema.extend({
  role: z.enum(TenantRoleValues),
});
