import { ProjectStatus, SprintStatus } from '@task-board/shared';
import type { Sprint, CreateSprint, UpdateSprint } from '@task-board/shared';
import { AppError, ForbiddenError, NotFoundError } from '../errors/app-error.js';
import { assertTenantEntity } from './tenant-assert.js';
import { SprintRepository } from '../repositories/sprint.repository.js';
import { ProjectRepository } from '../repositories/project.repository.js';
import { ensurePermission } from './rbac.service.js';
import type { AuditService } from './audit.service.js';

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface SprintServiceTaskRepo {
  clearSprintFromTasks(projectId: string, sprintId: string): Promise<void>;
  /** TOP-2: propagate a sprint rename to the denormalized task.sprintName */
  setSprintNameForTasks(projectId: string, sprintId: string, sprintName: string): Promise<void>;
}

/** Minimal project-member repository interface to resolve the caller's project role */
export interface SprintServiceProjectMemberRepo {
  findByUserAndProject(userId: string, projectId: string): Promise<{ role: string } | null>;
}

// ─── Sprint Service ──────────────────────────────────────────────────────────

export class SprintService {
  constructor(
    private readonly sprintRepo: SprintRepository,
    private readonly projectRepo: ProjectRepository,
    private readonly taskRepo: SprintServiceTaskRepo,
    private readonly auditService?: AuditService,
    private readonly projectMemberRepo?: SprintServiceProjectMemberRepo,
  ) {}

  /**
   * V2-4: gate sprint mutations behind the RBAC matrix (create_sprint /
   * change_sprint_status — PROJECT_ADMIN only; tenant Owner/Admin bypass
   * inside the matrix). Routes with `:projectId` in the path are additionally
   * gated by requirePermission — this is the id-based-route layer.
   */
  private async ensureSprintPermission(
    action: 'create_sprint' | 'change_sprint_status',
    projectId: string,
    userId?: string,
    userRole?: string,
  ): Promise<void> {
    if (!userId || !userRole) {
      return; // no caller context → nothing to enforce against (legacy/test callers)
    }

    if (!this.projectMemberRepo) {
      throw new ForbiddenError('Project membership lookup is unavailable');
    }

    const membership = await this.projectMemberRepo.findByUserAndProject(userId, projectId);

    ensurePermission(action, userRole, membership?.role ?? null);
  }

  async getSprintsByProject(projectId: string): Promise<Sprint[]> {
    return this.sprintRepo.findByProject(projectId);
  }

  async getSprint(id: string, tenantId: string): Promise<Sprint> {
    const sprint = await this.sprintRepo.findById(id);

    if (!sprint) {
      throw new NotFoundError('Sprint not found');
    }

    // M-02: a bare sprint id must never cross tenant boundaries (404, not 403)
    await assertTenantEntity(this.projectRepo, sprint.projectId, tenantId, 'Sprint');

    return sprint;
  }

  async createSprint(projectId: string, input: CreateSprint, userId?: string, userRole?: string): Promise<Sprint> {
    await this.ensureSprintPermission('create_sprint', projectId, userId, userRole);

    // Validate project exists and is ACTIVE
    const project = await this.projectRepo.findById(projectId);

    if (!project) {
      throw new NotFoundError('Project not found');
    }

    if (project.status !== ProjectStatus.ACTIVE) {
      throw new AppError(400, 'PROJECT_ARCHIVED', 'Cannot create sprints in an archived project');
    }

    // Validate date constraints
    if (input.startDate && input.endDate && input.endDate < input.startDate) {
      throw new AppError(422, 'INVALID_SPRINT_DATES', 'endDate must be >= startDate');
    }

    const sprint = await this.sprintRepo.create(projectId, {
      name: input.name,
      startDate: input.startDate,
      endDate: input.endDate,
    });

    // Audit side effect
    if (this.auditService && userId) {
      const project = await this.projectRepo.findById(projectId);

      await this.auditService.log({
        tenantId: project?.tenantId ?? '',
        projectId,
        entityType: 'SPRINT',
        entityId: sprint.id,
        action: 'CREATED',
        actorId: userId,
      });
    }

    return sprint;
  }

  async updateSprint(id: string, input: UpdateSprint, userId?: string, userRole?: string): Promise<Sprint> {
    const sprint = await this.sprintRepo.findById(id);

    if (!sprint) {
      throw new NotFoundError('Sprint not found');
    }

    await this.ensureSprintPermission('change_sprint_status', sprint.projectId, userId, userRole);

    // Handle status transitions with date side effects
    const updates: {
      name?: string;
      status?: string;
      startDate?: string | Date | null;
      endDate?: string | Date | null;
    } = {};

    if (input.name !== undefined) updates.name = input.name;

    if (input.status !== undefined && input.status !== sprint.status) {
      updates.status = input.status;

      // Starting sprint: set startDate to now only when null (DEC-016 — endDate is never modified on start)
      if (input.status === SprintStatus.ACTIVE) {
        if (!sprint.startDate && !input.startDate) {
          updates.startDate = new Date();
        }
      }

      // Completing sprint: set endDate to now if null
      if (input.status === SprintStatus.COMPLETED) {
        if (!sprint.endDate && !input.endDate) {
          updates.endDate = new Date();
        }
      }
    }

    if (input.startDate !== undefined) updates.startDate = input.startDate;
    if (input.endDate !== undefined) updates.endDate = input.endDate;

    // Validate date constraints
    const toDate = (value: string | Date | null | undefined): Date | null => {
      if (value === null || value === undefined) return null;
      return new Date(value);
    };
    const effectiveStartDate = updates.startDate !== undefined ? toDate(updates.startDate) : toDate(sprint.startDate);
    const effectiveEndDate = updates.endDate !== undefined ? toDate(updates.endDate) : toDate(sprint.endDate);

    if (effectiveStartDate && effectiveEndDate && effectiveEndDate < effectiveStartDate) {
      throw new AppError(422, 'INVALID_SPRINT_DATES', 'endDate must be >= startDate');
    }

    const updated = await this.sprintRepo.update(id, updates);

    if (!updated) {
      throw new NotFoundError('Sprint not found');
    }

    // TOP-2: propagate a rename to the denormalized task.sprintName (sort-only)
    if (input.name !== undefined && input.name !== sprint.name) {
      await this.taskRepo.setSprintNameForTasks(sprint.projectId, id, input.name);
    }

    // Audit side effect
    if (this.auditService && userId) {
      const project = await this.projectRepo.findById(updated.projectId);
      const changes: { field: string; oldValue: unknown; newValue: unknown }[] = [];

      if (input.name !== undefined) changes.push({ field: 'name', oldValue: sprint.name, newValue: input.name });
      if (input.status !== undefined)
        changes.push({ field: 'status', oldValue: sprint.status, newValue: input.status });
      if (input.startDate !== undefined)
        changes.push({ field: 'startDate', oldValue: sprint.startDate, newValue: input.startDate });
      if (input.endDate !== undefined)
        changes.push({ field: 'endDate', oldValue: sprint.endDate, newValue: input.endDate });
      await this.auditService.log({
        tenantId: project?.tenantId ?? '',
        projectId: updated.projectId,
        entityType: 'SPRINT',
        entityId: updated.id,
        action: 'UPDATED',
        actorId: userId,
        changes,
      });
    }

    return updated;
  }

  async deleteSprint(id: string, userId?: string, userRole?: string): Promise<void> {
    const sprint = await this.sprintRepo.findById(id);

    if (!sprint) {
      throw new NotFoundError('Sprint not found');
    }

    await this.ensureSprintPermission('change_sprint_status', sprint.projectId, userId, userRole);

    // Set sprintId = null on all affected tasks
    await this.taskRepo.clearSprintFromTasks(sprint.projectId, id);

    // Audit side effect (before hard delete)
    if (this.auditService && userId) {
      const project = await this.projectRepo.findById(sprint.projectId);

      await this.auditService.log({
        tenantId: project?.tenantId ?? '',
        projectId: sprint.projectId,
        entityType: 'SPRINT',
        entityId: sprint.id,
        action: 'DELETED',
        actorId: userId,
      });
    }

    // Hard delete the sprint
    await this.sprintRepo.delete(id);
  }
}
