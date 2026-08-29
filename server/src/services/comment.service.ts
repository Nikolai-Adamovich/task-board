import type { Comment, CreateComment, UpdateComment, IdentitySnapshot } from '@task-board/shared';
import { ForbiddenError, NotFoundError } from '../errors/app-error.js';
import { CommentRepository } from '../repositories/comment.repository.js';
import { ensurePermission, rbacService } from './rbac.service.js';
import { assertTenantEntity } from './tenant-assert.js';
import type { AuditService } from './audit.service.js';

export interface CommentServiceUserRepo {
  findById(id: string): Promise<{ id: string; displayName?: string; name?: string; email: string } | null>;
}

/** Minimal task repository interface to resolve a comment's project */
export interface CommentServiceTaskRepo {
  findById(id: string): Promise<{ id: string; projectId: string } | null>;
}

/** Minimal project-member repository interface to resolve the caller's project role */
export interface CommentServiceProjectMemberRepo {
  findByUserAndProject(userId: string, projectId: string): Promise<{ role: string } | null>;
}

/** Minimal project repository interface to resolve a task's tenant (M-02) */
export interface CommentServiceProjectRepo {
  findById(id: string): Promise<{ tenantId: string } | null>;
}

export class CommentService {
  constructor(
    private readonly commentRepo: CommentRepository,
    private readonly userRepo: CommentServiceUserRepo,
    private readonly taskRepo?: CommentServiceTaskRepo,
    private readonly projectMemberRepo?: CommentServiceProjectMemberRepo,
    private readonly auditService?: AuditService,
    private readonly projectRepo?: CommentServiceProjectRepo,
  ) {}

  async getCommentsByTask(taskId: string, tenantId: string): Promise<Comment[]> {
    const task = await this.requireTask(taskId);

    // M-02: a bare task id must never cross tenant boundaries (404, not 403)
    await assertTenantEntity(this.projectRepo, task.projectId, tenantId, 'Task');

    return this.commentRepo.findByTask(taskId);
  }

  /**
   * M-06: resolve the task a create-route addresses so the route can build the
   * audit context (`{ tenantId, projectId }`) from the comment service's own
   * task repo — no duplicate fetch through a different service.
   */
  async resolveTask(taskId: string): Promise<{ id: string; projectId: string }> {
    return this.requireTask(taskId);
  }

  /**
   * M-06: resolve the owning task of a comment so the update/delete routes
   * (which address comments by id) can build the audit context.
   */
  async resolveTaskForComment(commentId: string): Promise<{ id: string; projectId: string }> {
    const comment = await this.commentRepo.findById(commentId);

    if (!comment) {
      throw new NotFoundError('Comment not found');
    }

    return this.requireTask(comment.taskId);
  }

  /** Fetch the owning task or 404 — comments never exist without their task. */
  private async requireTask(taskId: string): Promise<{ id: string; projectId: string }> {
    if (!this.taskRepo) {
      throw new NotFoundError('Task not found');
    }

    const task = await this.taskRepo.findById(taskId);

    if (!task) {
      throw new NotFoundError('Task not found');
    }

    return task;
  }

  async createComment(
    taskId: string,
    authorId: string,
    input: CreateComment,
    auditContext?: { tenantId: string; projectId: string },
    userRole?: string,
  ): Promise<Comment> {
    // V2-4: Viewers are read-only — gate creation through the RBAC matrix
    // (create_comment allows PROJECT_ADMIN/EDITOR; tenant Owner/Admin bypass).
    if (userRole) {
      // M-06: when the route supplied the audit context, reuse its projectId —
      // no duplicate task fetch for the role resolution.
      const projectRole = await this.resolveCallerProjectRole(taskId, authorId, auditContext?.projectId);

      ensurePermission('create_comment', userRole, projectRole);
    }

    const authorSnapshot = await this.captureIdentitySnapshot(authorId);
    const comment = await this.commentRepo.create({
      taskId,
      authorId,
      authorSnapshot,
      body: input.body,
    });

    // Audit side effect
    if (this.auditService && auditContext) {
      await this.auditService.log({
        tenantId: auditContext.tenantId,
        projectId: auditContext.projectId,
        entityType: 'COMMENT',
        entityId: comment.id,
        action: 'CREATED',
        actorId: authorId,
      });
    }

    return comment;
  }

  async updateComment(
    commentId: string,
    userId: string,
    userRole: string,
    input: UpdateComment,
    auditContext?: { tenantId: string; projectId: string },
  ): Promise<Comment> {
    const comment = await this.commentRepo.findById(commentId);

    if (!comment) {
      throw new NotFoundError('Comment not found');
    }

    // DEC-020: base permission first, then ownership — Editors edit only their own
    // comments; Project Admin+ (and tenant Owner/Admin bypass) may moderate any.
    await this.ensureCommentAccess(comment, userId, userRole, 'edit_comment', 'edit', auditContext?.projectId);

    const updated = await this.commentRepo.update(commentId, { body: input.body });

    if (!updated) {
      throw new NotFoundError('Comment not found');
    }

    // Audit side effect
    if (this.auditService && auditContext) {
      await this.auditService.log({
        tenantId: auditContext.tenantId,
        projectId: auditContext.projectId,
        entityType: 'COMMENT',
        entityId: commentId,
        action: 'UPDATED',
        actorId: userId,
        changes: [{ field: 'body', oldValue: comment.body, newValue: input.body }],
      });
    }

    return updated;
  }

  async deleteComment(
    commentId: string,
    userId: string,
    userRole: string,
    auditContext?: { tenantId: string; projectId: string },
  ): Promise<void> {
    const comment = await this.commentRepo.findById(commentId);

    if (!comment) {
      throw new NotFoundError('Comment not found');
    }

    // DEC-020: base permission first, then ownership — Editors delete only their own
    // comments; Project Admin+ (and tenant Owner/Admin bypass) may moderate any.
    await this.ensureCommentAccess(comment, userId, userRole, 'delete_comment', 'delete', auditContext?.projectId);

    // Audit side effect (before delete)
    if (this.auditService && auditContext) {
      await this.auditService.log({
        tenantId: auditContext.tenantId,
        projectId: auditContext.projectId,
        entityType: 'COMMENT',
        entityId: commentId,
        action: 'DELETED',
        actorId: userId,
      });
    }

    await this.commentRepo.delete(commentId);
  }

  /**
   * Enforce DEC-020 comment authorization:
   * 1. `ensurePermission` gates the base action (Editors+; Viewers denied).
   * 2. Non-authors need moderation rights — evaluated through the RBAC matrix at
   *    PROJECT_ADMIN level so tenant Owner/Admin bypass applies without ad-hoc
   *    role comparisons.
   */
  private async ensureCommentAccess(
    comment: Pick<Comment, 'taskId' | 'authorId'>,
    userId: string,
    userRole: string,
    action: 'edit_comment' | 'delete_comment',
    verb: string,
    knownProjectId?: string,
  ): Promise<void> {
    const projectRole = await this.resolveCallerProjectRole(comment.taskId, userId, knownProjectId);

    // Base permission: Editors+ may act on comments (Viewers denied)
    ensurePermission(action, userRole, projectRole);

    // Moderation of other people's comments requires Project Admin-level rights
    // ('manage_project' maps to PROJECT_ADMIN + tenant Owner/Admin bypass)
    const isAuthor = comment.authorId === userId;

    if (!isAuthor && !rbacService.can(userRole, projectRole, 'manage_project')) {
      throw new ForbiddenError(`You can only ${verb} your own comments`);
    }
  }

  /**
   * Resolve the caller's project role via task → project membership.
   * `knownProjectId` (M-06) lets callers that already resolved the task skip
   * the redundant fetch.
   */
  private async resolveCallerProjectRole(
    taskId: string,
    userId: string,
    knownProjectId?: string,
  ): Promise<string | null> {
    if (!this.projectMemberRepo) {
      return null;
    }

    let projectId = knownProjectId;

    if (!projectId) {
      if (!this.taskRepo) {
        return null;
      }

      const task = await this.taskRepo.findById(taskId);

      if (!task) {
        return null;
      }

      projectId = task.projectId;
    }

    const membership = await this.projectMemberRepo.findByUserAndProject(userId, projectId);

    return membership?.role ?? null;
  }

  private async captureIdentitySnapshot(userId: string): Promise<IdentitySnapshot> {
    const user = await this.userRepo.findById(userId);

    return {
      displayName: user?.displayName ?? user?.name ?? user?.email ?? 'Unknown User',
    };
  }
}
