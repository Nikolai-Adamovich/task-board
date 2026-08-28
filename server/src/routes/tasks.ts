import { Hono } from 'hono';
import type { AppEnv } from '../types/context.js';
import { validateBody } from '../middleware/validation.js';
import { requirePermission } from '../middleware/rbac.js';
import { AppError } from '../errors/app-error.js';
import type { TaskQueryOptions } from '../repositories/task.repository.js';
import { BulkUpdateTasksSchema, CreateTaskSchema, UpdateTaskSchema } from '../schemas/task.js';

// ─── Task Routes ─────────────────────────────────────────────────────────────

export function createTaskRoutes(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  /**
   * GET /projects/:projectId/tasks — List tasks with filters, pagination, sort.
   */
  router.get('/projects/:projectId/tasks', async (c) => {
    const projectId = c.req.param('projectId');
    const pageStr = c.req.query('page');
    const limitStr = c.req.query('limit');
    const sortParam = c.req.query('sort');
    let sort: { field: string; direction: 'asc' | 'desc' } | undefined;

    if (sortParam) {
      const [field, direction] = sortParam.split(':');

      sort = { field, direction: direction === 'asc' ? 'asc' : 'desc' };
    }

    // Q13/F-01: inclusive ISO date (`YYYY-MM-DD`) range filters — invalid format → 400
    const isoDateParam = (name: string): string | undefined => {
      const value = c.req.query(name);

      if (value === undefined) return undefined;

      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new AppError(400, 'VALIDATION_ERROR', `${name} must be an ISO date (YYYY-MM-DD)`);
      }

      return value;
    };
    const options: TaskQueryOptions = {
      page: pageStr ? parseInt(pageStr, 10) : 1,
      limit: limitStr ? parseInt(limitStr, 10) : 20,
      search: c.req.query('search'),
      statusId: c.req.query('statusId'),
      priority: c.req.query('priority'),
      typeId: c.req.query('typeId'),
      assigneeId: c.req.query('assigneeId'),
      reporterId: c.req.query('reporterId'),
      sprintId: c.req.query('sprintId'),
      labelId: c.req.query('labelId'),
      createdFrom: isoDateParam('createdFrom'),
      createdTo: isoDateParam('createdTo'),
      updatedFrom: isoDateParam('updatedFrom'),
      updatedTo: isoDateParam('updatedTo'),
      sort,
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
