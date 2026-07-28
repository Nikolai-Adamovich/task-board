import type { Task, CreateTask, UpdateTask, MoveTask, AssignTask } from '@task-board/shared';
import { ForbiddenError, NotFoundError, ValidationError } from '../middleware/error-handler.js';
import { TaskRepository, type TaskFilters } from '../repositories/task.repository.js';
import { ColumnRepository } from '../repositories/column.repository.js';

// ─── Task Service ────────────────────────────────────────────────────────────

export class TaskService {
  constructor(
    private readonly taskRepo: TaskRepository,
    private readonly columnRepo: ColumnRepository,
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
