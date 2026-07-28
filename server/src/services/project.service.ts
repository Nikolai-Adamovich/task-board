import type { Project, ProjectMember, CreateProject, UpdateProject } from '@task-board/shared';
import { ConflictError, ForbiddenError, NotFoundError } from '../middleware/error-handler.js';
import { ProjectRepository } from '../repositories/project.repository.js';
import { ProjectMemberRepository } from '../repositories/project-member.repository.js';

// ─── Project Service ─────────────────────────────────────────────────────────

export class ProjectService {
  constructor(
    private readonly projectRepo: ProjectRepository,
    private readonly projectMemberRepo: ProjectMemberRepository,
  ) {}

  // ─── Project CRUD ──────────────────────────────────────────────────────────

  /**
   * List all projects in a tenant.
   */
  async listProjects(tenantId: string): Promise<Project[]> {
    return this.projectRepo.findByTenant(tenantId);
  }

  /**
   * Create a new project. Admin+ only.
   * Adds the creator as a project admin.
   */
  async createProject(tenantId: string, userId: string, userRole: string, input: CreateProject): Promise<Project> {
    this.requireTenantAdmin(userRole);

    // Check slug uniqueness within tenant
    const existing = await this.projectRepo.findBySlug(tenantId, input.slug);
    if (existing) {
      throw new ConflictError(`Project with slug "${input.slug}" already exists in this tenant`);
    }

    const project = await this.projectRepo.create(tenantId, input);

    // Add the creator as project admin
    await this.projectMemberRepo.create({
      userId,
      projectId: project.id,
      tenantId,
      role: 'admin',
    });

    return project;
  }

  /**
   * Get a project by ID.
   */
  async getProject(tenantId: string, id: string): Promise<Project> {
    const project = await this.projectRepo.findById(tenantId, id);
    if (!project) {
      throw new NotFoundError('Project not found');
    }
    return project;
  }

  /**
   * Update a project. Admin+ only.
   */
  async updateProject(tenantId: string, id: string, userRole: string, input: UpdateProject): Promise<Project> {
    this.requireTenantAdmin(userRole);

    // Check slug uniqueness if slug is being changed
    if (input.slug) {
      const existing = await this.projectRepo.findBySlug(tenantId, input.slug);
      if (existing && existing.id !== id) {
        throw new ConflictError(`Project with slug "${input.slug}" already exists in this tenant`);
      }
    }

    const project = await this.projectRepo.update(tenantId, id, input);
    if (!project) {
      throw new NotFoundError('Project not found');
    }

    return project;
  }

  /**
   * Delete a project. Admin+ only.
   */
  async deleteProject(tenantId: string, id: string, userRole: string): Promise<void> {
    this.requireTenantAdmin(userRole);

    const deleted = await this.projectRepo.delete(tenantId, id);
    if (!deleted) {
      throw new NotFoundError('Project not found');
    }
  }

  // ─── Project Member Management ─────────────────────────────────────────────

  /**
   * Add a member to a project. Tenant admin+ only.
   */
  async addMember(
    tenantId: string,
    projectId: string,
    userId: string,
    role: string,
    requesterRole: string,
  ): Promise<ProjectMember> {
    this.requireTenantAdmin(requesterRole);

    // Verify project exists
    await this.requireProject(tenantId, projectId);

    // Check if already a member
    const existing = await this.projectMemberRepo.findByProjectAndUser(projectId, userId);
    if (existing) {
      throw new ConflictError('User is already a member of this project');
    }

    return this.projectMemberRepo.create({
      userId,
      projectId,
      tenantId,
      role,
    });
  }

  /**
   * Update a project member's role. Tenant admin+ only.
   */
  async updateMemberRole(
    tenantId: string,
    projectId: string,
    userId: string,
    role: string,
    requesterRole: string,
  ): Promise<ProjectMember> {
    this.requireTenantAdmin(requesterRole);

    await this.requireProject(tenantId, projectId);

    const updated = await this.projectMemberRepo.updateRole(projectId, userId, role);
    if (!updated) {
      throw new NotFoundError('Project member not found');
    }

    return updated;
  }

  /**
   * Remove a member from a project. Tenant admin+ only.
   */
  async removeMember(tenantId: string, projectId: string, userId: string, requesterRole: string): Promise<void> {
    this.requireTenantAdmin(requesterRole);

    await this.requireProject(tenantId, projectId);

    const deleted = await this.projectMemberRepo.delete(projectId, userId);
    if (!deleted) {
      throw new NotFoundError('Project member not found');
    }
  }

  /**
   * List all members of a project.
   */
  async getProjectMembers(tenantId: string, projectId: string): Promise<ProjectMember[]> {
    await this.requireProject(tenantId, projectId);
    return this.projectMemberRepo.findByProject(projectId);
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private requireTenantAdmin(role: string): void {
    if (role !== 'owner' && role !== 'admin') {
      throw new ForbiddenError('Only owner or admin can perform this action');
    }
  }

  private async requireProject(tenantId: string, projectId: string): Promise<Project> {
    const project = await this.projectRepo.findById(tenantId, projectId);
    if (!project) {
      throw new NotFoundError('Project not found');
    }
    return project;
  }
}
