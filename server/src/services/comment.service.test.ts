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
  let auditService: AuditService;
  let service: CommentService;

  beforeEach(() => {
    commentRepo = createMockCommentRepo();
    userRepo = createMockUserRepo();
    taskRepo = createMockTaskRepo();
    projectMemberRepo = createMockProjectMemberRepo();
    auditService = { log: vi.fn().mockResolvedValue(undefined) } as unknown as AuditService;
    service = new CommentService(commentRepo, userRepo as never, taskRepo, projectMemberRepo, auditService);
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
