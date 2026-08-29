/**
 * Hono environment type defining Bindings (environment variables)
 * and Variables (request-scoped context) for the Task Board API v5.
 */

import type { User, TenantRole, ProjectRole } from '@task-board/shared';
import type { Services } from '../container.js';

/** Hono environment type for the Task Board API */
export interface AppEnv {
  Bindings: {
    MONGODB_URI: string;
    JWT_SECRET: string;
    ALLOWED_ORIGINS?: string;
    /** Deployment environment — 'production' enables strict boot-time checks (M-09) */
    ENVIRONMENT?: string;
    /** Minimum log level for the structured logger (S-19): debug | info | warn | error */
    LOG_LEVEL?: string;
    RESEND_API_KEY?: string;
    FRONTEND_URL?: string;
  };
  Variables: {
    /** Correlation id for this request (set by requestIdMiddleware, M-10) */
    requestId: string;
    /** Authenticated user's ID (from JWT `sub` claim) */
    userId: string;
    /** Full authenticated user object */
    user: User;
    /** Active tenant ID (set by tenantContextMiddleware) */
    tenantId: string;
    /** User's role within the active tenant */
    tenantRole: TenantRole;
    /** User's role within the active project (set per-route when applicable) */
    projectRole?: ProjectRole;
    /** Request-scoped service graph (set by provideServices middleware) */
    svc: Services;
  };
}
