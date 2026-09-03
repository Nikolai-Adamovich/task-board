/**
 * Frontend-only types that extend shared types.
 * These types are NOT part of the shared package — they represent
 * API response shapes or UI-specific compositions.
 */
import type { Tenant, TenantRole } from '@task-board/shared';

/** Tenant enriched with the current user's role (returned by GET /api/tenants) */
export type TenantWithRole = Tenant & { role: TenantRole };

/** Cross-tenant invitation visible to the current user (contract lives in shared) */
export type { MyInvitation } from '@task-board/shared';
