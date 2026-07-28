import type { z } from 'zod';
import type { TenantSchema, CreateTenantSchema, UpdateTenantSchema, TenantMemberSchema } from '../schemas/tenant.js';

/** Tenant entity type */
export type Tenant = z.infer<typeof TenantSchema>;

/** Create tenant request body type */
export type CreateTenant = z.infer<typeof CreateTenantSchema>;

/** Update tenant request body type */
export type UpdateTenant = z.infer<typeof UpdateTenantSchema>;

/** Tenant member type */
export type TenantMember = z.infer<typeof TenantMemberSchema>;
