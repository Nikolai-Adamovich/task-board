import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CommentService } from './comment.service.js';
import type { CommentServiceTaskRepo, CommentServiceProjectMemberRepo } from './comment.service.js';
import type { CommentRepository } from '../repositories/comment.repository.js';
import type { AuditService } from './audit.service.js';
import type { Comment } from '@task-board/shared';

// ─── Mock Factories ──────────────────────────────────────────────────────────

function createMockCommentRepo() {
  return {
    findById: vi.fn(),
    findByTask: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn().mockResolvedValue(true),
  } as unknown as CommentRepository;
}

function createMockUserRepo() {
  return {
    findById: vi.fn().mockResolvedValue({ id: 'user-1', displayName: 'Alice', email: 'alice@example.com' }),
  };
}

function createMockTaskRepo(): CommentServiceTaskRepo {
  return {
    findById: vi.fn().mockResolvedValue({ id: 'task-1', projectId: 'project-1' }),
  };
}

function createMockProjectMemberRepo(): CommentServiceProjectMemberRepo {
  return {
    findByUserAndProject: vi.fn().mockResolvedValue(null),
  };
}

function makeComment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: 'comment-1',
    taskId: 'task-1',
    authorId: 'user-2',
    authorSnapshot: { displayName: 'Bob' },
    body: 'Hello',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  } as Comment;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('CommentService (DEC-020 ownership/moderation)', () => {
  let commentRepo: ReturnType<typeof createMockCommentRepo>;
  let userRepo: ReturnType<typeof createMockUserRepo>;
  let taskRepo: CommentServiceTaskRepo;
  let projectMemberRepo: CommentServiceProjectMemberRepo;
  let projectRepo: { findById: ReturnType<typeof vi.fn> };
  let auditService: AuditService;
  let service: CommentService;

  beforeEach(() => {
    commentRepo = createMockCommentRepo();
    userRepo = createMockUserRepo();
    taskRepo = createMockTaskRepo();
    projectMemberRepo = createMockProjectMemberRepo();
    projectRepo = { findById: vi.fn().mockResolvedValue({ id: 'project-1', tenantId: 'tenant-1' }) };
    auditService = { log: vi.fn().mockResolvedValue(undefined) } as unknown as AuditService;
    service = new CommentService(
      commentRepo,
      userRepo as never,
      taskRepo,
      projectMemberRepo,
      auditService,
      projectRepo as never,
    );
  });

  describe('getCommentsByTask (M-02)', () => {
    it('returns comments for a task within the caller tenant', async () => {
      commentRepo.findByTask = vi.fn().mockResolvedValue([makeComment()]);

      const result = await service.getCommentsByTask('task-1', 'tenant-1');

      expect(result).toHaveLength(1);
    });

    it('throws NOT_FOUND when the task does not exist', async () => {
      taskRepo.findById = vi.fn().mockResolvedValue(null);

      await expect(service.getCommentsByTask('missing', 'tenant-1')).rejects.toMatchObject({
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    });

    it('throws NOT_FOUND (not 403) when the task belongs to another tenant (M-02)', async () => {
      projectRepo.findById = vi.fn().mockResolvedValue({ id: 'project-1', tenantId: 'tenant-OTHER' });

      await expect(service.getCommentsByTask('task-1', 'tenant-1')).rejects.toMatchObject({
        statusCode: 404,
        code: 'NOT_FOUND',
      });
      expect(commentRepo.findByTask).not.toHaveBeenCalled();
    });
  });

  describe('resolveTask / resolveTaskForComment (M-06)', () => {
    it('resolves a task by id for the create-route audit context', async () => {
      const task = await service.resolveTask('task-1');

      expect(task).toEqual({ id: 'task-1', projectId: 'project-1' });
    });

    it('resolves the owning task of a comment for update/delete audit contexts', async () => {
      commentRepo.findById = vi.fn().mockResolvedValue(makeComment());

      const task = await service.resolveTaskForComment('comment-1');

      expect(task).toEqual({ id: 'task-1', projectId: 'project-1' });
    });

    it('throws NOT_FOUND when the comment does not exist', async () => {
      commentRepo.findById = vi.fn().mockResolvedValue(null);

      await expect(service.resolveTaskForComment('missing')).rejects.toMatchObject({
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    });
  });

  describe('updateComment', () => {
    it('allows an EDITOR to edit their own comment', async () => {
      commentRepo.findById = vi.fn().mockResolvedValue(makeComment({ authorId: 'user-1' }));
      commentRepo.update = vi.fn().mockResolvedValue(makeComment({ authorId: 'user-1', body: 'Edited' }));
      projectMemberRepo.findByUserAndProject = vi.fn().mockResolvedValue({ role: 'EDITOR' });

      const result = await service.updateComment('comment-1', 'user-1', 'MEMBER', { body: 'Edited' });

      expect(result.body).toBe('Edited');
    });

    it('denies an EDITOR editing someone else’s comment', async () => {
      commentRepo.findById = vi.fn().mockResolvedValue(makeComment({ authorId: 'user-2' }));
      projectMemberRepo.findByUserAndProject = vi.fn().mockResolvedValue({ role: 'EDITOR' });

      await expect(service.updateComment('comment-1', 'user-1', 'MEMBER', { body: 'Hacked' })).rejects.toThrow(
        'You can only edit your own comments',
      );
      expect(commentRepo.update).not.toHaveBeenCalled();
    });

    it('allows a PROJECT_ADMIN to moderate any comment in project scope', async () => {
      commentRepo.findById = vi.fn().mockResolvedValue(makeComment({ authorId: 'user-2' }));
      commentRepo.update = vi.fn().mockResolvedValue(makeComment({ body: 'Moderated' }));
      projectMemberRepo.findByUserAndProject = vi.fn().mockResolvedValue({ role: 'PROJECT_ADMIN' });

      const result = await service.updateComment('comment-1', 'user-1', 'MEMBER', { body: 'Moderated' });

      expect(result.body).toBe('Moderated');
    });

    it('allows a tenant OWNER to moderate any comment (bypass)', async () => {
      commentRepo.findById = vi.fn().mockResolvedValue(makeComment({ authorId: 'user-2' }));
      commentRepo.update = vi.fn().mockResolvedValue(makeComment({ body: 'Moderated' }));

      const result = await service.updateComment('comment-1', 'user-1', 'OWNER', { body: 'Moderated' });

      expect(result.body).toBe('Moderated');
    });

    it('denies a VIEWER even for their own comment (no base permission)', async () => {
      commentRepo.findById = vi.fn().mockResolvedValue(makeComment({ authorId: 'user-1' }));
      projectMemberRepo.findByUserAndProject = vi.fn().mockResolvedValue({ role: 'VIEWER' });

      await expect(service.updateComment('comment-1', 'user-1', 'MEMBER', { body: 'Edited' })).rejects.toThrow(
        "Insufficient permissions. Requires 'edit_comment'",
      );
    });
  });

  describe('deleteComment', () => {
    it('allows an EDITOR to delete their own comment', async () => {
      commentRepo.findById = vi.fn().mockResolvedValue(makeComment({ authorId: 'user-1' }));
      projectMemberRepo.findByUserAndProject = vi.fn().mockResolvedValue({ role: 'EDITOR' });

      await service.deleteComment('comment-1', 'user-1', 'MEMBER');

      expect(commentRepo.delete).toHaveBeenCalledWith('comment-1');
    });

    it('denies an EDITOR deleting someone else’s comment', async () => {
      commentRepo.findById = vi.fn().mockResolvedValue(makeComment({ authorId: 'user-2' }));
      projectMemberRepo.findByUserAndProject = vi.fn().mockResolvedValue({ role: 'EDITOR' });

      await expect(service.deleteComment('comment-1', 'user-1', 'MEMBER')).rejects.toThrow(
        'You can only delete your own comments',
      );
      expect(commentRepo.delete).not.toHaveBeenCalled();
    });

    it('allows a PROJECT_ADMIN to delete any comment in project scope', async () => {
      commentRepo.findById = vi.fn().mockResolvedValue(makeComment({ authorId: 'user-2' }));
      projectMemberRepo.findByUserAndProject = vi.fn().mockResolvedValue({ role: 'PROJECT_ADMIN' });

      await service.deleteComment('comment-1', 'user-1', 'MEMBER');

      expect(commentRepo.delete).toHaveBeenCalledWith('comment-1');
    });

    it('throws NotFoundError when the comment does not exist', async () => {
      commentRepo.findById = vi.fn().mockResolvedValue(null);

      await expect(service.deleteComment('missing', 'user-1', 'OWNER')).rejects.toThrow('Comment not found');
    });
  });
});
