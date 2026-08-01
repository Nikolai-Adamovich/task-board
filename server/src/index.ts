import { Hono } from 'hono';
import { HttpMethod } from '@task-board/shared';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import type { AppEnv } from './types/context.js';
import { connectMongo, getCollection } from './db/mongo.js';
import { errorHandler } from './middleware/error-handler.js';
import { authMiddleware } from './middleware/auth.js';
import { tenantContextMiddleware } from './middleware/tenant-context.js';
import { routeRegistry } from './routes/index.js';
import { createInvitationRoutes } from './routes/invitations.js';
import { createUserPreferencesRoutes } from './routes/user-preferences.js';
import { TaskService } from './services/task.service.js';
import { TaskRepository } from './repositories/task.repository.js';
import { ColumnRepository } from './repositories/column.repository.js';
import { TenantMemberRepository } from './repositories/tenant-member.repository.js';
import { TenantRepository } from './repositories/tenant.repository.js';
import { ProjectRepository } from './repositories/project.repository.js';
import type { TaskDocument } from './repositories/task.repository.js';
import type { ColumnDocument } from './repositories/column.repository.js';
import type { TenantMemberDocument } from './repositories/tenant-member.repository.js';
import type { TenantDocument } from './repositories/tenant.repository.js';
import type { ProjectDocument } from './repositories/project.repository.js';

// ─── Hono App Bootstrap ──────────────────────────────────────────────────────

const app = new Hono<AppEnv>();

// ── Global middleware (order matters) ──────────────────────────────────────────
app.use('*', logger());
// CORS: allow any origin in dev; restrict via ALLOWED_ORIGINS env var in production.
// The origin list is read from the environment at request time so it works with Cloudflare Workers
// where env vars are only available inside handlers, not at module scope.
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

// Initialize MongoDB connection before any route handler
app.use('/api/v1/*', async (c, next) => {
  const uri = c.env.MONGODB_URI;

  if (uri) {
    await connectMongo(uri);
  }
  await next();
});

// Error handler (uses app.onError, not middleware)
app.onError(errorHandler);

// ── Health check (no auth required) ───────────────────────────────────────────
app.get('/api/v1/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Support route (no auth, no tenant context required) ──────────────────────
app.route('/api/v1/support', routeRegistry.support);

// ── Auth routes (no tenant context or RBAC required) ──────────────────────────
app.route('/api/v1/auth', routeRegistry.auth);

// ── Protected routes — auth required ──────────────────────────────────────────
// Apply authMiddleware to all remaining /api/v1/* routes.
// In Hono, middleware is executed in registration order, so routes registered
// before tenantContextMiddleware will NOT go through tenant context resolution.
app.use('/api/v1/*', authMiddleware);

// ── Tenant routes (auth only — no tenant context needed) ──────────────────────
// Tenant list/create are cross-tenant operations. Specific tenant operations
// (get/update/delete) check membership via the tenant service internally.
app.route('/api/v1/tenants', routeRegistry.tenants);

// ── Invitation routes (auth only — cross-tenant, no tenant context) ───────────
app.route('/api/v1/invitations', createInvitationRoutes());

// ── User preferences routes (auth only — no tenant context needed) ────────────
app.route('/api/v1/users', createUserPreferencesRoutes());

// ── Cross-tenant "my tasks" (auth only — no tenant context needed) ────────────
// Must be registered BEFORE tenantContextMiddleware since it doesn't require
// a specific tenant. Returns all tasks assigned to the user across all tenants.
app.get('/api/v1/tasks/my', async (c) => {
  const userId = c.get('userId');
  const taskRepo = new TaskRepository(getCollection<TaskDocument>('tasks'));
  const columnRepo = new ColumnRepository(getCollection<ColumnDocument>('columns'));
  const tenantMemberRepo = new TenantMemberRepository(getCollection<TenantMemberDocument>('tenant_members'));
  const tenantRepo = new TenantRepository(getCollection<TenantDocument>('tenants'));
  const projectRepo = new ProjectRepository(getCollection<ProjectDocument>('projects'));
  const service = new TaskService(taskRepo, columnRepo, tenantMemberRepo, tenantRepo, projectRepo);
  const tasks = await service.getMyTasks(userId);

  return c.json({ data: tasks, total: tasks.length });
});

// ── Tenant-scoped routes (auth + tenant context required) ─────────────────────
app.use('/api/v1/*', tenantContextMiddleware);

app.route('/api/v1/projects', routeRegistry.projects);
app.route('/api/v1/boards', routeRegistry.boards);
app.route('/api/v1/tasks', routeRegistry.tasks);
app.route('/api/v1/sprints', routeRegistry.sprints);

export default app;
