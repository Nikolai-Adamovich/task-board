import { Hono } from 'hono';
import type { AppEnv } from '../types/context.js';
import { validateBody } from '../middleware/validation.js';
import { TaskService } from '../services/task.service.js';
import { TaskRepository, type TaskFilters } from '../repositories/task.repository.js';
import { ColumnRepository } from '../repositories/column.repository.js';
import { TenantMemberRepository } from '../repositories/tenant-member.repository.js';
import { TenantRepository } from '../repositories/tenant.repository.js';
import { ProjectRepository } from '../repositories/project.repository.js';
import { getCollection } from '../db/mongo.js';
import type { TaskDocument } from '../repositories/task.repository.js';
import type { ColumnDocument } from '../repositories/column.repository.js';
import type { TenantMemberDocument } from '../repositories/tenant-member.repository.js';
import type { TenantDocument } from '../repositories/tenant.repository.js';
import type { ProjectDocument } from '../repositories/project.repository.js';
import { CreateTaskSchema, UpdateTaskSchema, MoveTaskSchema, AssignTaskSchema } from '../schemas/task.js';

// ─── Task Routes ─────────────────────────────────────────────────────────────

/**
 * Creates and returns the task Hono app with all task-related routes.
 *
 * Tenant context is already resolved. Task routes expect filter
 * query parameters for listing and task IDs for individual operations.
 */
export function createTaskRoutes(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  /**
   * GET / — List tasks with optional filters.
   * Query params: projectId, boardId, columnId, sprintId, assigneeId, page, limit
   */
  router.get('/', async (c) => {
    const tenantId = c.get('tenantId');
    const filters: TaskFilters & { page?: number; limit?: number } = {
      projectId: c.req.query('projectId'),
      boardId: c.req.query('boardId'),
      columnId: c.req.query('columnId'),
      sprintId: c.req.query('sprintId'),
      assigneeId: c.req.query('assigneeId'),
    };
    const page = c.req.query('page');
    const limit = c.req.query('limit');

    if (page) filters.page = parseInt(page, 10);
    if (limit) filters.limit = parseInt(limit, 10);

    const service = createTaskService();
    const result = await service.listTasks(tenantId, filters);

    return c.json(result);
  });

  /**
   * POST / — Create a new task. Member+ only.
   */
  router.post('/', validateBody(CreateTaskSchema), async (c) => {
    const tenantId = c.get('tenantId');
    const userId = c.get('userId');
    const body = c.get('validatedBody' as never) as {
      title: string;
      description?: string;
      projectId: string;
      boardId: string;
      columnId: string;
      sprintId?: string;
      priority?: string;
      assigneeIds?: string[];
    };
    const service = createTaskService();
    const task = await service.createTask(tenantId, userId, body as never);

    return c.json(task, 201);
  });

  /**
   * GET /:taskId — Get task details.
   */
  router.get('/:taskId', async (c) => {
    const tenantId = c.get('tenantId');
    const taskId = c.req.param('taskId');
    const service = createTaskService();
    const task = await service.getTask(tenantId, taskId);

    return c.json(task);
  });

  /**
   * PATCH /:taskId — Update task.
   * Members can edit own tasks, admin+ can edit any task.
   */
  router.patch('/:taskId', validateBody(UpdateTaskSchema), async (c) => {
    const tenantId = c.get('tenantId');
    const userId = c.get('userId');
    const userRole = c.get('userRole');
    const taskId = c.req.param('taskId');
    const body = c.get('validatedBody' as never) as {
      title?: string;
      description?: string;
      priority?: string;
      assigneeIds?: string[];
    };
    const service = createTaskService();
    const task = await service.updateTask(tenantId, userId, taskId, body as never, userRole);

    return c.json(task);
  });

  /**
   * DELETE /:taskId — Delete task. Admin+ only.
   */
  router.delete('/:taskId', async (c) => {
    const tenantId = c.get('tenantId');
    const userRole = c.get('userRole');
    const taskId = c.req.param('taskId');
    const service = createTaskService();

    await service.deleteTask(tenantId, taskId, userRole);

    return c.json({ success: true as const });
  });

  /**
   * PATCH /:taskId/move — Move task to a different column.
   */
  router.patch('/:taskId/move', validateBody(MoveTaskSchema), async (c) => {
    const tenantId = c.get('tenantId');
    const taskId = c.req.param('taskId');
    const body = c.get('validatedBody' as never) as {
      taskId: string;
      targetColumnId: string;
      targetSprintId?: string;
    };

    // Override taskId from URL param
    body.taskId = taskId;

    const service = createTaskService();
    const task = await service.moveTask(tenantId, body as never);

    return c.json(task);
  });

  /**
   * PATCH /:taskId/assign — Assign/unassign users to a task.
   */
  router.patch('/:taskId/assign', validateBody(AssignTaskSchema), async (c) => {
    const tenantId = c.get('tenantId');
    const taskId = c.req.param('taskId');
    const body = c.get('validatedBody' as never) as {
      taskId: string;
      assigneeIds: string[];
    };

    // Override taskId from URL param
    body.taskId = taskId;

    const service = createTaskService();
    const task = await service.assignTask(tenantId, body as never);

    return c.json(task);
  });

  return router;
}

// ─── Factory Helper ──────────────────────────────────────────────────────────

function createTaskService(): TaskService {
  const taskRepo = new TaskRepository(getCollection<TaskDocument>('tasks'));
  const columnRepo = new ColumnRepository(getCollection<ColumnDocument>('columns'));
  const tenantMemberRepo = new TenantMemberRepository(getCollection<TenantMemberDocument>('tenant_members'));
  const tenantRepo = new TenantRepository(getCollection<TenantDocument>('tenants'));
  const projectRepo = new ProjectRepository(getCollection<ProjectDocument>('projects'));

  return new TaskService(taskRepo, columnRepo, tenantMemberRepo, tenantRepo, projectRepo);
}
