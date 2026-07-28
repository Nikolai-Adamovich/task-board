import { createMiddleware } from 'hono/factory';
import { ForbiddenError } from './error-handler.js';
import type { AppEnv } from '../types/context.js';
import { TenantRole } from '@task-board/shared';

type TenantRoleType = (typeof TenantRole)[number];

// ─── RBAC Middleware Factory ──────────────────────────────────────────────────

/**
 * Factory function that creates a Hono middleware enforcing role-based access.
 *
 * @param roles - One or more tenant roles that are allowed to access the route
 * @returns Hono middleware that checks the user's tenant role
 *
 * Tenant owners always bypass role restrictions.
 *
 * @example
 * ```ts
 * // Only owners and admins can manage tenants
 * app.post('/tenants', requireRole('owner', 'admin'), handler);
 *
 * // Any member can view projects
 * app.get('/projects', requireRole('owner', 'admin', 'member'), handler);
 * ```
 */
export function requireRole(...roles: TenantRoleType[]) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const userRole = c.get('userRole') as TenantRoleType | undefined;

    if (!userRole) {
      throw new ForbiddenError('No role assigned in this tenant');
    }

    // Tenant owners bypass all restrictions
    if (userRole === 'owner') {
      await next();
      return;
    }

    // Check if the user's role is in the allowed list
    if (!roles.includes(userRole)) {
      throw new ForbiddenError(`Insufficient permissions. Required: ${roles.join(' or ')}, got: ${userRole}`);
    }

    await next();
  });
}
