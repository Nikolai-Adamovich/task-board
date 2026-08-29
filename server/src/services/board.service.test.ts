import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BoardService } from './board.service.js';
import { BoardRepository } from '../repositories/board.repository.js';
import { StatusRepository } from '../repositories/status.repository.js';
import type { Board, Status } from '@task-board/shared';

// ─── Mock Factories ──────────────────────────────────────────────────────────

function createMockBoardRepo() {
  return {
    findById: vi.fn(),
    findByProject: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    replaceStatusInColumns: vi.fn(),
  } as unknown as BoardRepository;
}

function createMockStatusRepo() {
  return {
    findById: vi.fn(),
    findByIds: vi.fn(),
    findByProject: vi.fn(),
    findByProjectAndNormalizedName: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  } as unknown as StatusRepository;
}

function makeBoard(overrides: Partial<Board> = {}): Board {
  return {
    id: 'board-1',
    projectId: 'project-1',
    name: 'Main Board',
    type: 'KANBAN',
    columns: [
      { id: 'col-1', statusIds: ['status-1'], position: 0 },
      { id: 'col-2', statusIds: ['status-2'], position: 1 },
    ],
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeStatus(overrides: Partial<Status> = {}): Status {
  return {
    id: 'status-1',
    projectId: 'project-1',
    name: 'TODO',
    normalizedName: 'todo',
    position: 0,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('BoardService', () => {
  let boardRepo: ReturnType<typeof createMockBoardRepo>;
  let statusRepo: ReturnType<typeof createMockStatusRepo>;
  let projectRepo: { findById: ReturnType<typeof vi.fn> };
  let service: BoardService;

  beforeEach(() => {
    boardRepo = createMockBoardRepo();
    statusRepo = createMockStatusRepo();
    projectRepo = { findById: vi.fn().mockResolvedValue({ id: 'project-1', tenantId: 'tenant-1' }) };
    service = new BoardService(boardRepo, statusRepo, projectRepo as never);
  });

  describe('getBoardsByProject', () => {
    it('returns all boards for a project', async () => {
      boardRepo.findByProject = vi.fn().mockResolvedValue([makeBoard()]);

      const result = await service.getBoardsByProject('project-1');

      expect(result).toHaveLength(1);
    });
  });

  describe('getBoard', () => {
    it('returns the board when found', async () => {
      boardRepo.findById = vi.fn().mockResolvedValue(makeBoard());

      const result = await service.getBoard('board-1', 'tenant-1');

      expect(result.name).toBe('Main Board');
    });

    it('throws NOT_FOUND when board does not exist', async () => {
      boardRepo.findById = vi.fn().mockResolvedValue(null);

      await expect(service.getBoard('missing', 'tenant-1')).rejects.toThrow('Board not found');
    });

    it('throws NOT_FOUND (not 403) when the board belongs to another tenant (M-02)', async () => {
      boardRepo.findById = vi.fn().mockResolvedValue(makeBoard());
      projectRepo.findById = vi.fn().mockResolvedValue({ id: 'project-1', tenantId: 'tenant-OTHER' });

      await expect(service.getBoard('board-1', 'tenant-1')).rejects.toMatchObject({
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    });
  });

  describe('createBoard', () => {
    it('creates a board with UUID columns after validating statuses', async () => {
      statusRepo.findByIds = vi.fn().mockResolvedValue([makeStatus()]);
      boardRepo.create = vi
        .fn()
        .mockImplementation((_projectId, input) =>
          Promise.resolve(makeBoard({ name: input.name, columns: input.columns })),
        );

      const result = await service.createBoard('project-1', {
        name: 'New Board',
        type: 'KANBAN',
        columns: [{ statusIds: ['status-1'], position: 0 }],
      });

      expect(result.name).toBe('New Board');
      expect(boardRepo.create).toHaveBeenCalledWith('project-1', {
        name: 'New Board',
        type: 'KANBAN',
        columns: expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            statusIds: ['status-1'],
            position: 0,
          }),
        ]),
      });
    });

    it('throws NOT_FOUND when a status does not belong to the project', async () => {
      statusRepo.findByIds = vi.fn().mockResolvedValue([]);

      await expect(
        service.createBoard('project-1', {
          name: 'Board',
          type: 'KANBAN',
          columns: [{ statusIds: ['bad-status'], position: 0 }],
        }),
      ).rejects.toThrow('not found in project');
    });

    it('M-14: validates all status ids with ONE batched findByIds call', async () => {
      statusRepo.findByIds = vi.fn().mockResolvedValue([makeStatus(), makeStatus({ id: 'status-2' })]);
      boardRepo.create = vi.fn().mockResolvedValue(makeBoard());

      await service.createBoard('project-1', {
        name: 'New Board',
        type: 'KANBAN',
        columns: [
          { statusIds: ['status-1'], position: 0 },
          { statusIds: ['status-2', 'status-1'], position: 1 },
        ],
      });

      // one batched lookup for the deduped id set — not one findById per status
      expect(statusRepo.findByIds).toHaveBeenCalledTimes(1);
      expect(statusRepo.findByIds).toHaveBeenCalledWith(['status-1', 'status-2']);
      expect(statusRepo.findById).not.toHaveBeenCalled();
    });
  });

  describe('updateBoard', () => {
    it('updates name and columns', async () => {
      boardRepo.findById = vi.fn().mockResolvedValue(makeBoard());
      statusRepo.findByIds = vi.fn().mockResolvedValue([makeStatus()]);
      boardRepo.update = vi.fn().mockResolvedValue(makeBoard({ name: 'Updated' }));

      const result = await service.updateBoard('board-1', 'tenant-1', {
        name: 'Updated',
        columns: [{ statusIds: ['status-1'], position: 0 }],
      });

      expect(result.name).toBe('Updated');
    });

    it('throws NOT_FOUND when board does not exist', async () => {
      boardRepo.findById = vi.fn().mockResolvedValue(null);

      await expect(service.updateBoard('missing', 'tenant-1', { name: 'X' })).rejects.toThrow('Board not found');
    });
  });

  describe('deleteBoard', () => {
    it('deletes the board', async () => {
      boardRepo.findById = vi.fn().mockResolvedValue(makeBoard());
      boardRepo.delete = vi.fn().mockResolvedValue(true);

      await service.deleteBoard('board-1');

      expect(boardRepo.delete).toHaveBeenCalledWith('board-1');
    });

    it('throws NOT_FOUND when board does not exist', async () => {
      boardRepo.findById = vi.fn().mockResolvedValue(null);

      await expect(service.deleteBoard('missing')).rejects.toThrow('Board not found');
    });
  });

  // ── V2-4: manage_boards enforcement ──────────────────────────────────────

  describe('manage_boards enforcement', () => {
    let projectMemberRepo: { findByUserAndProject: ReturnType<typeof vi.fn> };

    beforeEach(() => {
      projectMemberRepo = { findByUserAndProject: vi.fn().mockResolvedValue(null) };
      service = new BoardService(boardRepo, statusRepo, projectRepo as never, undefined, projectMemberRepo);
    });

    it('denies createBoard for a VIEWER', async () => {
      projectMemberRepo.findByUserAndProject.mockResolvedValue({ role: 'VIEWER' });

      await expect(
        service.createBoard(
          'project-1',
          { name: 'Board', type: 'KANBAN', columns: [{ statusIds: ['status-1'], position: 0 }] },
          'user-1',
          'VIEWER',
        ),
      ).rejects.toThrow("Insufficient permissions. Requires 'manage_boards'.");
      expect(boardRepo.create).not.toHaveBeenCalled();
    });

    it('denies updateBoard for an EDITOR (manage_boards is PROJECT_ADMIN only)', async () => {
      boardRepo.findById = vi.fn().mockResolvedValue(makeBoard());
      projectMemberRepo.findByUserAndProject.mockResolvedValue({ role: 'EDITOR' });

      await expect(service.updateBoard('board-1', 'tenant-1', { name: 'X' }, 'user-1', 'EDITOR')).rejects.toThrow(
        "Insufficient permissions. Requires 'manage_boards'.",
      );
      expect(boardRepo.update).not.toHaveBeenCalled();
    });

    it('allows createBoard for a PROJECT_ADMIN', async () => {
      statusRepo.findByIds = vi.fn().mockResolvedValue([makeStatus()]);
      boardRepo.create = vi.fn().mockResolvedValue(makeBoard({ name: 'New Board' }));
      projectMemberRepo.findByUserAndProject.mockResolvedValue({ role: 'PROJECT_ADMIN' });

      const result = await service.createBoard(
        'project-1',
        { name: 'New Board', type: 'KANBAN', columns: [{ statusIds: ['status-1'], position: 0 }] },
        'user-1',
        'PROJECT_ADMIN',
      );

      expect(result.name).toBe('New Board');
    });

    it('bypasses the project role for a tenant ADMIN', async () => {
      boardRepo.findById = vi.fn().mockResolvedValue(makeBoard());
      boardRepo.delete = vi.fn().mockResolvedValue(true);
      // no membership record at all — tenant ADMIN bypasses project-level checks
      projectMemberRepo.findByUserAndProject.mockResolvedValue(null);

      await service.deleteBoard('board-1', 'user-1', 'ADMIN');

      expect(boardRepo.delete).toHaveBeenCalledWith('board-1');
    });

    it('skips the check when no caller context is provided (legacy/test callers)', async () => {
      boardRepo.findById = vi.fn().mockResolvedValue(makeBoard());
      boardRepo.delete = vi.fn().mockResolvedValue(true);

      await service.deleteBoard('board-1');

      expect(projectMemberRepo.findByUserAndProject).not.toHaveBeenCalled();
      expect(boardRepo.delete).toHaveBeenCalledWith('board-1');
    });
  });
});
