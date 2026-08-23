import { createMiddleware } from 'hono/factory';
import { MemberStatus, TenantRole } from '@task-board/shared';
import { ForbiddenError, ValidationError } from './error-handler.js';
import { getCollection } from '../db/mongo.js';
import type { AppEnv } from '../types/context.js';

// ─── TenantMember Document Shape ─────────────────────────────────────────────

interface TenantMemberDocument {
  userId: string;
  tenantId: string;
  role: string;
  status: string;
}

// ─── Tenant Context Middleware ────────────────────────────────────────────────

/**
 * Hono middleware that resolves the active tenant context.
 *
 * 1. Reads the `X-Tenant-Id` header.
 * 2. Validates the authenticated user has an ACTIVE membership in that tenant.
 * 3. Rejects ACCESS_REVOKED members with 403.
 * 4. Sets `tenantId` and `tenantRole` on the context.
 *
 * Error responses:
 * - 400 VALIDATION_ERROR if `X-Tenant-Id` header is missing
 * - 403 FORBIDDEN if the user is not a member, or membership is ACCESS_REVOKED
 *
 * This middleware should be applied per-route, not globally,
 * so that auth and invitation routes can skip it.
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

  // Check membership status — only ACTIVE and ACCESS_REVOKED per v5 spec
  if (membership.status === MemberStatus.ACCESS_REVOKED) {
    throw new ForbiddenError('Your access to this tenant has been revoked');
  }

  if (membership.status !== MemberStatus.ACTIVE) {
    throw new ForbiddenError('Your membership is not active');
  }

  // Set tenant context for downstream handlers
  c.set('tenantId', tenantId);
  c.set('tenantRole', membership.role as TenantRole);

  await next();
});
