/**
 * Hono environment type defining Bindings (environment variables)
 * and Variables (request-scoped context) for the Task Board API.
 */

/** Authenticated user info stored in Hono context variables */
export interface ContextUser {
  id: string;
  email: string;
  displayName: string;
}

/** Hono environment type for the Task Board API */
export type AppEnv = {
  Bindings: {
    MONGODB_URI: string;
    JWT_SECRET: string;
    ALLOWED_ORIGINS?: string;
  };
  Variables: {
    userId: string;
    user: ContextUser;
    tenantId: string;
    userRole: string;
  };
};
