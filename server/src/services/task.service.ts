import { ProjectStatus } from '@task-board/shared';
import { ensurePermission } from './rbac.service.js';
import type { Task, CreateTask, UpdateTask, IdentitySnapshot, AuditChange } from '@task-board/shared';
import { AppError, ConflictError, NotFoundError } from '../errors/app-error.js';
import { TaskRepository, type TaskQueryOptions, type PaginatedResult } from '../repositories/task.repository.js';
import { CounterService } from './counter.service.js';
import { ProjectRepository } from '../repositories/project.repository.js';
import { ProjectMemberRepository } from '../repositories/project-member.repository.js';
import { StatusRepository } from '../repositories/status.repository.js';
import { TaskTypeRepository } from '../repositories/task-type.repository.js';
import type { AuditService } from './audit.service.js';

// ─── Interfaces for cross-repository dependencies ────────────────────────────

export interface TaskServiceUserRepo {
  findById(id: string): Promise<{ id: string; displayName?: string; name?: string; email: string } | null>;
}

export interface TaskServiceSprintRepo {
  findById(id: string): Promise<{ id: string; projectId: string } | null>;
}

export interface TaskServiceCommentRepo {
  deleteByTask(taskId: string): Promise<void>;
}

export interface TaskServiceRelationshipRepo {
  deleteByTask(taskId: string): Promise<void>;
}

// ─── Task Service ────────────────────────────────────────────────────────────

export class TaskService {
  constructor(
    private readonly taskRepo: TaskRepository,
    private readonly counterService: CounterService,
    private readonly projectRepo: ProjectRepository,
    private readonly projectMemberRepo: ProjectMemberRepository,
    private readonly statusRepo: StatusRepository,
    private readonly taskTypeRepo: TaskTypeRepository,
    private readonly userRepo: TaskServiceUserRepo,
    private readonly sprintRepo: TaskServiceSprintRepo,
    private readonly commentRepo: TaskServiceCommentRepo,
    private readonly relationshipRepo: TaskServiceRelationshipRepo,
    private readonly auditService?: AuditService,
  ) {}

  // ─── Task CRUD ────────────────────────────────────────────────────────────

  async getTasksByProject(projectId: string, options: TaskQueryOptions = {}): Promise<PaginatedResult<Task>> {
    return this.taskRepo.findByProject(projectId, options);
  }

  /** Tasks assigned to the user across all tenants ("My Tasks"). */
  async getMyTasks(userId: string, limit = 50): Promise<Task[]> {
    return this.taskRepo.findAssignedTo(userId, limit);
  }

  async getTask(id: string): Promise<Task> {
    const task = await this.taskRepo.findById(id);

    if (!task) {
      throw new NotFoundError('Task not found');
    }
    return task;
  }

  async getTaskByKey(projectKey: string, number: number): Promise<Task> {
    const project = await this.projectRepo.findByKey(projectKey);

    if (!project) {
      throw new NotFoundError('Project not found');
    }

    const task = await this.taskRepo.findByProjectAndNumber(project.id, number);

    if (!task) {
      throw new NotFoundError('Task not found');
    }
    return task;
  }

  /**
   * Resolve a task by project + human-readable number (DEC-032 canonical
   * task URLs `/tasks/ABC-123`). The caller is responsible for having
   * resolved the projectId from the tenant-scoped URL context.
   */
  async getTaskByNumber(projectId: string, number: number): Promise<Task> {
    const task = await this.taskRepo.findByProjectAndNumber(projectId, number);

    if (!task) {
      throw new NotFoundError('Task not found');
    }
    return task;
  }

  async createTask(
    projectId: string,
    userId: string,
    userRole: string,
    projectRole: string | undefined,
    input: CreateTask,
  ): Promise<Task> {
    // Validate project exists and is ACTIVE
    const project = await this.projectRepo.findById(projectId);

    if (!project) {
      throw new NotFoundError('Project not found');
    }

    if (project.status !== ProjectStatus.ACTIVE) {
      throw new AppError(400, 'PROJECT_ARCHIVED', 'Cannot create tasks in an archived project');
    }

    // Validate EDITOR+ role
    ensurePermission('create_task', userRole, projectRole);

    // Validate cross-project references
    await this.validateCrossProjectRefs(projectId, {
      typeId: input.typeId,
      statusId: input.statusId,
      assigneeId: input.assigneeId,
      sprintId: input.sprintId,
      labelIds: input.labelIds,
    });

    // Get next sequential number
    const number = await this.counterService.getNextTaskNumber(projectId);
    // Capture identity snapshots
    const createdBySnapshot = await this.captureIdentitySnapshot(userId);
    const reporterSnapshot = createdBySnapshot; // reporter is the creator at creation time
    let assigneeSnapshot: IdentitySnapshot | undefined;

    if (input.assigneeId) {
      assigneeSnapshot = await this.captureIdentitySnapshot(input.assigneeId);
    }

    const task = await this.taskRepo.create({
      projectId,
      number,
      typeId: input.typeId,
      title: input.title,
      description: input.description,
      statusId: input.statusId,
      priority: input.priority,
      reporterId: userId,
      reporterSnapshot,
      assigneeId: input.assigneeId,
      assigneeSnapshot,
      sprintId: input.sprintId,
      labelIds: input.labelIds,
      createdById: userId,
      createdBySnapshot,
    });

    // Audit side effect
    if (this.auditService) {
      const project = await this.projectRepo.findById(projectId);

      await this.auditService.log({
        tenantId: project?.tenantId ?? '',
        projectId,
        entityType: 'TASK',
        entityId: task.id,
        action: 'CREATED',
        actorId: userId,
      });
    }

    return task;
  }

  async updateTask(taskId: string, input: UpdateTask, userId?: string, userRole?: string): Promise<Task> {
    const task = await this.taskRepo.findById(taskId);

    if (!task) {
      throw new NotFoundError('Task not found');
    }

    // V2-4: the route path carries no projectId, so authorization is enforced
    // here after resolving the caller's project role (tenant Owner/Admin bypass
    // is handled inside the RBAC matrix).
    if (userId && userRole) {
      const membership = await this.projectMemberRepo.findByUserAndProject(userId, task.projectId);

      ensurePermission('edit_task', userRole, membership?.role ?? null);
    }

    // Optimistic concurrency check
    if (task.version !== input.version) {
      throw new ConflictError(
        `Task was modified concurrently. Current version: ${task.version}, provided version: ${input.version}`,
        'TASK_VERSION_CONFLICT',
      );
    }

    // Build update payload for changed fields only
    const update: Record<string, unknown> = {};

    if (input.title !== undefined) update.title = input.title;
    if (input.description !== undefined) update.description = input.description;
    if (input.statusId !== undefined) update.statusId = input.statusId;
    if (input.priority !== undefined) update.priority = input.priority;
    if (input.typeId !== undefined) update.typeId = input.typeId;
    if (input.sprintId !== undefined) update.sprintId = input.sprintId;
    if (input.labelIds !== undefined) update.labelIds = input.labelIds;

    // Handle assignee change with snapshot
    if (input.assigneeId !== undefined) {
      update.assigneeId = input.assigneeId;
      if (input.assigneeId) {
        update.assigneeSnapshot = await this.captureIdentitySnapshot(input.assigneeId);
      } else {
        update.assigneeSnapshot = null;
      }
    }

    const updated = await this.taskRepo.updateWithVersion(
      taskId,
      input.version,
      update as Parameters<TaskRepository['updateWithVersion']>[2],
    );

    if (!updated) {
      throw new ConflictError('Task was modified concurrently', 'TASK_VERSION_CONFLICT');
    }

    // Audit side effect
    if (this.auditService && userId) {
      const project = await this.projectRepo.findById(updated.projectId);
      const changes: AuditChange[] = [];

      if (input.title !== undefined) changes.push({ field: 'title', oldValue: task.title, newValue: input.title });
      if (input.statusId !== undefined)
        changes.push({ field: 'statusId', oldValue: task.statusId, newValue: input.statusId });
      if (input.priority !== undefined)
        changes.push({ field: 'priority', oldValue: task.priority, newValue: input.priority });
      if (input.assigneeId !== undefined)
        changes.push({ field: 'assigneeId', oldValue: task.assigneeId, newValue: input.assigneeId });
      if (input.typeId !== undefined) changes.push({ field: 'typeId', oldValue: task.typeId, newValue: input.typeId });
      if (input.sprintId !== undefined)
        changes.push({ field: 'sprintId', oldValue: task.sprintId, newValue: input.sprintId });
      if (input.description !== undefined)
        changes.push({ field: 'description', oldValue: task.description, newValue: input.description });
      if (input.labelIds !== undefined)
        changes.push({ field: 'labelIds', oldValue: task.labelIds, newValue: input.labelIds });
      await this.auditService.log({
        tenantId: project?.tenantId ?? '',
        projectId: updated.projectId,
        entityType: 'TASK',
        entityId: updated.id,
        action: 'UPDATED',
        actorId: userId,
        changes,
      });
    }

    return updated;
  }

  async deleteTask(taskId: string, userId?: string, userRole?: string): Promise<void> {
    const task = await this.taskRepo.findById(taskId);

    if (!task) {
      throw new NotFoundError('Task not found');
    }

    // V2-4: see updateTask — project role resolved server-side, then gated.
    if (userId && userRole) {
      const membership = await this.projectMemberRepo.findByUserAndProject(userId, task.projectId);

      ensurePermission('delete_task', userRole, membership?.role ?? null);
    }

    // Cascade delete: comments, relationships, label associations
    await this.commentRepo.deleteByTask(taskId);
    await this.relationshipRepo.deleteByTask(taskId);

    // Audit side effect (before hard delete)
    if (this.auditService && userId) {
      const project = await this.projectRepo.findById(task.projectId);

      await this.auditService.log({
        tenantId: project?.tenantId ?? '',
        projectId: task.projectId,
        entityType: 'TASK',
        entityId: task.id,
        action: 'DELETED',
        actorId: userId,
      });
    }

    // Hard delete the task
    await this.taskRepo.delete(taskId);
  }

  async searchTasks(projectId: string, searchTerm: string): Promise<Task[]> {
    return this.taskRepo.search(projectId, searchTerm);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  /**
   * Capture an identity snapshot for a user.
   */
  private async captureIdentitySnapshot(userId: string): Promise<IdentitySnapshot> {
    const user = await this.userRepo.findById(userId);

    return {
      displayName: user?.displayName ?? user?.name ?? user?.email ?? 'Unknown User',
    };
  }

  /**
   * Validate that all referenced entities belong to the same project.
   */
  private async validateCrossProjectRefs(
    projectId: string,
    refs: {
      typeId?: string;
      statusId?: string;
      assigneeId?: string;
      sprintId?: string;
      labelIds?: string[];
    },
  ): Promise<void> {
    if (refs.typeId) {
      const taskType = await this.taskTypeRepo.findById(refs.typeId);

      if (!taskType || taskType.projectId !== projectId) {
        throw new NotFoundError(`Task type ${refs.typeId} not found in project ${projectId}`);
      }
    }

    if (refs.statusId) {
      const status = await this.statusRepo.findById(refs.statusId);

      if (!status || status.projectId !== projectId) {
        throw new NotFoundError(`Status ${refs.statusId} not found in project ${projectId}`);
      }
    }

    if (refs.sprintId) {
      const sprint = await this.sprintRepo.findById(refs.sprintId);

      if (!sprint || sprint.projectId !== projectId) {
        throw new NotFoundError(`Sprint ${refs.sprintId} not found in project ${projectId}`);
      }
    }

    if (refs.assigneeId) {
      const member = await this.projectMemberRepo.findByUserAndProject(refs.assigneeId, projectId);

      if (!member) {
        throw new NotFoundError(`User ${refs.assigneeId} is not a member of project ${projectId}`);
      }
    }
  }
}
