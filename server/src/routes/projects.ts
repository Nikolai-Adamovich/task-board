import { Hono } from 'hono';
import type { AppEnv } from '../types/context.js';
import { validateBody } from '../middleware/validation.js';
import { ProjectService } from '../services/project.service.js';
import { ProjectRepository } from '../repositories/project.repository.js';
import { ProjectMemberRepository } from '../repositories/project-member.repository.js';
import { getCollection } from '../db/mongo.js';
import type { ProjectDocument } from '../repositories/project.repository.js';
import type { ProjectMemberDocument } from '../repositories/project-member.repository.js';
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
    const service = createProjectService();
    const projects = await service.listProjects(tenantId);

    return c.json({ data: projects });
  });

  /**
   * POST / — Create a new project with seed data. Tenant admin+ only.
   */
  router.post('/', validateBody(CreateProjectSchema), async (c) => {
    const tenantId = c.get('tenantId');
    const userId = c.get('userId');
    const userRole = c.get('tenantRole');
    const body = c.get('validatedBody' as never) as {
      key: string;
      name: string;
      description?: string;
    };
    const service = createProjectService();
    const project = await service.createProject(tenantId, userId, userRole, body);

    return c.json({ data: project }, 201);
  });

  /**
   * GET /by-key/:key — Get project by key within the active tenant.
   */
  router.get('/by-key/:key', async (c) => {
    const key = c.req.param('key');
    const tenantId = c.get('tenantId');
    const service = createProjectService();
    const project = await service.getProjectByKey(tenantId, key);

    return c.json({ data: project });
  });

  /**
   * GET /:projectId — Get project details.
   */
  router.get('/:projectId', async (c) => {
    const projectId = c.req.param('projectId');
    const service = createProjectService();
    const project = await service.getProject(projectId);

    return c.json({ data: project });
  });

  /**
   * PATCH /:projectId — Update project. Tenant admin+ only.
   */
  router.patch('/:projectId', validateBody(UpdateProjectSchema), async (c) => {
    const userRole = c.get('tenantRole');
    const projectId = c.req.param('projectId');
    const body = c.get('validatedBody' as never) as { name?: string; description?: string };
    const service = createProjectService();
    const project = await service.updateProject(projectId, userRole, body);

    return c.json({ data: project });
  });

  /**
   * DELETE /:projectId — Initiate project deletion. Tenant admin+ only.
   */
  router.delete('/:projectId', async (c) => {
    const userRole = c.get('tenantRole');
    const projectId = c.req.param('projectId');
    const service = createProjectService();

    await service.deleteProject(projectId, userRole);

    return c.json({ data: { success: true } });
  });

  /**
   * POST /:projectId/archive — Archive project.
   */
  router.post('/:projectId/archive', async (c) => {
    const userRole = c.get('tenantRole');
    const projectId = c.req.param('projectId');
    const service = createProjectService();

    await service.archiveProject(projectId, userRole);

    return c.json({ data: { success: true } });
  });

  /**
   * POST /:projectId/restore — Restore project.
   */
  router.post('/:projectId/restore', async (c) => {
    const userRole = c.get('tenantRole');
    const projectId = c.req.param('projectId');
    const service = createProjectService();

    await service.restoreProject(projectId, userRole);

    return c.json({ data: { success: true } });
  });

  /**
   * POST /:projectId/cancel-deletion — Cancel project deletion.
   */
  router.post('/:projectId/cancel-deletion', async (c) => {
    const userRole = c.get('tenantRole');
    const projectId = c.req.param('projectId');
    const service = createProjectService();

    await service.cancelDeletion(projectId, userRole);

    return c.json({ data: { success: true } });
  });

  // ─── Project Member Management ───────────────────────────────────────────

  router.get('/:projectId/members', async (c) => {
    const projectId = c.req.param('projectId');
    const service = createProjectService();
    const members = await service.getProjectMembers(projectId);

    return c.json({ data: members });
  });

  router.post('/:projectId/members', validateBody(AddProjectMemberSchema), async (c) => {
    const userRole = c.get('tenantRole');
    const projectId = c.req.param('projectId');
    const body = c.get('validatedBody' as never) as { userId: string; role: string };
    const service = createProjectService();
    const member = await service.addMember(projectId, body.userId, body.role, userRole);

    return c.json({ data: member }, 201);
  });

  router.patch('/:projectId/members/:memberUserId', validateBody(UpdateProjectMemberSchema), async (c) => {
    const userRole = c.get('tenantRole');
    const projectId = c.req.param('projectId');
    const memberUserId = c.req.param('memberUserId');
    const body = c.get('validatedBody' as never) as { role: string };
    const service = createProjectService();
    const member = await service.updateMemberRole(projectId, memberUserId, body.role, userRole);

    return c.json({ data: member });
  });

  router.delete('/:projectId/members/:memberUserId', async (c) => {
    const userRole = c.get('tenantRole');
    const projectId = c.req.param('projectId');
    const memberUserId = c.req.param('memberUserId');
    const service = createProjectService();

    await service.removeMember(projectId, memberUserId, userRole);

    return c.json({ data: { success: true } });
  });

  return router;
}

// ─── Factory Helper ──────────────────────────────────────────────────────────

function createProjectService(): ProjectService {
  const projectRepo = new ProjectRepository(getCollection<ProjectDocument>('projects'));
  const projectMemberRepo = new ProjectMemberRepository(getCollection<ProjectMemberDocument>('project_members'));
  const collections = {
    taskTypes: getCollection('task_types'),
    statuses: getCollection('statuses'),
    boards: getCollection('boards'),
  };

  return new ProjectService(projectRepo, projectMemberRepo, collections);
}
