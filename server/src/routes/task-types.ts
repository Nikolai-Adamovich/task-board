import { Hono } from 'hono';
import type { AppEnv } from '../types/context.js';
import { validateBody } from '../middleware/validation.js';
import {
  CreateTaskTypeSchema,
  UpdateTaskTypeSchema,
  DeleteTaskTypeSchema,
  ReorderTaskTypeSchema,
} from '../schemas/task-type.js';

// ─── TaskType Routes ─────────────────────────────────────────────────────────

export function createTaskTypeRoutes(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  /**
   * GET /projects/:projectId/task-types — List task types for a project.
   */
  router.get('/projects/:projectId/task-types', async (c) => {
    const projectId = c.req.param('projectId');
    const taskTypes = await c.get('svc').taskTypes.getTaskTypesByProject(projectId);

    return c.json({ data: taskTypes });
  });

  /**
   * POST /projects/:projectId/task-types — Create a task type.
   */
  router.post('/projects/:projectId/task-types', validateBody(CreateTaskTypeSchema), async (c) => {
    const projectId = c.req.param('projectId');
    const userId = c.get('userId');
    const body = c.req.valid('json');
    const taskType = await c.get('svc').taskTypes.createTaskType(projectId, body, userId);

    return c.json({ data: taskType }, 201);
  });

  /**
   * PATCH /projects/:projectId/task-types/reorder — Reorder task types in one bulk pass.
   */
  router.patch('/projects/:projectId/task-types/reorder', validateBody(ReorderTaskTypeSchema), async (c) => {
    const projectId = c.req.param('projectId');
    const body = c.req.valid('json');
    const taskTypes = await c.get('svc').taskTypes.reorder(projectId, body.items);

    return c.json({ data: taskTypes });
  });

  /**
   * PATCH /task-types/:taskTypeId — Update a task type.
   */
  router.patch('/task-types/:taskTypeId', validateBody(UpdateTaskTypeSchema), async (c) => {
    const taskTypeId = c.req.param('taskTypeId');
    const userId = c.get('userId');
    const body = c.req.valid('json');
    const taskType = await c.get('svc').taskTypes.updateTaskType(taskTypeId, body, userId);

    return c.json({ data: taskType });
  });

  /**
   * DELETE /task-types/:taskTypeId — Delete a task type (with optional replacement via body).
   */
  router.delete('/task-types/:taskTypeId', validateBody(DeleteTaskTypeSchema), async (c) => {
    const taskTypeId = c.req.param('taskTypeId');
    const userId = c.get('userId');
    const body = c.req.valid('json');

    await c.get('svc').taskTypes.deleteTaskType(taskTypeId, body.replacementTypeId, userId);

    return c.json({ data: { success: true } });
  });

  return router;
}
