import { z } from 'zod';
import { TenantRole } from '../constants/roles.js';

/**
 * Tenant (organization) entity schema.
 * A tenant is the top-level organizational unit that owns projects.
 */
export const TenantSchema = z.object({
  /** Unique tenant identifier (UUID v4) */
  id: z.string().uuid(),
  /** Tenant display name */
  name: z.string().min(1).max(100),
  /** URL-friendly slug for the tenant */
  slug: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/),
  /** Creation timestamp (ISO 8601) */
  createdAt: z.string().datetime(),
  /** Last update timestamp (ISO 8601) */
  updatedAt: z.string().datetime(),
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
  /** User ID of the member */
  userId: z.string().uuid(),
  /** Tenant ID */
  tenantId: z.string().uuid(),
  /** Role of the user within the tenant */
  role: z.enum(TenantRole),
});

/** Inferred TenantMember type */
export type TenantMember = z.infer<typeof TenantMemberSchema>;
