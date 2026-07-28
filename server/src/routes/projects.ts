import { Hono } from 'hono';
import type { AppEnv } from '../types/context.js';
import { validateBody } from '../middleware/validation.js';
import { ProjectService } from '../services/project.service.js';
import { ProjectRepository } from '../repositories/project.repository.js';
import { ProjectMemberRepository } from '../repositories/project-member.repository.js';
import { getCollection } from '../db/mongo.js';
import type { ProjectDocument } from '../repositories/project.repository.js';
import type { ProjectMemberDocument } from '../repositories/project-member.repository.js';
import { CreateProjectSchema, UpdateProjectSchema, ProjectRole } from '@task-board/shared';
import { z } from 'zod';

// ─── Schemas ─────────────────────────────────────────────────────────────────

const AddProjectMemberSchema = z.object({
  userId: z.uuid(),
  role: z.enum(ProjectRole),
});
const UpdateProjectMemberSchema = z.object({
  role: z.enum(ProjectRole),
});

// ─── Project Routes ──────────────────────────────────────────────────────────

/**
 * Creates and returns the project Hono app with all project-related routes,
 * including member management endpoints.
 *
 * Tenant context is already resolved by the time these handlers run
 * (tenantId and userRole are available on the context).
 */
export function createProjectRoutes(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  /**
   * GET / — List all projects in the active tenant.
   */
  router.get('/', async (c) => {
    const tenantId = c.get('tenantId');
    const service = createProjectService();
    const projects = await service.listProjects(tenantId);

    return c.json({
      data: projects,
      total: projects.length,
      page: 1,
      limit: projects.length,
    });
  });

  /**
   * POST / — Create a new project. Tenant admin+ only.
   */
  router.post('/', validateBody(CreateProjectSchema), async (c) => {
    const tenantId = c.get('tenantId');
    const userId = c.get('userId');
    const userRole = c.get('userRole');
    const body = c.get('validatedBody' as never) as {
      name: string;
      slug: string;
      description?: string;
    };
    const service = createProjectService();
    const project = await service.createProject(tenantId, userId, userRole, body);

    return c.json(project, 201);
  });

  /**
   * GET /:projectId — Get project details.
   */
  router.get('/:projectId', async (c) => {
    const tenantId = c.get('tenantId');
    const projectId = c.req.param('projectId');
    const service = createProjectService();
    const project = await service.getProject(tenantId, projectId);

    return c.json(project);
  });

  /**
   * PATCH /:projectId — Update project. Tenant admin+ only.
   */
  router.patch('/:projectId', validateBody(UpdateProjectSchema), async (c) => {
    const tenantId = c.get('tenantId');
    const userRole = c.get('userRole');
    const projectId = c.req.param('projectId');
    const body = c.get('validatedBody' as never) as {
      name?: string;
      slug?: string;
      description?: string;
    };
    const service = createProjectService();
    const project = await service.updateProject(tenantId, projectId, userRole, body);

    return c.json(project);
  });

  /**
   * DELETE /:projectId — Delete project. Tenant admin+ only.
   */
  router.delete('/:projectId', async (c) => {
    const tenantId = c.get('tenantId');
    const userRole = c.get('userRole');
    const projectId = c.req.param('projectId');
    const service = createProjectService();

    await service.deleteProject(tenantId, projectId, userRole);

    return c.json({ success: true as const });
  });

  // ─── Project Member Management ───────────────────────────────────────────

  /**
   * GET /:projectId/members — List all members of a project.
   */
  router.get('/:projectId/members', async (c) => {
    const tenantId = c.get('tenantId');
    const projectId = c.req.param('projectId');
    const service = createProjectService();
    const members = await service.getProjectMembers(tenantId, projectId);

    return c.json({
      data: members,
      total: members.length,
    });
  });

  /**
   * POST /:projectId/members — Add a member to a project. Tenant admin+ only.
   */
  router.post('/:projectId/members', validateBody(AddProjectMemberSchema), async (c) => {
    const tenantId = c.get('tenantId');
    const userRole = c.get('userRole');
    const projectId = c.req.param('projectId');
    const body = c.get('validatedBody' as never) as {
      userId: string;
      role: string;
    };
    const service = createProjectService();
    const member = await service.addMember(tenantId, projectId, body.userId, body.role, userRole);

    return c.json(member, 201);
  });

  /**
   * PATCH /:projectId/members/:userId — Update a member's role. Tenant admin+ only.
   */
  router.patch('/:projectId/members/:memberUserId', validateBody(UpdateProjectMemberSchema), async (c) => {
    const tenantId = c.get('tenantId');
    const userRole = c.get('userRole');
    const projectId = c.req.param('projectId');
    const memberUserId = c.req.param('memberUserId');
    const body = c.get('validatedBody' as never) as { role: string };
    const service = createProjectService();
    const member = await service.updateMemberRole(tenantId, projectId, memberUserId, body.role, userRole);

    return c.json(member);
  });

  /**
   * DELETE /:projectId/members/:userId — Remove a member from a project. Tenant admin+ only.
   */
  router.delete('/:projectId/members/:memberUserId', async (c) => {
    const tenantId = c.get('tenantId');
    const userRole = c.get('userRole');
    const projectId = c.req.param('projectId');
    const memberUserId = c.req.param('memberUserId');
    const service = createProjectService();

    await service.removeMember(tenantId, projectId, memberUserId, userRole);

    return c.json({ success: true as const });
  });

  return router;
}

// ─── Factory Helper ──────────────────────────────────────────────────────────

function createProjectService(): ProjectService {
  const projectRepo = new ProjectRepository(getCollection<ProjectDocument>('projects'));
  const projectMemberRepo = new ProjectMemberRepository(getCollection<ProjectMemberDocument>('project_members'));

  return new ProjectService(projectRepo, projectMemberRepo);
}
