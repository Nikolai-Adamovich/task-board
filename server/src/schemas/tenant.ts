import { z } from 'zod';
import { TenantRoleValues, MemberStatusValues, TenantStatusValues } from '@task-board/shared';
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
 * Tenant (organization) entity schema.
 */
export const TenantSchema = z.object({
  id: uuid(),
  name: nonEmptyString(200, 'Tenant name'),
  description: nullableOptionalString(500),
  status: z.enum(TenantStatusValues),
  deletionScheduledAt: nullableIsoDateTime(),
  createdAt: isoDateTime(),
  updatedAt: isoDateTime(),
});

/**
 * Schema for creating a new tenant.
 */
export const CreateTenantSchema = z.object({
  name: nonEmptyString(200, 'Tenant name'),
  description: optionalString(500),
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
