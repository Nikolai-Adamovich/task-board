import { Hono } from 'hono';
import type { AppEnv } from '../types/context.js';
import { validateBody } from '../middleware/validation.js';
import {
  CreateProjectSchema,
  UpdateProjectSchema,
  AddProjectMemberSchema,
  UpdateProjectMemberSchema,
} from '../schemas/project.js';

// ─── Project Routes ──────────────────────────────────────────────────────────

export function createProjectRoutes(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  /**
   * GET / — List all projects in the active tenant.
   */
  router.get('/', async (c) => {
    const tenantId = c.get('tenantId');
    const projects = await c.get('svc').projects.listProjects(tenantId);

    return c.json({ data: projects });
  });

  /**
   * POST / — Create a new project with seed data. Tenant admin+ only.
   */
  router.post('/', validateBody(CreateProjectSchema), async (c) => {
    const tenantId = c.get('tenantId');
    const userId = c.get('userId');
    const userRole = c.get('tenantRole');
    const body = c.req.valid('json');
    const project = await c.get('svc').projects.createProject(tenantId, userId, userRole, body);

    return c.json({ data: project }, 201);
  });

  /**
   * GET /by-key/:key — Get project by key within the active tenant.
   */
  router.get('/by-key/:key', async (c) => {
    const key = c.req.param('key');
    const tenantId = c.get('tenantId');
    const project = await c.get('svc').projects.getProjectByKey(tenantId, key);

    return c.json({ data: project });
  });

  /**
   * GET /:projectId — Get project details.
   */
  router.get('/:projectId', async (c) => {
    const projectId = c.req.param('projectId');
    const project = await c.get('svc').projects.getProject(projectId);

    return c.json({ data: project });
  });

  /**
   * PATCH /:projectId — Update project. Tenant admin+ only.
   */
  router.patch('/:projectId', validateBody(UpdateProjectSchema), async (c) => {
    const userRole = c.get('tenantRole');
    const projectId = c.req.param('projectId');
    const body = c.req.valid('json');
    const project = await c.get('svc').projects.updateProject(projectId, userRole, body);

    return c.json({ data: project });
  });

  /**
   * DELETE /:projectId — Initiate project deletion. Tenant admin+ only.
   */
  router.delete('/:projectId', async (c) => {
    const userRole = c.get('tenantRole');
    const projectId = c.req.param('projectId');

    await c.get('svc').projects.deleteProject(projectId, userRole);

    return c.json({ data: { success: true } });
  });

  /**
   * POST /:projectId/archive — Archive project.
   */
  router.post('/:projectId/archive', async (c) => {
    const userRole = c.get('tenantRole');
    const projectId = c.req.param('projectId');

    await c.get('svc').projects.archiveProject(projectId, userRole);

    return c.json({ data: { success: true } });
  });

  /**
   * POST /:projectId/restore — Restore project.
   */
  router.post('/:projectId/restore', async (c) => {
    const userRole = c.get('tenantRole');
    const projectId = c.req.param('projectId');

    await c.get('svc').projects.restoreProject(projectId, userRole);

    return c.json({ data: { success: true } });
  });

  /**
   * POST /:projectId/cancel-deletion — Cancel project deletion.
   */
  router.post('/:projectId/cancel-deletion', async (c) => {
    const userRole = c.get('tenantRole');
    const projectId = c.req.param('projectId');

    await c.get('svc').projects.cancelDeletion(projectId, userRole);

    return c.json({ data: { success: true } });
  });

  // ─── Project Member Management ───────────────────────────────────────────

  router.get('/:projectId/members', async (c) => {
    const projectId = c.req.param('projectId');
    const members = await c.get('svc').projects.getProjectMembers(projectId);

    return c.json({ data: members });
  });

  router.post('/:projectId/members', validateBody(AddProjectMemberSchema), async (c) => {
    const userRole = c.get('tenantRole');
    const projectId = c.req.param('projectId');
    const body = c.req.valid('json');
    const member = await c.get('svc').projects.addMember(projectId, body.userId, body.role, userRole);

    return c.json({ data: member }, 201);
  });

  router.patch('/:projectId/members/:memberUserId', validateBody(UpdateProjectMemberSchema), async (c) => {
    const userRole = c.get('tenantRole');
    const projectId = c.req.param('projectId');
    const memberUserId = c.req.param('memberUserId');
    const body = c.req.valid('json');
    const member = await c.get('svc').projects.updateMemberRole(projectId, memberUserId, body.role, userRole);

    return c.json({ data: member });
  });

  router.delete('/:projectId/members/:memberUserId', async (c) => {
    const userRole = c.get('tenantRole');
    const projectId = c.req.param('projectId');
    const memberUserId = c.req.param('memberUserId');

    await c.get('svc').projects.removeMember(projectId, memberUserId, userRole);

    return c.json({ data: { success: true } });
  });

  return router;
}
