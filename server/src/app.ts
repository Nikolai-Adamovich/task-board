import { Hono } from 'hono';
import { HttpMethod } from '@task-board/shared';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import type { AppEnv } from './types/context.js';
import { getMongoClient, isIoContextError, resetSharedClient, runWithDb } from './db/mongo.js';
import { redactAuthorization } from './utils/redact.js';
import { createLogger } from './utils/logger.js';
import { requestIdMiddleware } from './middleware/request-id.js';
import { errorHandler } from './middleware/error-handler.js';
import { createReadyzRoutes } from './routes/readyz.js';
import { authMiddleware } from './middleware/auth.js';
import { tenantContextMiddleware } from './middleware/tenant-context.js';
import { provideServices } from './middleware/services.js';
import { routeRegistry } from './routes/index.js';
import { createCrossTenantTaskRoutes } from './routes/tasks.js';
import { createInvitationRoutes } from './routes/invitations.js';
import { createUserPreferencesRoutes } from './routes/user-preferences.js';

// ─── Hono App Bootstrap ──────────────────────────────────────────────────────

const app = new Hono<AppEnv>();

// ── Global middleware (order matters) ──────────────────────────────────────────
// M-10: request ids come FIRST so every log line and error envelope can be
// correlated. A well-formed incoming X-Request-Id is trusted; anything else
// gets a fresh UUID. The id is echoed on every response as X-Request-Id.
app.use('*', requestIdMiddleware);

// M-05: redact Bearer credentials from every log line. hono/logger's argument
// is a print function (void return), so redact then forward to console.log.

app.use(
  '*',
  // eslint-disable-next-line no-console -- request logging intentionally uses stdout (hono/logger's default sink)
  logger((str) => console.log(redactAuthorization(str))),
);

// CORS middleware memoized per config value: `c.env` only exists per request,
// but ALLOWED_ORIGINS is immutable for a deployment, so we rebuild the
// middleware only when the configured value actually changes.
// Default is the local dev UI origin — NEVER `*`: production must configure
// ALLOWED_ORIGINS explicitly (a wildcard default would let any origin call
// the authenticated API).
let corsConfigCache: string | null = null;
let corsMiddleware: ReturnType<typeof cors> | null = null;
let corsWildcardWarned = false;
const corsLog = createLogger({ scope: 'cors' });

app.use('*', async (c, next) => {
  const allowedOrigins = c.env?.ALLOWED_ORIGINS ?? 'http://localhost:4200';
  const environment = c.env?.ENVIRONMENT ?? 'development';

  if (!corsMiddleware || corsConfigCache !== allowedOrigins) {
    // M-09: an explicitly configured wildcard must never reach production
    // silently. Workers have no boot phase, so the check runs when the CORS
    // config is first materialized for the deployment.
    if (allowedOrigins === '*') {
      if (environment === 'production') {
        throw new Error(
          'CORS misconfiguration: ALLOWED_ORIGINS="*" is not allowed in production — set an explicit origin list.',
        );
      }

      if (!corsWildcardWarned) {
        corsWildcardWarned = true;
        corsLog.warn(
          'ALLOWED_ORIGINS="*" — any origin can call the authenticated API. ' +
            'Set an explicit origin list before deploying to production.',
        );
      }
    }

    corsConfigCache = allowedOrigins;
    corsMiddleware = cors({
      origin: allowedOrigins === '*' ? '*' : allowedOrigins.split(',').map((o: string) => o.trim()),
      allowMethods: [...(Object.values(HttpMethod) as string[]), 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization', 'X-Tenant-Id'],
      maxAge: 86400,
    });
  }

  return corsMiddleware(c, next);
});

// ── Liveness + no-DB baselines (mounted BEFORE the DB middleware on purpose) ──
// `/api/health` is liveness: it must answer even when the database is down or
// unconfigured, so it must not sit behind the DB middleware. `/api/ping` is a
// TEMPORARY twin used by the perf experiment as the true no-DB baseline.
app.get('/api/ping', (c) => c.json({ status: 'ok' }));
app.get('/api/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ── Readiness probe (N-20) ────────────────────────────────────────────────────
// Also mounted before the DB middleware: readiness verifies that a *fresh*
// Mongo connection works. It manages its own short-lived client and never
// touches the request-scoped Db context.
app.route('/api', createReadyzRoutes());

// MongoDB client acquisition.
//
// - `DB_CLIENT_MODE=per-request` (production rollback path): a fresh client
//   per request, closed after the response.
// - `DB_CLIENT_MODE=durable`: this whole app runs INSIDE the Durable Object
//   (see do/mongo-do.ts). The DO owns its I/O context — unlike a plain
//   Worker isolate — so a module-cached client with a persistent pool is
//   safe there and is the entire point of the mode.
// - Anything else ('singleton') is the plain-Worker experiment: known broken
//   (workerd#2721, error 1101), kept only as an explicit fallback value.
//
// Migrations are NOT run here — they live in server/scripts/migrate.ts and
// are executed by CD before the deploy.
app.use('/api/*', async (c, next) => {
  const uri = c.env.MONGODB_URI;

  if (!uri) {
    // M-03: fail fast with the standard error envelope instead of letting the
    // request proceed and fail later with confusing driver errors.
    return c.json(
      { error: { code: 'DB_UNAVAILABLE', message: 'Database is not configured (MONGODB_URI is empty)' } },
      503,
    );
  }

  const rawMode = c.env.DB_CLIENT_MODE ?? 'per-request';
  const clientMode = rawMode === 'per-request' ? 'per-request' : 'singleton';
  const client = await getMongoClient(uri, clientMode);

  try {
    await runWithDb(client.db(), () => next());
  } catch (err) {
    // workerd binds sockets to the request context that created them; when a
    // request surfaces an I/O-context error the cached client is dead — drop
    // it so the next request builds a fresh one. Narrow check: ordinary
    // MongoDB/network errors must not churn the pool.
    if (isIoContextError(err)) {
      resetSharedClient();
    }
    throw err;
  } finally {
    // Rollback mode keeps the old semantics exactly: a fresh client per
    // request, closed after the response. Singleton/durable modes NEVER close
    // here — the pool must survive across requests.
    if (clientMode === 'per-request') {
      client.close().catch(() => {
        /* swallow — socket may already be dead */
      });
    }
  }

  // noImplicitReturns: the early DB_UNAVAILABLE path returns a Response; this
  // path falls through to the router, so it ends with an explicit bare return.
  return;
});

// Error handler
app.onError(errorHandler);

// Request-scoped service graph (must run after the DB middleware above,
// so getCollection() resolves within the request's AsyncLocalStorage context)
app.use('/api/*', provideServices);

// ── Auth routes (no tenant context or RBAC required) ──────────────────────────
app.route('/api/auth', routeRegistry.auth);

// ── Protected routes — auth required ──────────────────────────────────────────
app.use('/api/*', authMiddleware);

// ── Tenant routes (auth only — no tenant context needed) ──────────────────────
app.route('/api/tenants', routeRegistry.tenants);

// ── Invitation routes (auth only — cross-tenant, no tenant context) ───────────
app.route('/api/invitations', createInvitationRoutes());

// ── User preferences routes (auth only — no tenant context needed) ────────────
// Mounted at /api so routes resolve to /api/projects/:projectId/preferences
app.route('/api', createUserPreferencesRoutes());

// ── Cross-tenant "My Tasks" route (auth only — no tenant context needed) ──────
app.route('/api', createCrossTenantTaskRoutes());

// ── Tenant-scoped routes (auth + tenant context required) ─────────────────────
// Use a sub-app so tenantContextMiddleware ONLY applies to these routes,
// not to preferences / invitations / tenant-management above.
const tenantScoped = new Hono<AppEnv>();

tenantScoped.use('*', tenantContextMiddleware);

// All route modules define full resource paths (e.g. /tasks/:taskId, /projects/:projectId/tasks)
// so they must be mounted at / — NOT at /<resource> — to avoid double-nesting.
tenantScoped.route('/projects', routeRegistry.projects);
tenantScoped.route('/', routeRegistry.boards);
tenantScoped.route('/', routeRegistry.tasks);
tenantScoped.route('/', routeRegistry.sprints);
tenantScoped.route('/', routeRegistry.statuses);
tenantScoped.route('/', routeRegistry.taskTypes);
tenantScoped.route('/', routeRegistry.labels);
tenantScoped.route('/', routeRegistry.comments);
tenantScoped.route('/', routeRegistry.taskRelationships);
tenantScoped.route('/', routeRegistry.filters);
tenantScoped.route('/', routeRegistry.audit);

app.route('/api', tenantScoped);

export { app };

/**
 * Routing decision for the Worker entrypoint: in `durable` mode everything
 * except the no-DB liveness endpoints is proxied into the Durable Object.
 * `/api/ping` and `/api/health` must stay on the Worker so true liveness
 * never depends on the DO (or on MongoDB) being up.
 */
export function shouldProxyToDurable(mode: string | undefined, pathname: string): boolean {
  if (mode !== 'durable') {
    return false;
  }
  return pathname !== '/api/ping' && pathname !== '/api/health';
}
