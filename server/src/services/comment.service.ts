import type { Comment, CreateComment, UpdateComment, IdentitySnapshot } from '@task-board/shared';
import { ForbiddenError, NotFoundError } from '../errors/app-error.js';
import { CommentRepository } from '../repositories/comment.repository.js';
import { ensurePermission, rbacService } from './rbac.service.js';
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

export class CommentService {
  constructor(
    private readonly commentRepo: CommentRepository,
    private readonly userRepo: CommentServiceUserRepo,
    private readonly taskRepo?: CommentServiceTaskRepo,
    private readonly projectMemberRepo?: CommentServiceProjectMemberRepo,
    private readonly auditService?: AuditService,
  ) {}

  async getCommentsByTask(taskId: string): Promise<Comment[]> {
    return this.commentRepo.findByTask(taskId);
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
      const projectRole = await this.resolveCallerProjectRole(taskId, authorId);

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
    await this.ensureCommentAccess(comment, userId, userRole, 'edit_comment', 'edit');

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
    await this.ensureCommentAccess(comment, userId, userRole, 'delete_comment', 'delete');

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
  ): Promise<void> {
    const projectRole = await this.resolveCallerProjectRole(comment.taskId, userId);

    // Base permission: Editors+ may act on comments (Viewers denied)
    ensurePermission(action, userRole, projectRole);

    // Moderation of other people's comments requires Project Admin-level rights
    // ('manage_project' maps to PROJECT_ADMIN + tenant Owner/Admin bypass)
    const isAuthor = comment.authorId === userId;

    if (!isAuthor && !rbacService.can(userRole, projectRole, 'manage_project')) {
      throw new ForbiddenError(`You can only ${verb} your own comments`);
    }
  }

  /** Resolve the caller's project role via comment → task → project membership. */
  private async resolveCallerProjectRole(taskId: string, userId: string): Promise<string | null> {
    if (!this.taskRepo || !this.projectMemberRepo) {
      return null;
    }

    const task = await this.taskRepo.findById(taskId);

    if (!task) {
      return null;
    }

    const membership = await this.projectMemberRepo.findByUserAndProject(userId, task.projectId);

    return membership?.role ?? null;
  }

  private async captureIdentitySnapshot(userId: string): Promise<IdentitySnapshot> {
    const user = await this.userRepo.findById(userId);

    return {
      displayName: user?.displayName ?? user?.name ?? user?.email ?? 'Unknown User',
    };
  }
}
