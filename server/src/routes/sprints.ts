import { Hono } from 'hono';
import type { AppEnv } from '../types/context.js';
import { validateBody } from '../middleware/validation.js';
import { SprintService } from '../services/sprint.service.js';
import { SprintRepository } from '../repositories/sprint.repository.js';
import { ProjectRepository } from '../repositories/project.repository.js';
import { TaskRepository } from '../repositories/task.repository.js';
import { getCollection } from '../db/mongo.js';
import type { SprintDocument } from '../repositories/sprint.repository.js';
import type { ProjectDocument } from '../repositories/project.repository.js';
import type { TaskDocument } from '../repositories/task.repository.js';
import { CreateSprintSchema, UpdateSprintSchema } from '../schemas/sprint.js';

// ─── Sprint Routes ───────────────────────────────────────────────────────────

export function createSprintRoutes(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  /**
   * GET /projects/:projectId/sprints — List sprints for a project.
   */
  router.get('/projects/:projectId/sprints', async (c) => {
    const projectId = c.req.param('projectId');
    const service = createSprintService();
    const sprints = await service.getSprintsByProject(projectId);

    return c.json({ data: sprints });
  });

  /**
   * POST /projects/:projectId/sprints — Create a sprint.
   */
  router.post('/projects/:projectId/sprints', validateBody(CreateSprintSchema), async (c) => {
    const projectId = c.req.param('projectId');
    const body = c.get('validatedBody' as never) as { name: string; startDate?: string; endDate?: string };
    const service = createSprintService();
    const sprint = await service.createSprint(projectId, body);

    return c.json({ data: sprint }, 201);
  });

  /**
   * GET /sprints/:sprintId — Get sprint details.
   */
  router.get('/sprints/:sprintId', async (c) => {
    const sprintId = c.req.param('sprintId');
    const service = createSprintService();
    const sprint = await service.getSprint(sprintId);

    return c.json({ data: sprint });
  });

  /**
   * PATCH /sprints/:sprintId — Update sprint (name, dates, status).
   */
  router.patch('/sprints/:sprintId', validateBody(UpdateSprintSchema), async (c) => {
    const sprintId = c.req.param('sprintId');
    const body = c.get('validatedBody' as never) as {
      name?: string;
      startDate?: string;
      endDate?: string;
      status?: 'FUTURE' | 'ACTIVE' | 'COMPLETED';
    };
    const service = createSprintService();
    const sprint = await service.updateSprint(sprintId, body);

    return c.json({ data: sprint });
  });

  /**
   * DELETE /sprints/:sprintId — Delete sprint (tasks → backlog).
   */
  router.delete('/sprints/:sprintId', async (c) => {
    const sprintId = c.req.param('sprintId');
    const service = createSprintService();

    await service.deleteSprint(sprintId);

    return c.json({ data: { success: true } });
  });

  return router;
}

// ─── Factory Helper ──────────────────────────────────────────────────────────

function createSprintService(): SprintService {
  const sprintRepo = new SprintRepository(getCollection<SprintDocument>('sprints'));
  const projectRepo = new ProjectRepository(getCollection<ProjectDocument>('projects'));
  const taskRepo = new TaskRepository(getCollection<TaskDocument>('tasks')) as never;

  return new SprintService(sprintRepo, projectRepo, taskRepo);
}
