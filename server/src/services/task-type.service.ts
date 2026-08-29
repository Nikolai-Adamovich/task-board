import type { TaskType, CreateTaskType, UpdateTaskType } from '@task-board/shared';
import { ConflictError, ForbiddenError, NotFoundError } from '../errors/app-error.js';
import { TaskTypeRepository } from '../repositories/task-type.repository.js';
import { ensurePermission } from './rbac.service.js';
import type { AuditService } from './audit.service.js';

// ─── Interfaces for cross-repository dependencies ────────────────────────────

/** Minimal task repository interface needed by TaskTypeService */
export interface TaskTypeServiceTaskRepo {
  countByType(projectId: string, typeId: string): Promise<number>;
  updateManyByType(projectId: string, oldTypeId: string, newTypeId: string): Promise<void>;
}

/** Minimal project repository interface needed by TaskTypeService */
export interface TaskTypeServiceProjectRepo {
  findById(id: string): Promise<{ tenantId: string } | null>;
}

/** Minimal project-member repository interface to resolve the caller's project role */
export interface TaskTypeServiceProjectMemberRepo {
  findByUserAndProject(userId: string, projectId: string): Promise<{ role: string } | null>;
}

// ─── TaskType Service ────────────────────────────────────────────────────────

export class TaskTypeService {
  constructor(
    private readonly taskTypeRepo: TaskTypeRepository,
    private readonly taskRepo: TaskTypeServiceTaskRepo,
    private readonly projectRepo?: TaskTypeServiceProjectRepo,
    private readonly auditService?: AuditService,
    private readonly projectMemberRepo?: TaskTypeServiceProjectMemberRepo,
  ) {}

  /**
   * V2-4: gate every mutation behind `edit_project_config` (PROJECT_ADMIN
   * only; tenant Owner/Admin bypass inside the RBAC matrix). Routes with
   * `:projectId` in the path are additionally gated by requirePermission —
   * this is the defense-in-depth / id-based-route layer.
   */
  private async ensureEditProjectConfig(projectId: string, userId?: string, userRole?: string): Promise<void> {
    if (!userId || !userRole) {
      return; // no caller context → nothing to enforce against (legacy/test callers)
    }

    if (!this.projectMemberRepo) {
      throw new ForbiddenError('Project membership lookup is unavailable');
    }

    const membership = await this.projectMemberRepo.findByUserAndProject(userId, projectId);

    ensurePermission('edit_project_config', userRole, membership?.role ?? null);
  }

  async getTaskTypesByProject(projectId: string): Promise<TaskType[]> {
    return this.taskTypeRepo.findByProject(projectId);
  }

  /**
   * Reorder task types in a single bulk pass (transactional alternative to
   * two sequential PATCH calls that could leave positions inconsistent).
   */
  async reorder(
    projectId: string,
    items: { id: string; position: number }[],
    userId?: string,
    userRole?: string,
  ): Promise<TaskType[]> {
    await this.ensureEditProjectConfig(projectId, userId, userRole);

    const taskTypes = await this.taskTypeRepo.findByProject(projectId);
    const knownIds = new Set(taskTypes.map((t) => t.id));

    if (!items.every((item) => knownIds.has(item.id))) {
      throw new NotFoundError('Task type not found in this project');
    }

    await this.taskTypeRepo.reorderPositions(items);

    return this.taskTypeRepo.findByProject(projectId);
  }

  async createTaskType(
    projectId: string,
    input: CreateTaskType,
    userId?: string,
    userRole?: string,
  ): Promise<TaskType> {
    await this.ensureEditProjectConfig(projectId, userId, userRole);

    const existing = await this.taskTypeRepo.findByProjectAndKey(projectId, input.key);

    if (existing) {
      throw new ConflictError('A task type with this key already exists in this project', 'CONFLICT');
    }

    const taskType = await this.taskTypeRepo.create(projectId, input);

    // Audit side effect
    if (this.auditService && userId && this.projectRepo) {
      const project = await this.projectRepo.findById(projectId);

      await this.auditService.log({
        tenantId: project?.tenantId ?? '',
        projectId,
        entityType: 'TASK_TYPE',
        entityId: taskType.id,
        action: 'CREATED',
        actorId: userId,
      });
    }

    return taskType;
  }

  async updateTaskType(
    taskTypeId: string,
    input: UpdateTaskType,
    userId?: string,
    userRole?: string,
  ): Promise<TaskType> {
    const taskType = await this.taskTypeRepo.findById(taskTypeId);

    if (!taskType) {
      throw new NotFoundError('Task type not found');
    }

    await this.ensureEditProjectConfig(taskType.projectId, userId, userRole);

    // Key is immutable — ignore any key in input
    const updated = await this.taskTypeRepo.update(taskTypeId, {
      name: input.name,
      icon: input.icon,
      position: input.position,
    });

    if (!updated) {
      throw new NotFoundError('Task type not found');
    }

    // Audit side effect
    if (this.auditService && userId && this.projectRepo) {
      const project = await this.projectRepo.findById(updated.projectId);
      const changes: { field: string; oldValue: unknown; newValue: unknown }[] = [];

      if (input.name !== undefined) changes.push({ field: 'name', oldValue: taskType.name, newValue: input.name });
      if (input.icon !== undefined) changes.push({ field: 'icon', oldValue: taskType.icon, newValue: input.icon });
      if (input.position !== undefined)
        changes.push({ field: 'position', oldValue: taskType.position, newValue: input.position });
      await this.auditService.log({
        tenantId: project?.tenantId ?? '',
        projectId: updated.projectId,
        entityType: 'TASK_TYPE',
        entityId: updated.id,
        action: 'UPDATED',
        actorId: userId,
        changes,
      });
    }

    return updated;
  }

  async deleteTaskType(
    taskTypeId: string,
    replacementTypeId?: string,
    userId?: string,
    userRole?: string,
  ): Promise<void> {
    const taskType = await this.taskTypeRepo.findById(taskTypeId);

    if (!taskType) {
      throw new NotFoundError('Task type not found');
    }

    await this.ensureEditProjectConfig(taskType.projectId, userId, userRole);

    // Check if any tasks use this type
    const tasksWithType = await this.taskRepo.countByType(taskType.projectId, taskTypeId);

    if (tasksWithType > 0) {
      if (!replacementTypeId) {
        throw new ConflictError(
          'Task type is in use by tasks. Provide a replacementTypeId to reassign tasks before deletion.',
          'TASK_TYPE_IN_USE',
        );
      }

      const replacement = await this.taskTypeRepo.findById(replacementTypeId);

      if (!replacement || replacement.projectId !== taskType.projectId) {
        throw new NotFoundError('Replacement task type not found in this project');
      }

      // Update all tasks using this type
      await this.taskRepo.updateManyByType(taskType.projectId, taskTypeId, replacementTypeId);
    }

    // Audit side effect (before delete)
    if (this.auditService && userId && this.projectRepo) {
      const project = await this.projectRepo.findById(taskType.projectId);

      await this.auditService.log({
        tenantId: project?.tenantId ?? '',
        projectId: taskType.projectId,
        entityType: 'TASK_TYPE',
        entityId: taskTypeId,
        action: 'DELETED',
        actorId: userId,
      });
    }

    await this.taskTypeRepo.delete(taskTypeId);
  }
}
