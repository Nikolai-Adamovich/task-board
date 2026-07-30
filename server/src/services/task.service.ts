import type { Task, CreateTask, UpdateTask, MoveTask, AssignTask, MyTask } from '@task-board/shared';
import { ForbiddenError, NotFoundError, ValidationError } from '../middleware/error-handler.js';
import { TaskRepository, type TaskFilters } from '../repositories/task.repository.js';
import { ColumnRepository } from '../repositories/column.repository.js';
import { TenantMemberRepository } from '../repositories/tenant-member.repository.js';
import { TenantRepository } from '../repositories/tenant.repository.js';
import { ProjectRepository } from '../repositories/project.repository.js';

// ─── Task Service ────────────────────────────────────────────────────────────

export class TaskService {
  constructor(
    private readonly taskRepo: TaskRepository,
    private readonly columnRepo: ColumnRepository,
    private readonly tenantMemberRepo: TenantMemberRepository,
    private readonly tenantRepo: TenantRepository,
    private readonly projectRepo: ProjectRepository,
  ) {}

  /**
   * List tasks with optional filters and pagination.
   */
  async listTasks(
    tenantId: string,
    filters: TaskFilters & { page?: number; limit?: number },
  ): Promise<{ data: Task[]; total: number; page: number; limit: number }> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const allTasks = await this.taskRepo.findByFilters(tenantId, {
      projectId: filters.projectId,
      boardId: filters.boardId,
      columnId: filters.columnId,
      sprintId: filters.sprintId,
      assigneeId: filters.assigneeId,
    });
    const total = allTasks.length;
    const start = (page - 1) * limit;
    const data = allTasks.slice(start, start + limit);

    return { data, total, page, limit };
  }

  /**
   * Create a new task. Member+ only.
   * Auto-assigns position as max position + 1 in the target column.
   */
  async createTask(tenantId: string, userId: string, input: CreateTask): Promise<Task> {
    // Validate column exists
    const column = await this.columnRepo.findById(tenantId, input.columnId);

    if (!column) {
      throw new NotFoundError('Column not found');
    }

    // Auto-assign position
    const maxPosition = await this.taskRepo.getMaxPosition(tenantId, input.boardId, input.columnId);

    return this.taskRepo.create(tenantId, {
      projectId: input.projectId,
      boardId: input.boardId,
      columnId: input.columnId,
      sprintId: input.sprintId,
      title: input.title,
      description: input.description,
      assigneeIds: input.assigneeIds,
      priority: input.priority,
      position: maxPosition + 1,
      createdBy: userId,
    });
  }

  /**
   * Get a task by ID.
   */
  async getTask(tenantId: string, id: string): Promise<Task> {
    const task = await this.taskRepo.findById(tenantId, id);

    if (!task) {
      throw new NotFoundError('Task not found');
    }
    return task;
  }

  /**
   * Update a task.
   * Member+ can edit own tasks. Admin+ can edit any task.
   */
  async updateTask(tenantId: string, userId: string, id: string, input: UpdateTask, userRole: string): Promise<Task> {
    const task = await this.requireTask(tenantId, id);

    // Members can only edit their own tasks
    if (userRole === 'member' && task.createdBy !== userId) {
      throw new ForbiddenError('You can only edit your own tasks');
    }

    const updated = await this.taskRepo.update(tenantId, id, {
      ...(input.title !== undefined && { title: input.title }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.priority !== undefined && { priority: input.priority }),
      ...(input.assigneeIds !== undefined && { assigneeIds: input.assigneeIds }),
    });

    if (!updated) {
      throw new NotFoundError('Task not found');
    }

    return updated;
  }

  /**
   * Delete a task. Admin+ only.
   */
  async deleteTask(tenantId: string, id: string, userRole: string): Promise<void> {
    this.requireAdmin(userRole);

    const deleted = await this.taskRepo.delete(tenantId, id);

    if (!deleted) {
      throw new NotFoundError('Task not found');
    }
  }

  /**
   * Move a task to a different column.
   * Validates that the target column belongs to the same board.
   * Updates position to max + 1 in the target column.
   */
  async moveTask(tenantId: string, input: MoveTask): Promise<Task> {
    const task = await this.requireTask(tenantId, input.taskId);
    // Validate target column exists
    const targetColumn = await this.columnRepo.findById(tenantId, input.targetColumnId);

    if (!targetColumn) {
      throw new NotFoundError('Target column not found');
    }

    // Validate target column belongs to the same board
    if (targetColumn.boardId !== task.boardId) {
      throw new ValidationError('Target column must belong to the same board');
    }

    // Get max position in target column
    const maxPosition = await this.taskRepo.getMaxPosition(tenantId, task.boardId, input.targetColumnId);
    const updated = await this.taskRepo.update(tenantId, input.taskId, {
      columnId: input.targetColumnId,
      position: maxPosition + 1,
      ...(input.targetSprintId !== undefined && {
        sprintId: input.targetSprintId,
      }),
    });

    if (!updated) {
      throw new NotFoundError('Task not found');
    }

    return updated;
  }

  /**
   * Assign or unassign users to a task.
   */
  async assignTask(tenantId: string, input: AssignTask): Promise<Task> {
    await this.requireTask(tenantId, input.taskId);

    const updated = await this.taskRepo.update(tenantId, input.taskId, {
      assigneeIds: input.assigneeIds,
    });

    if (!updated) {
      throw new NotFoundError('Task not found');
    }

    return updated;
  }

  // ─── Cross-Tenant "My Tasks" ──────────────────────────────────────────────

  /**
   * Get all tasks assigned to the user across all active tenant memberships.
   * Denormalizes tenant name, project name, and column title for the dashboard.
   */
  async getMyTasks(userId: string): Promise<MyTask[]> {
    // 1. Get all active tenant memberships for the user
    const memberships = await this.tenantMemberRepo.findByUser(userId);
    const activeTenantIds = memberships.filter((m) => m.status === 'active').map((m) => m.tenantId);

    if (activeTenantIds.length === 0) return [];

    // 2. Find tasks across all active tenants where user is assignee
    const taskDocs = await this.taskRepo.findByAssignee(userId, activeTenantIds);
    // 3. Batch lookup caches to avoid redundant queries
    const tenantNames = new Map<string, string>();
    const projectNames = new Map<string, string>();
    const columnTitles = new Map<string, string>();
    // 4. Denormalize with tenant/project/column names
    const result: MyTask[] = [];

    for (const doc of taskDocs) {
      // Tenant name
      if (!tenantNames.has(doc.tenantId)) {
        const tenant = await this.tenantRepo.findById(doc.tenantId);

        tenantNames.set(doc.tenantId, tenant?.name ?? '');
      }

      // Project name
      const projectKey = `${doc.tenantId}:${doc.projectId}`;

      if (!projectNames.has(projectKey)) {
        const project = await this.projectRepo.findById(doc.tenantId, doc.projectId);

        projectNames.set(projectKey, project?.name ?? '');
      }

      // Column title
      const columnKey = `${doc.tenantId}:${doc.columnId}`;

      if (!columnTitles.has(columnKey)) {
        const column = await this.columnRepo.findById(doc.tenantId, doc.columnId);

        columnTitles.set(columnKey, column?.name ?? '');
      }

      result.push({
        id: doc.id,
        tenantId: doc.tenantId,
        tenantName: tenantNames.get(doc.tenantId) ?? '',
        projectId: doc.projectId,
        projectName: projectNames.get(projectKey) ?? '',
        boardId: doc.boardId,
        columnId: doc.columnId,
        columnTitle: columnTitles.get(columnKey) ?? '',
        title: doc.title,
        description: doc.description ?? null,
        priority: doc.priority as MyTask['priority'],
        sprintId: doc.sprintId,
        createdAt: doc.createdAt.toISOString(),
        updatedAt: doc.updatedAt.toISOString(),
      });
    }

    return result;
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private async requireTask(tenantId: string, taskId: string): Promise<Task> {
    const task = await this.taskRepo.findById(tenantId, taskId);

    if (!task) {
      throw new NotFoundError('Task not found');
    }
    return task;
  }

  private requireAdmin(role: string): void {
    if (role !== 'owner' && role !== 'admin') {
      throw new ForbiddenError('Only owner or admin can perform this action');
    }
  }
}
