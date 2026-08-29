import { Hono } from 'hono';
import type { AppEnv } from '../types/context.js';
import { validateBody, validateQuery } from '../middleware/validation.js';
import { requirePermission } from '../middleware/rbac.js';
import type { TaskQueryOptions } from '../repositories/task.repository.js';
import { BulkUpdateTasksSchema, CreateTaskSchema, TaskQuerySchema, UpdateTaskSchema } from '../schemas/task.js';

// ─── Task Routes ─────────────────────────────────────────────────────────────

export function createTaskRoutes(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  /**
   * GET /projects/:projectId/tasks — List tasks with filters, pagination, sort.
   * Query is validated via Zod (bounded page/limit, whitelisted sort fields,
   * ISO date ranges) — invalid input → 400 instead of NaN reaching MongoDB.
   */
  router.get('/projects/:projectId/tasks', validateQuery(TaskQuerySchema), async (c) => {
    const projectId = c.req.param('projectId');
    const q = c.req.valid('query');
    const [sortField, sortDirection] = q.sort ? q.sort.split(':') : [];
    const options: TaskQueryOptions = {
      page: q.page,
      limit: q.limit,
      search: q.search,
      statusId: q.statusId,
      priority: q.priority,
      typeId: q.typeId,
      assigneeId: q.assigneeId,
      reporterId: q.reporterId,
      sprintId: q.sprintId,
      labelId: q.labelId,
      createdFrom: q.createdFrom,
      createdTo: q.createdTo,
      updatedFrom: q.updatedFrom,
      updatedTo: q.updatedTo,
      sort: sortField && sortDirection ? { field: sortField, direction: sortDirection as 'asc' | 'desc' } : undefined,
    };
    const result = await c.get('svc').tasks.getTasksByProject(projectId, options);

    return c.json({ data: result.data, pagination: result.pagination });
  });

  /**
   * POST /projects/:projectId/tasks — Create a task.
   * Coarse gate at the route (projectRole resolved by tenantContextMiddleware),
   * fine-grained re-check inside the service.
   */
  router.post(
    '/projects/:projectId/tasks',
    requirePermission('create_task', true),
    validateBody(CreateTaskSchema),
    async (c) => {
      const projectId = c.req.param('projectId');
      const userId = c.get('userId');
      const tenantRole = c.get('tenantRole');
      const projectRole = c.get('projectRole');
      const body = c.req.valid('json');
      const task = await c.get('svc').tasks.createTask(projectId, userId, tenantRole, projectRole, body);

      return c.json({ data: task }, 201);
    },
  );

  /**
   * GET /tasks/:taskId — Get a single task by UUID or KEY-NUMBER (e.g. PRO-1).
   */
  router.get('/tasks/:taskId', async (c) => {
    const taskId = c.req.param('taskId');
    // Support KEY-NUMBER format (e.g. PRO-1)
    const keyMatch = taskId.match(/^([A-Z][A-Z0-9]*)-(\d+)$/);

    if (keyMatch) {
      const task = await c.get('svc').tasks.getTaskByKey(keyMatch[1], parseInt(keyMatch[2], 10));

      return c.json({ data: task });
    }

    const task = await c.get('svc').tasks.getTask(taskId);

    return c.json({ data: task });
  });

  /**
   * PATCH /tasks/:taskId — Update task (with optimistic concurrency).
   */
  router.patch('/tasks/:taskId', validateBody(UpdateTaskSchema), async (c) => {
    const taskId = c.req.param('taskId');
    const userId = c.get('userId');
    const tenantRole = c.get('tenantRole');
    const body = c.req.valid('json');
    // Authorization (edit_task) is enforced inside the service after the task's
    // project is resolved — the route path carries no projectId.
    const task = await c.get('svc').tasks.updateTask(taskId, body, userId, tenantRole);

    return c.json({ data: task });
  });

  /**
   * Q10 (RQ-04 ③): PATCH /projects/:projectId/tasks/bulk — bulk status/assignee/sprint update.
   * Body contract (exactly one `data` field) is enforced by Zod; per-task
   * failures (unknown id, wrong project, version conflict) are reported in the
   * response instead of failing the whole request. Authorization (`edit_task`)
   * is enforced inside the service, same as single-task update.
   */
  router.patch('/projects/:projectId/tasks/bulk', validateBody(BulkUpdateTasksSchema), async (c) => {
    const projectId = c.req.param('projectId');
    const userId = c.get('userId');
    const tenantRole = c.get('tenantRole');
    const body = c.req.valid('json');
    const result = await c.get('svc').tasks.bulkUpdateTasks(projectId, body.taskIds, body.data, userId, tenantRole);

    return c.json({ data: result });
  });

  /**
   * DELETE /tasks/:taskId — Delete task (cascade).
   */
  router.delete('/tasks/:taskId', async (c) => {
    const taskId = c.req.param('taskId');
    const userId = c.get('userId');
    const tenantRole = c.get('tenantRole');

    await c.get('svc').tasks.deleteTask(taskId, userId, tenantRole);

    return c.json({ data: { success: true } });
  });

  return router;
}

// ─── Cross-Tenant Routes (auth only — no tenant context) ─────────────────────

/**
 * Routes that must be mounted outside the tenant-scoped sub-app:
 * "My Tasks" spans all tenants of the user.
 */
export function createCrossTenantTaskRoutes(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  /**
   * GET /tasks/my — Tasks assigned to the current user across all tenants.
   */
  router.get('/tasks/my', async (c) => {
    const userId = c.get('userId');
    const tasks = await c.get('svc').tasks.getMyTasks(userId);

    return c.json({ data: tasks });
  });

  return router;
}
