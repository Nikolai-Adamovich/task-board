import { Hono } from 'hono';
import { HttpMethod } from '@task-board/shared';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import type { AppEnv } from './types/context.js';
import { connectMongo, runWithDb } from './db/mongo.js';
import {
  migrateInvitedMembershipsToRevoked,
  renameSeedStatusNames,
  backfillTenantSlugs,
  ensureTenantSlugUniqueIndex,
  backfillMemberExpiresAt,
} from './db/migrations.js';
import { errorHandler } from './middleware/error-handler.js';
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
app.use('*', logger());

// CORS middleware memoized per config value: `c.env` only exists per request,
// but ALLOWED_ORIGINS is immutable for a deployment, so we rebuild the
// middleware only when the configured value actually changes.
let corsConfigCache: string | null = null;
let corsMiddleware: ReturnType<typeof cors> | null = null;

app.use('*', async (c, next) => {
  const allowedOrigins = c.env?.ALLOWED_ORIGINS ?? '*';

  if (!corsMiddleware || corsConfigCache !== allowedOrigins) {
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

// Create a per-request MongoDB connection and close it after the response.
// Cloudflare Workers kill TCP sockets between requests, so we must NOT
// cache a single MongoClient.  Each request gets its own client, and
// `runWithDb` makes the Db available to `getDb()` / `getCollection()`
// via AsyncLocalStorage.

// Idempotent data migrations run once per isolate on the first DB-backed
// request (the flag is deployment-scoped, not request-scoped state).
let migrationsRun = false;

app.use('/api/*', async (c, next) => {
  const uri = c.env.MONGODB_URI;

  if (uri) {
    const { client, db } = await connectMongo(uri);

    try {
      await runWithDb(db, async () => {
        if (!migrationsRun) {
          await migrateInvitedMembershipsToRevoked(db);
          await renameSeedStatusNames(db); // DR-1 — raw seed-status keys → display names
          await backfillTenantSlugs(db); // DEC-032 — must run before the unique slug index
          await ensureTenantSlugUniqueIndex(db);
          await backfillMemberExpiresAt(db); // DEC-055 — expiresAt: null on legacy members
          migrationsRun = true;
        }
        await next();
      });
    } finally {
      client.close().catch(() => {
        /* swallow — socket may already be dead */
      });
    }
  } else {
    await next();
  }
});

// Error handler
app.onError(errorHandler);

// Request-scoped service graph (must run after the DB middleware above,
// so getCollection() resolves within the request's AsyncLocalStorage context)
app.use('/api/*', provideServices);

// ── Health check (no auth required) ───────────────────────────────────────────
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

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

export default app;
