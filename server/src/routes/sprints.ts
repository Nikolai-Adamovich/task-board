import { Hono } from 'hono';
import type { AppEnv } from '../types/context.js';
import { validateBody } from '../middleware/validation.js';
import { SprintService } from '../services/sprint.service.js';
import { SprintRepository } from '../repositories/sprint.repository.js';
import { TaskRepository } from '../repositories/task.repository.js';
import { ProjectRepository } from '../repositories/project.repository.js';
import { getCollection } from '../db/mongo.js';
import type { SprintDocument } from '../repositories/sprint.repository.js';
import type { TaskDocument } from '../repositories/task.repository.js';
import type { ProjectDocument } from '../repositories/project.repository.js';
import { CreateSprintSchema, UpdateSprintSchema } from '@task-board/shared';

// ─── Sprint Routes ───────────────────────────────────────────────────────────

/**
 * Creates and returns the sprint Hono app with all sprint-related routes.
 *
 * Tenant context is already resolved. Sprint routes expect `projectId` as
 * a query parameter for listing.
 */
export function createSprintRoutes(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  /**
   * GET / — List sprints for a project.
   * Requires `projectId` query parameter.
   */
  router.get('/', async (c) => {
    const tenantId = c.get('tenantId');
    const projectId = c.req.query('projectId');

    if (!projectId) {
      return c.json({ code: 'VALIDATION_ERROR', message: 'projectId query parameter is required' }, 422);
    }

    const service = createSprintService();
    const sprints = await service.listSprints(tenantId, projectId);

    return c.json({
      data: sprints,
      total: sprints.length,
      page: 1,
      limit: sprints.length,
    });
  });

  /**
   * POST / — Create a new sprint. Admin+ only.
   * Requires `projectId` query parameter.
   */
  router.post('/', validateBody(CreateSprintSchema), async (c) => {
    const tenantId = c.get('tenantId');
    const userRole = c.get('userRole');
    const projectId = c.req.query('projectId');
    const body = c.get('validatedBody' as never) as {
      name: string;
      startDate: string;
      endDate: string;
      goal?: string;
    };

    if (!projectId) {
      return c.json({ code: 'VALIDATION_ERROR', message: 'projectId query parameter is required' }, 422);
    }

    const service = createSprintService();
    const sprint = await service.createSprint(tenantId, projectId, body, userRole);

    return c.json(sprint, 201);
  });

  /**
   * GET /:sprintId — Get sprint details with tasks.
   */
  router.get('/:sprintId', async (c) => {
    const tenantId = c.get('tenantId');
    const sprintId = c.req.param('sprintId');
    const service = createSprintService();
    const result = await service.getSprint(tenantId, sprintId);

    return c.json({ ...result.sprint, tasks: result.tasks });
  });

  /**
   * PATCH /:sprintId — Update sprint. Admin+ only.
   */
  router.patch('/:sprintId', validateBody(UpdateSprintSchema), async (c) => {
    const tenantId = c.get('tenantId');
    const userRole = c.get('userRole');
    const sprintId = c.req.param('sprintId');
    const body = c.get('validatedBody' as never) as {
      name?: string;
      startDate?: string;
      endDate?: string;
      goal?: string;
      status?: string;
    };
    const service = createSprintService();
    const sprint = await service.updateSprint(
      tenantId,
      sprintId,
      body as {
        name?: string;
        startDate?: string;
        endDate?: string;
        goal?: string;
        status?: 'planned' | 'active' | 'completed';
      },
      userRole,
    );

    return c.json(sprint);
  });

  /**
   * DELETE /:sprintId — Delete sprint. Admin+ only.
   */
  router.delete('/:sprintId', async (c) => {
    const tenantId = c.get('tenantId');
    const userRole = c.get('userRole');
    const sprintId = c.req.param('sprintId');
    const service = createSprintService();

    await service.deleteSprint(tenantId, sprintId, userRole);

    return c.json({ success: true as const });
  });

  /**
   * POST /:sprintId/tasks — Add task(s) from backlog to sprint.
   * Body: { taskId: string }
   */
  router.post('/:sprintId/tasks', async (c) => {
    const tenantId = c.get('tenantId');
    const sprintId = c.req.param('sprintId');
    const body = await c.req.json<{ taskId: string }>();

    if (!body.taskId) {
      return c.json({ code: 'VALIDATION_ERROR', message: 'taskId is required' }, 422);
    }

    const service = createSprintService();
    const sprint = await service.addTaskToSprint(tenantId, sprintId, body.taskId);

    return c.json(sprint);
  });

  /**
   * DELETE /:sprintId/tasks/:taskId — Remove task from sprint.
   */
  router.delete('/:sprintId/tasks/:taskId', async (c) => {
    const tenantId = c.get('tenantId');
    const sprintId = c.req.param('sprintId');
    const taskId = c.req.param('taskId');
    const service = createSprintService();
    const sprint = await service.removeTaskFromSprint(tenantId, sprintId, taskId);

    return c.json(sprint);
  });

  return router;
}

// ─── Factory Helper ──────────────────────────────────────────────────────────

function createSprintService(): SprintService {
  const sprintRepo = new SprintRepository(getCollection<SprintDocument>('sprints'));
  const taskRepo = new TaskRepository(getCollection<TaskDocument>('tasks'));
  const projectRepo = new ProjectRepository(getCollection<ProjectDocument>('projects'));

  return new SprintService(sprintRepo, taskRepo, projectRepo);
}
