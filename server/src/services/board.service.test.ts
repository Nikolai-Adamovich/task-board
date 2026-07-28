import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BoardService } from './board.service.js';

// ─── Mock Factories ──────────────────────────────────────────────────────────

function createMockBoardRepo() {
  return {
    findById: vi.fn(),
    findByProject: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
}

function createMockColumnRepo() {
  return {
    findById: vi.fn(),
    findByBoard: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    reorder: vi.fn(),
  };
}

const NOW = '2025-01-01T00:00:00.000Z';

function makeBoard(overrides: Record<string, unknown> = {}) {
  return {
    id: 'board-1',
    tenantId: 'tenant-1',
    projectId: 'proj-1',
    name: 'Test Board',
    description: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeColumn(overrides: Record<string, unknown> = {}) {
  return {
    id: 'col-1',
    boardId: 'board-1',
    tenantId: 'tenant-1',
    name: 'To Do',
    position: 0,
    isDefault: true,
    createdAt: NOW,
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('BoardService', () => {
  let boardRepo: ReturnType<typeof createMockBoardRepo>;
  let columnRepo: ReturnType<typeof createMockColumnRepo>;
  let service: BoardService;

  beforeEach(() => {
    boardRepo = createMockBoardRepo();
    columnRepo = createMockColumnRepo();
    service = new BoardService(boardRepo as never, columnRepo as never);
  });

  // ── listBoards ────────────────────────────────────────────────────────────

  describe('listBoards', () => {
    it('returns all boards for a project', async () => {
      boardRepo.findByProject.mockResolvedValue([makeBoard(), makeBoard({ id: 'board-2' })]);

      const result = await service.listBoards('tenant-1', 'proj-1');

      expect(result).toHaveLength(2);
      expect(boardRepo.findByProject).toHaveBeenCalledWith('tenant-1', 'proj-1');
    });
  });

  // ── createBoard ───────────────────────────────────────────────────────────

  describe('createBoard', () => {
    it('creates a board with default columns', async () => {
      boardRepo.create.mockResolvedValue(makeBoard());
      columnRepo.create
        .mockResolvedValueOnce(makeColumn({ name: 'Backlog', position: 0 }))
        .mockResolvedValueOnce(makeColumn({ name: 'To Do', position: 1 }))
        .mockResolvedValueOnce(makeColumn({ name: 'In Progress', position: 2 }))
        .mockResolvedValueOnce(makeColumn({ name: 'Review', position: 3 }))
        .mockResolvedValueOnce(makeColumn({ name: 'Done', position: 4 }));

      const result = await service.createBoard('tenant-1', { projectId: 'proj-1', name: 'Test Board' }, 'admin');

      expect(result.board.name).toBe('Test Board');
      expect(result.columns).toHaveLength(5);
      expect(columnRepo.create).toHaveBeenCalledTimes(5);
      // First column call
      expect(columnRepo.create).toHaveBeenNthCalledWith(1, 'tenant-1', {
        boardId: 'board-1',
        name: 'Backlog',
        position: 0,
        isDefault: true,
      });
    });

    it('creates a board with custom column names', async () => {
      boardRepo.create.mockResolvedValue(makeBoard());
      columnRepo.create
        .mockResolvedValueOnce(makeColumn({ name: 'Ideas', position: 0 }))
        .mockResolvedValueOnce(makeColumn({ name: 'Done', position: 1 }));

      const result = await service.createBoard(
        'tenant-1',
        { projectId: 'proj-1', name: 'Custom Board', columnNames: ['Ideas', 'Done'] },
        'admin',
      );

      expect(result.columns).toHaveLength(2);
      expect(columnRepo.create).toHaveBeenNthCalledWith(1, 'tenant-1', {
        boardId: 'board-1',
        name: 'Ideas',
        position: 0,
        isDefault: false,
      });
    });

    it('throws ForbiddenError when user is not admin', async () => {
      await expect(service.createBoard('tenant-1', { projectId: 'proj-1', name: 'X' }, 'member')).rejects.toThrow(
        'Only owner or admin',
      );
    });
  });

  // ── getBoard ──────────────────────────────────────────────────────────────

  describe('getBoard', () => {
    it('returns board with columns', async () => {
      boardRepo.findById.mockResolvedValue(makeBoard());
      columnRepo.findByBoard.mockResolvedValue([makeColumn(), makeColumn({ id: 'col-2', name: 'Done', position: 1 })]);

      const result = await service.getBoard('tenant-1', 'board-1');

      expect(result.board.id).toBe('board-1');
      expect(result.columns).toHaveLength(2);
    });

    it('throws NotFoundError when board does not exist', async () => {
      boardRepo.findById.mockResolvedValue(null);

      await expect(service.getBoard('tenant-1', 'missing')).rejects.toThrow('not found');
    });
  });

  // ── updateBoard ───────────────────────────────────────────────────────────

  describe('updateBoard', () => {
    it('updates the board', async () => {
      boardRepo.update.mockResolvedValue(makeBoard({ name: 'Updated' }));

      const result = await service.updateBoard('tenant-1', 'board-1', { name: 'Updated' }, 'admin');

      expect(result.name).toBe('Updated');
    });

    it('throws NotFoundError when board not found', async () => {
      boardRepo.update.mockResolvedValue(null);

      await expect(service.updateBoard('tenant-1', 'missing', { name: 'X' }, 'admin')).rejects.toThrow('not found');
    });
  });

  // ── deleteBoard ───────────────────────────────────────────────────────────

  describe('deleteBoard', () => {
    it('deletes the board and its columns', async () => {
      columnRepo.findByBoard.mockResolvedValue([makeColumn(), makeColumn({ id: 'col-2' })]);
      columnRepo.delete.mockResolvedValue(true);
      boardRepo.delete.mockResolvedValue(true);

      await service.deleteBoard('tenant-1', 'board-1', 'admin');

      expect(columnRepo.delete).toHaveBeenCalledTimes(2);
      expect(boardRepo.delete).toHaveBeenCalledWith('tenant-1', 'board-1');
    });

    it('throws NotFoundError when board not found', async () => {
      columnRepo.findByBoard.mockResolvedValue([]);
      boardRepo.delete.mockResolvedValue(false);

      await expect(service.deleteBoard('tenant-1', 'missing', 'admin')).rejects.toThrow('not found');
    });
  });
});
