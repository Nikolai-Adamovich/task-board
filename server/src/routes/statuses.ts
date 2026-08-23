import { Hono } from 'hono';
import type { AppEnv } from '../types/context.js';
import { validateBody } from '../middleware/validation.js';
import { StatusService } from '../services/status.service.js';
import { StatusRepository } from '../repositories/status.repository.js';
import { TaskRepository } from '../repositories/task.repository.js';
import { BoardRepository } from '../repositories/board.repository.js';
import { ProjectRepository } from '../repositories/project.repository.js';
import { AuditEventRepository } from '../repositories/audit-event.repository.js';
import { UserRepository } from '../repositories/user.repository.js';
import { AuditService } from '../services/audit.service.js';
import { getCollection } from '../db/mongo.js';
import type { StatusDocument } from '../repositories/status.repository.js';
import type { TaskDocument } from '../repositories/task.repository.js';
import type { BoardDocument } from '../repositories/board.repository.js';
import type { ProjectDocument } from '../repositories/project.repository.js';
import type { AuditEventDocument } from '../repositories/audit-event.repository.js';
import type { UserDocument } from '../repositories/user.repository.js';
import { CreateStatusSchema, UpdateStatusSchema, DeleteStatusSchema } from '../schemas/status.js';

// ─── Status Routes ───────────────────────────────────────────────────────────

export function createStatusRoutes(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  /**
   * GET /projects/:projectId/statuses — List statuses for a project.
   */
  router.get('/projects/:projectId/statuses', async (c) => {
    const projectId = c.req.param('projectId');
    const service = createStatusService();
    const statuses = await service.getStatusesByProject(projectId);

    return c.json({ data: statuses });
  });

  /**
   * POST /projects/:projectId/statuses — Create a status.
   */
  router.post('/projects/:projectId/statuses', validateBody(CreateStatusSchema), async (c) => {
    const projectId = c.req.param('projectId');
    const userId = c.get('userId');
    const body = c.get('validatedBody' as never) as { name: string; position: number };
    const service = createStatusService();
    const status = await service.createStatus(projectId, body, userId);

    return c.json({ data: status }, 201);
  });

  /**
   * PATCH /statuses/:statusId — Update a status.
   */
  router.patch('/statuses/:statusId', validateBody(UpdateStatusSchema), async (c) => {
    const statusId = c.req.param('statusId');
    const userId = c.get('userId');
    const body = c.get('validatedBody' as never) as { name?: string; position?: number };
    const service = createStatusService();
    const status = await service.updateStatus(statusId, body, userId);

    return c.json({ data: status });
  });

  /**
   * DELETE /statuses/:statusId — Delete a status (with optional replacement via body).
   */
  router.delete('/statuses/:statusId', validateBody(DeleteStatusSchema), async (c) => {
    const statusId = c.req.param('statusId');
    const userId = c.get('userId');
    const body = c.get('validatedBody' as never) as { replacementStatusId?: string };
    const service = createStatusService();

    await service.deleteStatus(statusId, body.replacementStatusId, userId);

    return c.json({ data: { success: true } });
  });

  return router;
}

// ─── Factory Helper ──────────────────────────────────────────────────────────

function createStatusService(): StatusService {
  const statusRepo = new StatusRepository(getCollection<StatusDocument>('statuses'));
  const taskRepo = new TaskRepository(getCollection<TaskDocument>('tasks')) as never;
  const boardRepo = new BoardRepository(getCollection<BoardDocument>('boards')) as never;
  const projectRepo = new ProjectRepository(getCollection<ProjectDocument>('projects')) as never;
  const auditRepo = new AuditEventRepository(getCollection<AuditEventDocument>('audit_events'));
  const userRepo = new UserRepository(getCollection<UserDocument>('users')) as never;
  const auditService = new AuditService(auditRepo, userRepo);

  return new StatusService(statusRepo, taskRepo, boardRepo, projectRepo, auditService);
}
