import { Hono } from 'hono';
import { HttpMethod } from '@task-board/shared';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import type { AppEnv } from './types/context.js';
import { connectMongo, runWithDb } from './db/mongo.js';
import { errorHandler } from './middleware/error-handler.js';
import { authMiddleware } from './middleware/auth.js';
import { tenantContextMiddleware } from './middleware/tenant-context.js';
import { routeRegistry } from './routes/index.js';
import { createInvitationRoutes } from './routes/invitations.js';
import { createUserPreferencesRoutes } from './routes/user-preferences.js';

// ─── Hono App Bootstrap ──────────────────────────────────────────────────────

const app = new Hono<AppEnv>();

// ── Global middleware (order matters) ──────────────────────────────────────────
app.use('*', logger());
app.use('*', async (c, next) => {
  const allowedOrigins = c.env?.ALLOWED_ORIGINS ?? '*';
  const corsMiddleware = cors({
    origin: allowedOrigins === '*' ? '*' : allowedOrigins.split(',').map((o: string) => o.trim()),
    allowMethods: [...(Object.values(HttpMethod) as string[]), 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Tenant-Id'],
    maxAge: 86400,
  });

  return corsMiddleware(c, next);
});

// Create a per-request MongoDB connection and close it after the response.
// Cloudflare Workers kill TCP sockets between requests, so we must NOT
// cache a single MongoClient.  Each request gets its own client, and
// `runWithDb` makes the Db available to `getDb()` / `getCollection()`
// via AsyncLocalStorage.
app.use('/api/*', async (c, next) => {
  const uri = c.env.MONGODB_URI;

  if (uri) {
    const { client, db } = await connectMongo(uri);

    try {
      await runWithDb(db, () => next());
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
app.get('/api/tasks/my', async (c) => {
  const userId = c.get('userId');
  const { getCollection } = await import('./db/mongo.js');
  const collection = getCollection<{
    id: string;
    projectId: string;
    number: number;
    typeId: string;
    title: string;
    statusId: string;
    priority: string;
    assigneeId: string | null;
    sprintId: string | null;
    labelIds: string[];
    version: number;
    createdAt: Date;
    updatedAt: Date;
  }>('tasks');
  const docs = await collection.find({ assigneeId: userId }).sort({ updatedAt: -1 }).limit(50).toArray();
  const tasks = docs.map((doc) => ({
    id: doc.id,
    projectId: doc.projectId,
    number: doc.number,
    typeId: doc.typeId,
    title: doc.title,
    statusId: doc.statusId,
    priority: doc.priority,
    assigneeId: doc.assigneeId,
    sprintId: doc.sprintId,
    labelIds: doc.labelIds,
    version: doc.version,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  }));

  return c.json({ data: tasks });
});

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
