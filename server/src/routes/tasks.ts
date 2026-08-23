import { Hono } from 'hono';
import type { AppEnv } from '../types/context.js';
import { validateBody } from '../middleware/validation.js';
import { TaskService } from '../services/task.service.js';
import { TaskRepository, type TaskQueryOptions } from '../repositories/task.repository.js';
import { CounterRepository } from '../repositories/counter.repository.js';
import { CounterService } from '../services/counter.service.js';
import { ProjectRepository } from '../repositories/project.repository.js';
import { ProjectMemberRepository } from '../repositories/project-member.repository.js';
import { StatusRepository } from '../repositories/status.repository.js';
import { TaskTypeRepository } from '../repositories/task-type.repository.js';
import { UserRepository } from '../repositories/user.repository.js';
import { SprintRepository } from '../repositories/sprint.repository.js';
import { CommentRepository } from '../repositories/comment.repository.js';
import { TaskRelationshipRepository } from '../repositories/task-relationship.repository.js';
import { AuditEventRepository } from '../repositories/audit-event.repository.js';
import { AuditService } from '../services/audit.service.js';
import { getCollection } from '../db/mongo.js';
import type { TaskDocument } from '../repositories/task.repository.js';
import type { CounterDocument } from '../repositories/counter.repository.js';
import type { ProjectDocument } from '../repositories/project.repository.js';
import type { ProjectMemberDocument } from '../repositories/project-member.repository.js';
import type { StatusDocument } from '../repositories/status.repository.js';
import type { TaskTypeDocument } from '../repositories/task-type.repository.js';
import type { UserDocument } from '../repositories/user.repository.js';
import type { SprintDocument } from '../repositories/sprint.repository.js';
import type { CommentDocument } from '../repositories/comment.repository.js';
import type { TaskRelationshipDocument } from '../repositories/task-relationship.repository.js';
import type { AuditEventDocument } from '../repositories/audit-event.repository.js';
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
    const service = createTaskService();
    const result = await service.getTasksByProject(projectId, options);

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
    const body = c.get('validatedBody' as never) as {
      typeId: string;
      title: string;
      description?: string;
      statusId: string;
      priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      assigneeId?: string;
      sprintId?: string;
      labelIds?: string[];
    };
    const service = createTaskService();
    const task = await service.createTask(projectId, userId, tenantRole, projectRole, body);

    return c.json({ data: task }, 201);
  });

  /**
   * GET /tasks/:taskId — Get task details.
   * Accepts both UUID and KEY-NUMBER format (e.g. "PRO-1").
   */
  router.get('/tasks/:taskId', async (c) => {
    const taskIdParam = c.req.param('taskId');
    const service = createTaskService();
    // Check if param matches KEY-NUMBER format (e.g. "PRO-1")
    const keyNumberMatch = taskIdParam.match(/^(.+)-(\d+)$/);

    if (keyNumberMatch) {
      const projectKey = keyNumberMatch[1];
      const number = parseInt(keyNumberMatch[2], 10);
      const task = await service.getTaskByKey(projectKey, number);

      return c.json({ data: task });
    }

    const task = await service.getTask(taskIdParam);

    return c.json({ data: task });
  });

  /**
   * PATCH /tasks/:taskId — Update task (with optimistic concurrency).
   */
  router.patch('/tasks/:taskId', validateBody(UpdateTaskSchema), async (c) => {
    const taskId = c.req.param('taskId');
    const userId = c.get('userId');
    const body = c.get('validatedBody' as never) as {
      title?: string;
      description?: string;
      statusId?: string;
      priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      assigneeId?: string | null;
      typeId?: string;
      sprintId?: string | null;
      labelIds?: string[];
      version: number;
    };
    const service = createTaskService();
    const task = await service.updateTask(taskId, body, userId);

    return c.json({ data: task });
  });

  /**
   * DELETE /tasks/:taskId — Delete task (cascade).
   */
  router.delete('/tasks/:taskId', async (c) => {
    const taskId = c.req.param('taskId');
    const userId = c.get('userId');
    const service = createTaskService();

    await service.deleteTask(taskId, userId);

    return c.json({ data: { success: true } });
  });

  return router;
}

// ─── Factory Helper ──────────────────────────────────────────────────────────

function createTaskService(): TaskService {
  const taskRepo = new TaskRepository(getCollection<TaskDocument>('tasks'));
  const counterRepo = new CounterRepository(getCollection<CounterDocument>('counters'));
  const counterService = new CounterService(counterRepo);
  const projectRepo = new ProjectRepository(getCollection<ProjectDocument>('projects'));
  const projectMemberRepo = new ProjectMemberRepository(getCollection<ProjectMemberDocument>('project_members'));
  const statusRepo = new StatusRepository(getCollection<StatusDocument>('statuses'));
  const taskTypeRepo = new TaskTypeRepository(getCollection<TaskTypeDocument>('task_types'));
  const userRepo = new UserRepository(getCollection<UserDocument>('users')) as never;
  const sprintRepo = new SprintRepository(getCollection<SprintDocument>('sprints')) as never;
  const commentRepo = new CommentRepository(getCollection<CommentDocument>('comments')) as never;
  const relationshipRepo = new TaskRelationshipRepository(
    getCollection<TaskRelationshipDocument>('task_relationships'),
  ) as never;
  const auditRepo = new AuditEventRepository(getCollection<AuditEventDocument>('audit_events'));
  const auditService = new AuditService(auditRepo, userRepo);

  return new TaskService(
    taskRepo,
    counterService,
    projectRepo,
    projectMemberRepo,
    statusRepo,
    taskTypeRepo,
    userRepo,
    sprintRepo,
    commentRepo,
    relationshipRepo,
    auditService,
  );
}
