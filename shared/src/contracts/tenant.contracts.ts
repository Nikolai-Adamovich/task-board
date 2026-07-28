import { z } from 'zod';
import { TenantSchema, CreateTenantSchema, UpdateTenantSchema, TenantMemberSchema } from '../schemas/tenant.js';
import { ErrorResponseSchema } from '../schemas/common.js';
import { TenantRole } from '../constants/roles.js';

/**
 * Tenant-related API contracts.
 */
export const tenantContracts = {
  /** Create a new tenant */
  create: {
    method: 'POST' as const,
    path: '/tenants',
    body: CreateTenantSchema,
    response: TenantSchema,
    error: ErrorResponseSchema,
  },

  /** List tenants for the current user */
  list: {
    method: 'GET' as const,
    path: '/tenants',
    query: z.object({
      page: z.coerce.number().int().positive().default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
    }),
    response: z.object({
      data: z.array(TenantSchema),
      total: z.number().int().nonnegative(),
      page: z.number().int().positive(),
      limit: z.number().int().positive(),
    }),
    error: ErrorResponseSchema,
  },

  /** Get a tenant by ID */
  getById: {
    method: 'GET' as const,
    path: '/tenants/:id',
    response: TenantSchema,
    error: ErrorResponseSchema,
  },

  /** Update a tenant */
  update: {
    method: 'PATCH' as const,
    path: '/tenants/:id',
    body: UpdateTenantSchema,
    response: TenantSchema,
    error: ErrorResponseSchema,
  },

  /** Delete a tenant */
  remove: {
    method: 'DELETE' as const,
    path: '/tenants/:id',
    response: z.object({ success: z.literal(true) }),
    error: ErrorResponseSchema,
  },

  /** Add a member to a tenant */
  addMember: {
    method: 'POST' as const,
    path: '/tenants/:id/members',
    body: z.object({
      userId: z.uuid(),
      role: z.enum(TenantRole),
    }),
    response: TenantMemberSchema,
    error: ErrorResponseSchema,
  },

  /** List members of a tenant */
  listMembers: {
    method: 'GET' as const,
    path: '/tenants/:id/members',
    response: z.object({
      data: z.array(TenantMemberSchema),
      total: z.number().int().nonnegative(),
    }),
    error: ErrorResponseSchema,
  },

  /** Update a member's role in a tenant */
  updateMember: {
    method: 'PATCH' as const,
    path: '/tenants/:id/members/:userId',
    body: z.object({
      role: z.enum(TenantRole),
    }),
    response: TenantMemberSchema,
    error: ErrorResponseSchema,
  },

  /** Remove a member from a tenant */
  removeMember: {
    method: 'DELETE' as const,
    path: '/tenants/:id/members/:userId',
    response: z.object({ success: z.literal(true) }),
    error: ErrorResponseSchema,
  },
} as const;
