import type { Sprint, Task, CreateSprint, UpdateSprint } from '@task-board/shared';
import { ForbiddenError, NotFoundError, ConflictError } from '../middleware/error-handler.js';
import { SprintRepository } from '../repositories/sprint.repository.js';
import { TaskRepository } from '../repositories/task.repository.js';
import { ProjectRepository } from '../repositories/project.repository.js';

// ─── Sprint Service ──────────────────────────────────────────────────────────

export class SprintService {
  constructor(
    private readonly sprintRepo: SprintRepository,
    private readonly taskRepo: TaskRepository,
    private readonly projectRepo: ProjectRepository,
  ) {}

  /**
   * List all sprints for a project.
   */
  async listSprints(tenantId: string, projectId: string): Promise<Sprint[]> {
    await this.requireProject(tenantId, projectId);
    return this.sprintRepo.findByProject(tenantId, projectId);
  }

  /**
   * Create a new sprint. Admin+ only.
   */
  async createSprint(tenantId: string, projectId: string, input: CreateSprint, userRole: string): Promise<Sprint> {
    this.requireAdmin(userRole);
    await this.requireProject(tenantId, projectId);

    return this.sprintRepo.create(tenantId, {
      projectId,
      name: input.name,
      startDate: input.startDate,
      endDate: input.endDate,
      goal: input.goal,
    });
  }

  /**
   * Get a sprint by ID with its tasks.
   */
  async getSprint(tenantId: string, id: string): Promise<{ sprint: Sprint; tasks: Task[] }> {
    const sprint = await this.sprintRepo.findById(tenantId, id);
    if (!sprint) {
      throw new NotFoundError('Sprint not found');
    }

    const tasks = await this.taskRepo.findBySprint(tenantId, id);

    return { sprint, tasks };
  }

  /**
   * Update a sprint. Admin+ only.
   */
  async updateSprint(tenantId: string, id: string, input: UpdateSprint, userRole: string): Promise<Sprint> {
    this.requireAdmin(userRole);

    const sprint = await this.sprintRepo.update(tenantId, id, {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.startDate !== undefined && { startDate: input.startDate }),
      ...(input.endDate !== undefined && { endDate: input.endDate }),
      ...(input.goal !== undefined && { goal: input.goal }),
      ...(input.status !== undefined && { status: input.status }),
    });

    if (!sprint) {
      throw new NotFoundError('Sprint not found');
    }

    return sprint;
  }

  /**
   * Delete a sprint. Admin+ only.
   * Moves all tasks in the sprint back to backlog (clears sprintId).
   */
  async deleteSprint(tenantId: string, id: string, userRole: string): Promise<void> {
    this.requireAdmin(userRole);

    // Clear sprintId on all tasks in this sprint
    const tasks = await this.taskRepo.findBySprint(tenantId, id);
    for (const task of tasks) {
      await this.taskRepo.update(tenantId, task.id, { sprintId: null });
    }

    const deleted = await this.sprintRepo.delete(tenantId, id);
    if (!deleted) {
      throw new NotFoundError('Sprint not found');
    }
  }

  /**
   * Add a task from the backlog into a sprint.
   * Business rule: task must belong to the same project.
   */
  async addTaskToSprint(tenantId: string, sprintId: string, taskId: string): Promise<Sprint> {
    const sprint = await this.requireSprint(tenantId, sprintId);
    const task = await this.requireTask(tenantId, taskId);

    // Validate task belongs to the same project
    if (task.projectId !== sprint.projectId) {
      throw new ConflictError('Task must belong to the same project as the sprint');
    }

    // Update task's sprintId
    await this.taskRepo.update(tenantId, taskId, { sprintId });

    // Add task to sprint's taskIds
    const updatedSprint = await this.sprintRepo.addTask(tenantId, sprintId, taskId);

    if (!updatedSprint) {
      throw new NotFoundError('Sprint not found');
    }

    return updatedSprint;
  }

  /**
   * Remove a task from a sprint (moves it back to backlog).
   */
  async removeTaskFromSprint(tenantId: string, sprintId: string, taskId: string): Promise<Sprint> {
    await this.requireSprint(tenantId, sprintId);
    await this.requireTask(tenantId, taskId);

    // Clear task's sprintId
    await this.taskRepo.update(tenantId, taskId, { sprintId: null });

    // Remove task from sprint's taskIds
    const updatedSprint = await this.sprintRepo.removeTask(tenantId, sprintId, taskId);

    if (!updatedSprint) {
      throw new NotFoundError('Sprint not found');
    }

    return updatedSprint;
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private async requireProject(tenantId: string, projectId: string) {
    const project = await this.projectRepo.findById(tenantId, projectId);
    if (!project) {
      throw new NotFoundError('Project not found');
    }
    return project;
  }

  private async requireSprint(tenantId: string, sprintId: string): Promise<Sprint> {
    const sprint = await this.sprintRepo.findById(tenantId, sprintId);
    if (!sprint) {
      throw new NotFoundError('Sprint not found');
    }
    return sprint;
  }

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
