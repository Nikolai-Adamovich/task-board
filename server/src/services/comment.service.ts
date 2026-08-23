import type { Comment, CreateComment, UpdateComment, IdentitySnapshot } from '@task-board/shared';
import { ForbiddenError, NotFoundError } from '../errors/app-error.js';
import { CommentRepository } from '../repositories/comment.repository.js';
import type { AuditService } from './audit.service.js';

export interface CommentServiceUserRepo {
  findById(id: string): Promise<{ id: string; displayName?: string; name?: string; email: string } | null>;
}

export class CommentService {
  constructor(
    private readonly commentRepo: CommentRepository,
    private readonly userRepo: CommentServiceUserRepo,
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
  ): Promise<Comment> {
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
    projectRole?: string,
    auditContext?: { tenantId: string; projectId: string },
  ): Promise<Comment> {
    const comment = await this.commentRepo.findById(commentId);

    if (!comment) {
      throw new NotFoundError('Comment not found');
    }

    // Ownership check: author can edit own; PROJECT_ADMIN+ can edit any
    const isAuthor = comment.authorId === userId;
    const isProjectAdmin = projectRole === 'PROJECT_ADMIN';
    const isTenantAdmin = userRole === 'OWNER' || userRole === 'ADMIN';

    if (!isAuthor && !isProjectAdmin && !isTenantAdmin) {
      throw new ForbiddenError('You can only edit your own comments');
    }

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
    projectRole?: string,
    auditContext?: { tenantId: string; projectId: string },
  ): Promise<void> {
    const comment = await this.commentRepo.findById(commentId);

    if (!comment) {
      throw new NotFoundError('Comment not found');
    }

    // Ownership check: author can delete own; PROJECT_ADMIN+ can delete any
    const isAuthor = comment.authorId === userId;
    const isProjectAdmin = projectRole === 'PROJECT_ADMIN';
    const isTenantAdmin = userRole === 'OWNER' || userRole === 'ADMIN';

    if (!isAuthor && !isProjectAdmin && !isTenantAdmin) {
      throw new ForbiddenError('You can only delete your own comments');
    }

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

  private async captureIdentitySnapshot(userId: string): Promise<IdentitySnapshot> {
    const user = await this.userRepo.findById(userId);

    return {
      displayName: user?.displayName ?? user?.name ?? user?.email ?? 'Unknown User',
    };
  }
}
