/**
 * Route aggregation index.
 *
 * Re-exports all feature route modules as a single registry.
 * Auth, tenant, project, board, column, task, and sprint routes are fully implemented.
 */

import { Hono } from 'hono';
import type { AppEnv } from '../types/context.js';
import { requireRole } from '../middleware/rbac.js';
import { createAuthRoutes } from './auth.js';
import { createTenantRoutes } from './tenants.js';
import { createProjectRoutes } from './projects.js';
import { createBoardRoutes } from './boards.js';
import { createColumnRoutes } from './columns.js';
import { createTaskRoutes } from './tasks.js';
import { createSprintRoutes } from './sprints.js';

// ─── Route Registry ───────────────────────────────────────────────────────────

/**
 * Central registry of all feature route modules.
 *
 * Auth routes have no tenant context or RBAC middleware.
 * Tenant routes require auth but handle RBAC internally per-route.
 * All other routes use RBAC middleware per their specific requirements.
 *
 * Column routes are nested under boards: `/boards/:boardId/columns`.
 */
export const routeRegistry = {
  /** Auth routes — no tenant context, no RBAC */
  auth: createAuthRoutes(),

  /**
   * Tenant routes — requires auth, handles RBAC internally.
   * List/create tenants don't need tenant context; specific tenant
   * operations check membership via the tenant service.
   */
  tenants: createTenantRoutes(),

  /** Project routes — requires any tenant member role; handles admin checks internally */
  projects: (() => {
    const router = new Hono<AppEnv>();

    router.use('/*', requireRole('owner', 'admin', 'member'));
    router.route('/', createProjectRoutes());
    return router;
  })(),

  /** Board routes — requires any tenant member role; handles admin checks internally */
  boards: (() => {
    const router = new Hono<AppEnv>();

    router.use('/*', requireRole('owner', 'admin', 'member'));

    // Mount board CRUD routes
    router.route('/', createBoardRoutes());

    // Mount column routes nested under boards: /boards/:boardId/columns
    router.route('/:boardId/columns', createColumnRoutes());

    return router;
  })(),

  /** Task routes — requires any tenant member role; handles admin checks internally */
  tasks: (() => {
    const router = new Hono<AppEnv>();

    router.use('/*', requireRole('owner', 'admin', 'member'));
    router.route('/', createTaskRoutes());
    return router;
  })(),

  /** Sprint routes — requires any tenant member role; handles admin checks internally */
  sprints: (() => {
    const router = new Hono<AppEnv>();

    router.use('/*', requireRole('owner', 'admin', 'member'));
    router.route('/', createSprintRoutes());
    return router;
  })(),
} as const;
