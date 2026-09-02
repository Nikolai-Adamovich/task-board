import { ProjectStatus } from '@task-board/shared';
import { ensurePermission } from './rbac.service.js';
import type {
  Task,
  BoardTask,
  CreateTask,
  UpdateTask,
  IdentitySnapshot,
  AuditChange,
  BulkUpdateTasksResult,
  BulkUpdateTaskFailure,
} from '@task-board/shared';
import { AppError, ConflictError, NotFoundError } from '../errors/app-error.js';
import { assertTenantEntity } from './tenant-assert.js';
import {
  TaskRepository,
  type TaskQueryOptions,
  type PaginatedResult,
  type TaskUpdatePayload,
} from '../repositories/task.repository.js';
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
  findById(id: string): Promise<{ id: string; projectId: string; name?: string | null } | null>;
  /** M-14: batched lookup used by validateCrossProjectRefs */
  findByIds(ids: string[]): Promise<{ id: string; projectId: string; name?: string | null }[]>;
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

  /**
   * Board view: lightweight card projection. The repository applies the
   * exclusion projection server-side; this mapper guarantees the exact
   * BoardTask DTO shape (no description/reporter/timestamp leakage) while the
   * generic list response contract stays untouched.
   */
  async getBoardTasks(projectId: string, options: TaskQueryOptions = {}): Promise<PaginatedResult<BoardTask>> {
    const result = await this.taskRepo.findByProject(projectId, { ...options, view: 'board' });

    return {
      ...result,
      data: result.data.map((task) => ({
        id: task.id,
        projectId: task.projectId,
        number: task.number,
        title: task.title,
        typeId: task.typeId,
        statusId: task.statusId,
        priorityLevel: task.priorityLevel,
        assigneeId: task.assigneeId,
        assigneeSnapshot: task.assigneeSnapshot,
        version: task.version,
      })),
    };
  }

  /**
   * S-05: per-status task counts for the project overview — a single
   * `$match` + `$group` aggregation instead of one count per status.
   */
  async getStatusSummary(projectId: string): Promise<{ statusId: string; count: number }[]> {
    return this.taskRepo.countByStatusGrouped(projectId);
  }

  /** Tasks assigned to the user across all tenants ("My Tasks"). */
  async getMyTasks(userId: string, limit = 50): Promise<Task[]> {
    return this.taskRepo.findAssignedTo(userId, limit);
  }

  async getTask(id: string, tenantId: string): Promise<Task> {
    const task = await this.taskRepo.findById(id);

    if (!task) {
      throw new NotFoundError('Task not found');
    }

    // M-02: resolve the owning project's tenant — a bare task id must never
    // cross tenant boundaries (404, not 403, to avoid existence leaks).
    await assertTenantEntity(this.projectRepo, task.projectId, tenantId, 'Task');

    return task;
  }

  /**
   * S-04: tenant-scoped KEY-NUMBER lookup. The project key is only unique
   * within a tenant, so the project MUST be resolved through
   * `findByTenantAndKey` — a global key lookup let callers read tasks of
   * another tenant that happened to use the same project key.
   */
  async getTaskByKey(tenantId: string, projectKey: string, number: number): Promise<Task> {
    const project = await this.projectRepo.findByTenantAndKey(tenantId, projectKey);

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

    // Validate cross-project references — returns the denormalized sort names
    // (TOP-2) resolved from the SAME batched lookups (M-14: no extra findById).
    const { statusName, sprintName } = await this.validateCrossProjectRefs(projectId, {
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
      statusName,
      sprintName,
      priorityLevel: input.priorityLevel,
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
    if (input.statusId !== undefined) {
      update.statusId = input.statusId;
      // TOP-2: keep the denormalized sort name in sync with the status change
      update.statusName = (await this.statusRepo.findById(input.statusId))?.name ?? null;
    }
    if (input.priorityLevel !== undefined) update.priorityLevel = input.priorityLevel;
    if (input.typeId !== undefined) update.typeId = input.typeId;
    if (input.sprintId !== undefined) {
      update.sprintId = input.sprintId;
      // TOP-2: keep the denormalized sort name in sync with the sprint change
      update.sprintName = input.sprintId ? ((await this.sprintRepo.findById(input.sprintId))?.name ?? null) : null;
    }
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
      if (input.priorityLevel !== undefined)
        changes.push({ field: 'priorityLevel', oldValue: task.priorityLevel, newValue: input.priorityLevel });
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

  /**
   * Q10 (RQ-04 ③): bulk status/assignee/sprint update.
   * Authorization mirrors single-task `updateTask` (`edit_task` via
   * `ensurePermission`, project role resolved server-side). Tasks that do not
   * exist or belong to another project are reported per-id in `failed` —
   * they never throw. Each task is updated with the same optimistic-concurrency
   * semantics as the single update (`updateWithVersion`: `$inc version`,
   * `updatedAt` bump) and gets its own audit event.
   */
  async bulkUpdateTasks(
    projectId: string,
    taskIds: string[],
    data: { statusId?: string; assigneeId?: string | null; sprintId?: string | null },
    userId?: string,
    userRole?: string,
  ): Promise<BulkUpdateTasksResult> {
    // Permission — same action as single-task update
    if (userId && userRole) {
      const membership = await this.projectMemberRepo.findByUserAndProject(userId, projectId);

      ensurePermission('edit_task', userRole, membership?.role ?? null);
    }

    // Build the shared update payload once (single-field contract is enforced by Zod)
    const update: TaskUpdatePayload = {};

    if (data.statusId !== undefined) {
      update.statusId = data.statusId;
      // TOP-2: keep the denormalized sort name in sync with the status change
      update.statusName = (await this.statusRepo.findById(data.statusId))?.name ?? null;
    }
    if (data.sprintId !== undefined) {
      update.sprintId = data.sprintId;
      // TOP-2: keep the denormalized sort name in sync with the sprint change
      update.sprintName = data.sprintId ? ((await this.sprintRepo.findById(data.sprintId))?.name ?? null) : null;
    }
    if (data.assigneeId !== undefined) {
      update.assigneeId = data.assigneeId;
      update.assigneeSnapshot = data.assigneeId ? await this.captureIdentitySnapshot(data.assigneeId) : null;
    }

    // Resolve all requested tasks in one query; missing/wrong-project ids → failed
    const found = await this.taskRepo.findByIds(taskIds);
    const failed: BulkUpdateTaskFailure[] = [];
    const valid: Task[] = [];
    const seen = new Set<string>();

    for (const id of taskIds) {
      const task = found.find((t) => t.id === id);

      if (!task) {
        failed.push({ taskId: id, reason: 'TASK_NOT_FOUND' });
      } else if (task.projectId !== projectId) {
        failed.push({ taskId: id, reason: 'TASK_NOT_IN_PROJECT' });
      } else if (seen.has(id)) {
        continue; // duplicate id — apply once
      } else {
        seen.add(id);
        valid.push(task);
      }
    }

    // TOP-3 №1: ONE bulkWrite with per-task `{ id, version }` filters — per-task
    // optimistic concurrency and per-task failures preserved without N
    // sequential round-trips. Returns only the tasks whose version matched
    // (and was incremented); the rest are conflicts.
    const updatedTasks = await this.taskRepo.bulkUpdateWithVersion(
      valid.map((task) => ({ id: task.id, version: task.version })),
      update,
    );
    const updatedIds = new Set(updatedTasks.map((t) => t.id));
    // Hoisted: one project lookup serves the audit events of every updated task.
    let project: Awaited<ReturnType<ProjectRepository['findById']>> | null = null;

    if (this.auditService && userId) {
      project = await this.projectRepo.findById(projectId);
    }

    let updated = 0;
    const auditEvents: {
      tenantId: string;
      projectId: string | null;
      entityType: 'TASK';
      entityId: string;
      action: 'UPDATED';
      changes: AuditChange[];
    }[] = [];

    for (const task of valid) {
      if (!updatedIds.has(task.id)) {
        failed.push({ taskId: task.id, reason: 'VERSION_CONFLICT' });
        continue;
      }
      updated++;

      // Per-task audit event — persisted as ONE batch after the loop (TOP-3 №2)
      if (this.auditService && userId) {
        const changes: AuditChange[] = [];

        if (data.statusId !== undefined)
          changes.push({ field: 'statusId', oldValue: task.statusId, newValue: data.statusId });
        if (data.assigneeId !== undefined)
          changes.push({ field: 'assigneeId', oldValue: task.assigneeId, newValue: data.assigneeId });
        if (data.sprintId !== undefined)
          changes.push({ field: 'sprintId', oldValue: task.sprintId, newValue: data.sprintId });

        auditEvents.push({
          tenantId: project?.tenantId ?? '',
          projectId,
          entityType: 'TASK',
          entityId: task.id,
          action: 'UPDATED',
          changes,
        });
      }
    }

    // One batched audit write instead of N sequential inserts.
    if (this.auditService && userId && auditEvents.length > 0) {
      await this.auditService.logMany(userId, auditEvents);
    }

    return { updated, ...(failed.length > 0 ? { failed } : {}) };
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
   *
   * M-14: each reference kind is resolved with ONE batched `findByIds` query
   * and the three lookups run concurrently — the previous implementation
   * awaited a sequential `findById` per ref (up to 4 round-trips per
   * create/update). `projectId` ownership is validated in code afterwards.
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
  ): Promise<{ statusName: string | null; sprintName: string | null }> {
    const [taskTypes, statuses, sprints] = await Promise.all([
      refs.typeId ? this.taskTypeRepo.findByIds([refs.typeId]) : Promise.resolve([]),
      refs.statusId ? this.statusRepo.findByIds([refs.statusId]) : Promise.resolve([]),
      refs.sprintId ? this.sprintRepo.findByIds([refs.sprintId]) : Promise.resolve([]),
    ]);

    if (refs.typeId) {
      const taskType = taskTypes.find((t) => t.id === refs.typeId);

      if (!taskType || taskType.projectId !== projectId) {
        throw new NotFoundError(`Task type ${refs.typeId} not found in project ${projectId}`);
      }
    }

    if (refs.statusId) {
      const status = statuses.find((s) => s.id === refs.statusId);

      if (!status || status.projectId !== projectId) {
        throw new NotFoundError(`Status ${refs.statusId} not found in project ${projectId}`);
      }
    }

    if (refs.sprintId) {
      const sprint = sprints.find((s) => s.id === refs.sprintId);

      if (!sprint || sprint.projectId !== projectId) {
        throw new NotFoundError(`Sprint ${refs.sprintId} not found in project ${projectId}`);
      }
    }

    // TOP-2: the denormalized sort names come from the SAME batched lookups —
    // no additional round-trips.
    const statusName = refs.statusId ? (statuses.find((s) => s.id === refs.statusId)?.name ?? null) : null;
    const sprintName = refs.sprintId ? (sprints.find((s) => s.id === refs.sprintId)?.name ?? null) : null;

    if (refs.assigneeId) {
      const member = await this.projectMemberRepo.findByUserAndProject(refs.assigneeId, projectId);

      if (!member) {
        throw new NotFoundError(`User ${refs.assigneeId} is not a member of project ${projectId}`);
      }
    }

    return { statusName, sprintName };
  }
}
