import { Hono } from 'hono';
import type { AppEnv } from '../types/context.js';
import { validateBody } from '../middleware/validation.js';
import { TaskTypeService } from '../services/task-type.service.js';
import { TaskTypeRepository } from '../repositories/task-type.repository.js';
import { TaskRepository } from '../repositories/task.repository.js';
import { ProjectRepository } from '../repositories/project.repository.js';
import { AuditEventRepository } from '../repositories/audit-event.repository.js';
import { UserRepository } from '../repositories/user.repository.js';
import { AuditService } from '../services/audit.service.js';
import { getCollection } from '../db/mongo.js';
import type { TaskTypeDocument } from '../repositories/task-type.repository.js';
import type { TaskDocument } from '../repositories/task.repository.js';
import type { ProjectDocument } from '../repositories/project.repository.js';
import type { AuditEventDocument } from '../repositories/audit-event.repository.js';
import type { UserDocument } from '../repositories/user.repository.js';
import { CreateTaskTypeSchema, UpdateTaskTypeSchema, DeleteTaskTypeSchema } from '../schemas/task-type.js';

// ─── TaskType Routes ─────────────────────────────────────────────────────────

export function createTaskTypeRoutes(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  /**
   * GET /projects/:projectId/task-types — List task types for a project.
   */
  router.get('/projects/:projectId/task-types', async (c) => {
    const projectId = c.req.param('projectId');
    const service = createTaskTypeService();
    const taskTypes = await service.getTaskTypesByProject(projectId);

    return c.json({ data: taskTypes });
  });

  /**
   * POST /projects/:projectId/task-types — Create a task type.
   */
  router.post('/projects/:projectId/task-types', validateBody(CreateTaskTypeSchema), async (c) => {
    const projectId = c.req.param('projectId');
    const userId = c.get('userId');
    const body = c.get('validatedBody' as never) as { key: string; name: string; icon?: string; position: number };
    const service = createTaskTypeService();
    const taskType = await service.createTaskType(projectId, body, userId);

    return c.json({ data: taskType }, 201);
  });

  /**
   * PATCH /task-types/:taskTypeId — Update a task type.
   */
  router.patch('/task-types/:taskTypeId', validateBody(UpdateTaskTypeSchema), async (c) => {
    const taskTypeId = c.req.param('taskTypeId');
    const userId = c.get('userId');
    const body = c.get('validatedBody' as never) as { name?: string; icon?: string; position?: number };
    const service = createTaskTypeService();
    const taskType = await service.updateTaskType(taskTypeId, body, userId);

    return c.json({ data: taskType });
  });

  /**
   * DELETE /task-types/:taskTypeId — Delete a task type (with optional replacement via body).
   */
  router.delete('/task-types/:taskTypeId', validateBody(DeleteTaskTypeSchema), async (c) => {
    const taskTypeId = c.req.param('taskTypeId');
    const userId = c.get('userId');
    const body = c.get('validatedBody' as never) as { replacementTypeId?: string };
    const service = createTaskTypeService();

    await service.deleteTaskType(taskTypeId, body.replacementTypeId, userId);

    return c.json({ data: { success: true } });
  });

  return router;
}

// ─── Factory Helper ──────────────────────────────────────────────────────────

function createTaskTypeService(): TaskTypeService {
  const taskTypeRepo = new TaskTypeRepository(getCollection<TaskTypeDocument>('task_types'));
  const taskRepo = new TaskRepository(getCollection<TaskDocument>('tasks')) as never;
  const projectRepo = new ProjectRepository(getCollection<ProjectDocument>('projects')) as never;
  const auditRepo = new AuditEventRepository(getCollection<AuditEventDocument>('audit_events'));
  const userRepo = new UserRepository(getCollection<UserDocument>('users')) as never;
  const auditService = new AuditService(auditRepo, userRepo);

  return new TaskTypeService(taskTypeRepo, taskRepo, projectRepo, auditService);
}
