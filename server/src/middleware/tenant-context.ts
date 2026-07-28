import { createMiddleware } from 'hono/factory';
import { ForbiddenError, ValidationError } from './error-handler.js';
import { getCollection } from '../db/mongo.js';
import type { AppEnv } from '../types/context.js';

// ─── TenantMember Document Shape ─────────────────────────────────────────────

interface TenantMemberDocument {
  userId: string;
  tenantId: string;
  role: string;
}

// ─── Tenant Context Middleware ────────────────────────────────────────────────

/**
 * Hono middleware that resolves the active tenant context.
 *
 * 1. Reads the `X-Tenant-Id` header.
 * 2. Validates the authenticated user is a member of that tenant.
 * 3. Sets `c.get('tenantId')` on the context.
 *
 * Error responses:
 * - 400 if `X-Tenant-Id` header is missing
 * - 403 if the user is not a member of the specified tenant
 *
 * This middleware should be applied per-route, not globally,
 * so that auth routes can skip it.
 */
export const tenantContextMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const tenantId = c.req.header('X-Tenant-Id');

  if (!tenantId) {
    throw new ValidationError('Missing X-Tenant-Id header');
  }

  const userId = c.get('userId');

  if (!userId) {
    throw new ForbiddenError('Authentication required for tenant context');
  }

  // Query the tenant_members collection to verify membership
  const tenantMembers = getCollection<TenantMemberDocument>('tenant_members');
  const membership = await tenantMembers.findOne({
    userId,
    tenantId,
  });

  if (!membership) {
    throw new ForbiddenError('You are not a member of this tenant');
  }

  // Set tenant context for downstream handlers
  c.set('tenantId', tenantId);
  c.set('userRole', membership.role);

  await next();
});
