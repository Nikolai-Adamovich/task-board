import { Hono } from 'hono';
import type { AppEnv } from '../types/context.js';
import { validateBody } from '../middleware/validation.js';
import type { TaskQueryOptions } from '../repositories/task.repository.js';
import { CreateTaskSchema, UpdateTaskSchema } from '../schemas/task.js';

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
      sort,
    };
    const result = await c.get('svc').tasks.getTasksByProject(projectId, options);

    return c.json({ data: result.data, pagination: result.pagination });
  });

  /**
   * POST /projects/:projectId/tasks — Create a task.
   */
  router.post('/projects/:projectId/tasks', validateBody(CreateTaskSchema), async (c) => {
    const projectId = c.req.param('projectId');
    const userId = c.get('userId');
    const tenantRole = c.get('tenantRole');
    const projectRole = c.get('projectRole');
    const body = c.req.valid('json');
    const task = await c.get('svc').tasks.createTask(projectId, userId, tenantRole, projectRole, body);

    return c.json({ data: task }, 201);
  });

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
    const body = c.req.valid('json');
    const task = await c.get('svc').tasks.updateTask(taskId, body, userId);

    return c.json({ data: task });
  });

  /**
   * DELETE /tasks/:taskId — Delete task (cascade).
   */
  router.delete('/tasks/:taskId', async (c) => {
    const taskId = c.req.param('taskId');
    const userId = c.get('userId');

    await c.get('svc').tasks.deleteTask(taskId, userId);

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
