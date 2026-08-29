import type { TaskRelationship, CreateTaskRelationship } from '@task-board/shared';
import { AppError, ForbiddenError, NotFoundError } from '../errors/app-error.js';
import { TaskRelationshipRepository } from '../repositories/task-relationship.repository.js';
import { ensurePermission } from './rbac.service.js';
import type { AuditService } from './audit.service.js';

export interface TaskRelationshipServiceTaskRepo {
  findById(id: string): Promise<{ id: string; projectId: string } | null>;
}

export interface TaskRelationshipServiceProjectRepo {
  findById(id: string): Promise<{ tenantId: string } | null>;
}

/** Minimal project-member repository interface to resolve the caller's project role */
export interface TaskRelationshipServiceProjectMemberRepo {
  findByUserAndProject(userId: string, projectId: string): Promise<{ role: string } | null>;
}

export class TaskRelationshipService {
  constructor(
    private readonly relationshipRepo: TaskRelationshipRepository,
    private readonly taskRepo: TaskRelationshipServiceTaskRepo,
    private readonly projectRepo?: TaskRelationshipServiceProjectRepo,
    private readonly auditService?: AuditService,
    private readonly projectMemberRepo?: TaskRelationshipServiceProjectMemberRepo,
  ) {}

  /**
   * V2-4: gate every mutation behind `manage_task_relationships`
   * (PROJECT_ADMIN + EDITOR; tenant Owner/Admin bypass inside the RBAC
   * matrix). This is the defense-in-depth layer for id-based routes that
   * carry no `:projectId` in the path.
   */
  private async ensureManageTaskRelationships(projectId: string, userId?: string, userRole?: string): Promise<void> {
    if (!userId || !userRole) {
      return; // no caller context → nothing to enforce against (legacy/test callers)
    }

    if (!this.projectMemberRepo) {
      throw new ForbiddenError('Project membership lookup is unavailable');
    }

    const membership = await this.projectMemberRepo.findByUserAndProject(userId, projectId);

    ensurePermission('manage_task_relationships', userRole, membership?.role ?? null);
  }

  async getRelationshipsByTask(taskId: string): Promise<TaskRelationship[]> {
    return this.relationshipRepo.findByTask(taskId);
  }

  async createRelationship(
    sourceTaskId: string,
    createdById: string,
    input: CreateTaskRelationship,
    userRole?: string,
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

    await this.ensureManageTaskRelationships(sourceTask.projectId, createdById, userRole);

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

  async deleteRelationship(relationshipId: string, userId?: string, userRole?: string): Promise<void> {
    const relationship = await this.relationshipRepo.findById(relationshipId);

    if (!relationship) {
      throw new NotFoundError('Task relationship not found');
    }

    await this.ensureManageTaskRelationships(relationship.projectId, userId, userRole);

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
