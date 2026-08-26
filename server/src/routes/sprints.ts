import { Hono } from 'hono';
import type { AppEnv } from '../types/context.js';
import { validateBody } from '../middleware/validation.js';
import { requirePermission } from '../middleware/rbac.js';
import { CreateSprintSchema, UpdateSprintSchema } from '../schemas/sprint.js';

// ─── Sprint Routes ───────────────────────────────────────────────────────────

export function createSprintRoutes(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  /**
   * GET /projects/:projectId/sprints — List sprints for a project.
   */
  router.get('/projects/:projectId/sprints', async (c) => {
    const projectId = c.req.param('projectId');
    const sprints = await c.get('svc').sprints.getSprintsByProject(projectId);

    return c.json({ data: sprints });
  });

  /**
   * POST /projects/:projectId/sprints — Create a sprint.
   * Coarse gate at the route (projectRole resolved by tenantContextMiddleware),
   * fine-grained re-check inside the service.
   */
  router.post(
    '/projects/:projectId/sprints',
    requirePermission('create_sprint', true),
    validateBody(CreateSprintSchema),
    async (c) => {
      const projectId = c.req.param('projectId');
      const userId = c.get('userId');
      const tenantRole = c.get('tenantRole');
      const body = c.req.valid('json');
      const sprint = await c.get('svc').sprints.createSprint(projectId, body, userId, tenantRole);

      return c.json({ data: sprint }, 201);
    },
  );

  /**
   * GET /sprints/:sprintId — Get sprint details.
   */
  router.get('/sprints/:sprintId', async (c) => {
    const sprintId = c.req.param('sprintId');
    const sprint = await c.get('svc').sprints.getSprint(sprintId);

    return c.json({ data: sprint });
  });

  /**
   * PATCH /sprints/:sprintId — Update sprint (name, dates, status).
   */
  // Authorization (change_sprint_status) is enforced inside the service after
  // the sprint's project is resolved — the route path carries no projectId.
  router.patch('/sprints/:sprintId', validateBody(UpdateSprintSchema), async (c) => {
    const sprintId = c.req.param('sprintId');
    const userId = c.get('userId');
    const tenantRole = c.get('tenantRole');
    const body = c.req.valid('json');
    const sprint = await c.get('svc').sprints.updateSprint(sprintId, body, userId, tenantRole);

    return c.json({ data: sprint });
  });

  /**
   * DELETE /sprints/:sprintId — Delete sprint (tasks → backlog).
   */
  router.delete('/sprints/:sprintId', async (c) => {
    const sprintId = c.req.param('sprintId');
    const userId = c.get('userId');
    const tenantRole = c.get('tenantRole');

    await c.get('svc').sprints.deleteSprint(sprintId, userId, tenantRole);

    return c.json({ data: { success: true } });
  });

  return router;
}
