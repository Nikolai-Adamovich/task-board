import type { TaskRelationship, CreateTaskRelationship } from '@task-board/shared';
import { AppError, NotFoundError } from '../errors/app-error.js';
import { TaskRelationshipRepository } from '../repositories/task-relationship.repository.js';
import type { AuditService } from './audit.service.js';

export interface TaskRelationshipServiceTaskRepo {
  findById(id: string): Promise<{ id: string; projectId: string } | null>;
}

export interface TaskRelationshipServiceProjectRepo {
  findById(id: string): Promise<{ tenantId: string } | null>;
}

export class TaskRelationshipService {
  constructor(
    private readonly relationshipRepo: TaskRelationshipRepository,
    private readonly taskRepo: TaskRelationshipServiceTaskRepo,
    private readonly projectRepo?: TaskRelationshipServiceProjectRepo,
    private readonly auditService?: AuditService,
  ) {}

  async getRelationshipsByTask(taskId: string): Promise<TaskRelationship[]> {
    return this.relationshipRepo.findByTask(taskId);
  }

  async createRelationship(
    sourceTaskId: string,
    createdById: string,
    input: CreateTaskRelationship,
  ): Promise<TaskRelationship> {
    // Self-relationship prevention
    if (sourceTaskId === input.targetTaskId) {
      throw new AppError(422, 'VALIDATION_ERROR', 'Cannot create a relationship to the same task');
    }

    // Validate both tasks exist
    const sourceTask = await this.taskRepo.findById(sourceTaskId);
    const targetTask = await this.taskRepo.findById(input.targetTaskId);

    if (!sourceTask) {
      throw new NotFoundError('Source task not found');
    }

    if (!targetTask) {
      throw new NotFoundError('Target task not found');
    }

    // Same-project validation
    if (sourceTask.projectId !== targetTask.projectId) {
      throw new AppError(422, 'VALIDATION_ERROR', 'Both tasks must belong to the same project');
    }

    const relationship = await this.relationshipRepo.create({
      projectId: sourceTask.projectId,
      sourceTaskId,
      targetTaskId: input.targetTaskId,
      type: input.type,
      createdById,
    });

    // Audit side effect
    if (this.auditService && this.projectRepo) {
      const project = await this.projectRepo.findById(sourceTask.projectId);

      await this.auditService.log({
        tenantId: project?.tenantId ?? '',
        projectId: sourceTask.projectId,
        entityType: 'TASK_RELATIONSHIP',
        entityId: relationship.id,
        action: 'CREATED',
        actorId: createdById,
      });
    }

    return relationship;
  }

  async deleteRelationship(relationshipId: string, userId?: string): Promise<void> {
    const relationship = await this.relationshipRepo.findById(relationshipId);

    if (!relationship) {
      throw new NotFoundError('Task relationship not found');
    }

    // Audit side effect (before delete)
    if (this.auditService && userId && this.projectRepo) {
      const project = await this.projectRepo.findById(relationship.projectId);

      await this.auditService.log({
        tenantId: project?.tenantId ?? '',
        projectId: relationship.projectId,
        entityType: 'TASK_RELATIONSHIP',
        entityId: relationshipId,
        action: 'DELETED',
        actorId: userId,
      });
    }

    await this.relationshipRepo.delete(relationshipId);
  }
}
