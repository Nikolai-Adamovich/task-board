import type { Status, CreateStatus, UpdateStatus } from '@task-board/shared';
import { ConflictError, ForbiddenError, NotFoundError } from '../errors/app-error.js';
import { StatusRepository } from '../repositories/status.repository.js';
import { ensurePermission } from './rbac.service.js';
import type { AuditService } from './audit.service.js';

// ─── Interfaces for cross-repository dependencies ────────────────────────────

/** Minimal task repository interface needed by StatusService */
export interface StatusServiceTaskRepo {
  countByStatus(projectId: string, statusId: string): Promise<number>;
  updateManyByStatus(
    projectId: string,
    oldStatusId: string,
    newStatusId: string,
    newStatusName?: string | null,
  ): Promise<void>;
  /** TOP-2: propagate a status rename to the denormalized task.statusName */
  setStatusNameForTasks(projectId: string, statusId: string, statusName: string): Promise<void>;
}

/** Minimal board repository interface needed by StatusService */
export interface StatusServiceBoardRepo {
  replaceStatusInColumns(projectId: string, oldStatusId: string, newStatusId: string): Promise<void>;
}

/** Minimal project repository interface needed by StatusService */
export interface StatusServiceProjectRepo {
  findById(id: string): Promise<{ tenantId: string } | null>;
}

/** Minimal project-member repository interface to resolve the caller's project role */
export interface StatusServiceProjectMemberRepo {
  findByUserAndProject(userId: string, projectId: string): Promise<{ role: string } | null>;
}

// ─── Status Service ──────────────────────────────────────────────────────────

export class StatusService {
  constructor(
    private readonly statusRepo: StatusRepository,
    private readonly taskRepo: StatusServiceTaskRepo,
    private readonly boardRepo: StatusServiceBoardRepo,
    private readonly projectRepo?: StatusServiceProjectRepo,
    private readonly auditService?: AuditService,
    private readonly projectMemberRepo?: StatusServiceProjectMemberRepo,
  ) {}

  /**
   * V2-4: gate every mutation behind `manage_statuses` (PROJECT_ADMIN only;
   * tenant Owner/Admin bypass inside the RBAC matrix). Routes with
   * `:projectId` in the path are additionally gated by requirePermission —
   * this is the defense-in-depth / id-based-route layer.
   */
  private async ensureManageStatuses(projectId: string, userId?: string, userRole?: string): Promise<void> {
    if (!userId || !userRole) {
      return; // no caller context → nothing to enforce against (legacy/test callers)
    }

    if (!this.projectMemberRepo) {
      throw new ForbiddenError('Project membership lookup is unavailable');
    }

    const membership = await this.projectMemberRepo.findByUserAndProject(userId, projectId);

    ensurePermission('manage_statuses', userRole, membership?.role ?? null);
  }

  async getStatusesByProject(projectId: string): Promise<Status[]> {
    return this.statusRepo.findByProject(projectId);
  }

  /**
   * Reorder statuses in a single bulk pass (transactional alternative to
   * two sequential PATCH calls that could leave positions inconsistent).
   */
  async reorder(
    projectId: string,
    items: { id: string; position: number }[],
    userId?: string,
    userRole?: string,
  ): Promise<Status[]> {
    await this.ensureManageStatuses(projectId, userId, userRole);

    const statuses = await this.statusRepo.findByProject(projectId);
    const knownIds = new Set(statuses.map((s) => s.id));

    if (!items.every((item) => knownIds.has(item.id))) {
      throw new NotFoundError('Status not found in this project');
    }

    await this.statusRepo.reorderPositions(items);

    return this.statusRepo.findByProject(projectId);
  }

  async createStatus(projectId: string, input: CreateStatus, userId?: string, userRole?: string): Promise<Status> {
    await this.ensureManageStatuses(projectId, userId, userRole);

    const normalizedName = input.name.toLowerCase().trim();
    const existing = await this.statusRepo.findByProjectAndNormalizedName(projectId, normalizedName);

    if (existing) {
      throw new ConflictError('A status with this name already exists in this project', 'DUPLICATE_STATUS');
    }

    const status = await this.statusRepo.create(projectId, input);

    // Audit side effect
    if (this.auditService && userId && this.projectRepo) {
      const project = await this.projectRepo.findById(projectId);

      await this.auditService.log({
        tenantId: project?.tenantId ?? '',
        projectId,
        entityType: 'STATUS',
        entityId: status.id,
        action: 'CREATED',
        actorId: userId,
      });
    }

    return status;
  }

  async updateStatus(statusId: string, input: UpdateStatus, userId?: string, userRole?: string): Promise<Status> {
    const status = await this.statusRepo.findById(statusId);

    if (!status) {
      throw new NotFoundError('Status not found');
    }

    await this.ensureManageStatuses(status.projectId, userId, userRole);

    const updateFields: { name?: string; normalizedName?: string; position?: number } = {};

    if (input.name !== undefined) {
      const normalizedName = input.name.toLowerCase().trim();
      const existing = await this.statusRepo.findByProjectAndNormalizedName(status.projectId, normalizedName);

      if (existing && existing.id !== statusId) {
        throw new ConflictError('A status with this name already exists in this project', 'DUPLICATE_STATUS');
      }

      updateFields.name = input.name;
      updateFields.normalizedName = normalizedName;
    }

    if (input.position !== undefined) {
      updateFields.position = input.position;
    }

    const updated = await this.statusRepo.update(statusId, updateFields);

    if (!updated) {
      throw new NotFoundError('Status not found');
    }

    // TOP-2: propagate a rename to the denormalized task.statusName (sort-only)
    if (input.name !== undefined && input.name !== status.name) {
      await this.taskRepo.setStatusNameForTasks(status.projectId, statusId, input.name);
    }

    // Audit side effect
    if (this.auditService && userId && this.projectRepo) {
      const project = await this.projectRepo.findById(updated.projectId);
      const changes: { field: string; oldValue: unknown; newValue: unknown }[] = [];

      if (input.name !== undefined) changes.push({ field: 'name', oldValue: status.name, newValue: input.name });
      if (input.position !== undefined)
        changes.push({ field: 'position', oldValue: status.position, newValue: input.position });
      await this.auditService.log({
        tenantId: project?.tenantId ?? '',
        projectId: updated.projectId,
        entityType: 'STATUS',
        entityId: updated.id,
        action: 'UPDATED',
        actorId: userId,
        changes,
      });
    }

    return updated;
  }

  async deleteStatus(
    statusId: string,
    replacementStatusId?: string,
    userId?: string,
    userRole?: string,
  ): Promise<void> {
    const status = await this.statusRepo.findById(statusId);

    if (!status) {
      throw new NotFoundError('Status not found');
    }

    await this.ensureManageStatuses(status.projectId, userId, userRole);

    // Check if any tasks use this status
    const tasksWithStatus = await this.taskRepo.countByStatus(status.projectId, statusId);

    if (tasksWithStatus > 0) {
      if (!replacementStatusId) {
        throw new ConflictError(
          'Status is in use by tasks. Provide a replacementStatusId to reassign tasks before deletion.',
          'STATUS_IN_USE',
        );
      }

      const replacement = await this.statusRepo.findById(replacementStatusId);

      if (!replacement || replacement.projectId !== status.projectId) {
        throw new NotFoundError('Replacement status not found in this project');
      }

      // Update all tasks using this status (carries the replacement's name — TOP-2)
      await this.taskRepo.updateManyByStatus(status.projectId, statusId, replacementStatusId, replacement.name);
    }

    // Replace status in board columns
    if (replacementStatusId) {
      await this.boardRepo.replaceStatusInColumns(status.projectId, statusId, replacementStatusId);
    }

    // Audit side effect (before delete)
    if (this.auditService && userId && this.projectRepo) {
      const project = await this.projectRepo.findById(status.projectId);

      await this.auditService.log({
        tenantId: project?.tenantId ?? '',
        projectId: status.projectId,
        entityType: 'STATUS',
        entityId: statusId,
        action: 'DELETED',
        actorId: userId,
      });
    }

    await this.statusRepo.delete(statusId);
  }
}
