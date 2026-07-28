import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ColumnService } from './column.service.js';

// ─── Mock Factories ──────────────────────────────────────────────────────────

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

describe('ColumnService', () => {
  let columnRepo: ReturnType<typeof createMockColumnRepo>;
  let service: ColumnService;

  beforeEach(() => {
    columnRepo = createMockColumnRepo();
    service = new ColumnService(columnRepo as never);
  });

  // ── listColumns ───────────────────────────────────────────────────────────

  describe('listColumns', () => {
    it('returns columns sorted by position', async () => {
      columnRepo.findByBoard.mockResolvedValue([
        makeColumn({ name: 'Backlog', position: 0 }),
        makeColumn({ id: 'col-2', name: 'To Do', position: 1 }),
        makeColumn({ id: 'col-3', name: 'Done', position: 2 }),
      ]);

      const result = await service.listColumns('tenant-1', 'board-1');

      expect(result).toHaveLength(3);
      expect(columnRepo.findByBoard).toHaveBeenCalledWith('tenant-1', 'board-1');
    });
  });

  // ── createColumn ──────────────────────────────────────────────────────────

  describe('createColumn', () => {
    it('creates a column at the specified position', async () => {
      columnRepo.create.mockResolvedValue(makeColumn({ name: 'New Col', position: 2 }));

      const result = await service.createColumn('tenant-1', 'board-1', { name: 'New Col', position: 2 }, 'admin');

      expect(columnRepo.create).toHaveBeenCalledWith('tenant-1', {
        boardId: 'board-1',
        name: 'New Col',
        position: 2,
      });
      expect(result.name).toBe('New Col');
    });

    it('appends column at the end when no position specified', async () => {
      columnRepo.findByBoard.mockResolvedValue([makeColumn(), makeColumn({ id: 'col-2' })]);
      columnRepo.create.mockResolvedValue(makeColumn({ name: 'Appended', position: 2 }));

      await service.createColumn('tenant-1', 'board-1', { name: 'Appended' }, 'admin');

      expect(columnRepo.create).toHaveBeenCalledWith('tenant-1', {
        boardId: 'board-1',
        name: 'Appended',
        position: 2,
      });
    });

    it('throws ForbiddenError when user is not admin', async () => {
      await expect(service.createColumn('tenant-1', 'board-1', { name: 'X' }, 'member')).rejects.toThrow(
        'Only owner or admin',
      );
    });
  });

  // ── updateColumn ──────────────────────────────────────────────────────────

  describe('updateColumn', () => {
    it('updates the column', async () => {
      columnRepo.update.mockResolvedValue(makeColumn({ name: 'Updated' }));

      const result = await service.updateColumn('tenant-1', 'col-1', { name: 'Updated' }, 'admin');

      expect(result.name).toBe('Updated');
    });

    it('throws NotFoundError when column not found', async () => {
      columnRepo.update.mockResolvedValue(null);

      await expect(service.updateColumn('tenant-1', 'missing', { name: 'X' }, 'admin')).rejects.toThrow('not found');
    });
  });

  // ── deleteColumn ──────────────────────────────────────────────────────────

  describe('deleteColumn', () => {
    it('deletes a non-default column', async () => {
      columnRepo.findById.mockResolvedValue(makeColumn({ isDefault: false }));
      columnRepo.delete.mockResolvedValue(true);

      await service.deleteColumn('tenant-1', 'col-1', 'admin');

      expect(columnRepo.delete).toHaveBeenCalledWith('tenant-1', 'col-1');
    });

    it('throws ForbiddenError when trying to delete a default column', async () => {
      columnRepo.findById.mockResolvedValue(makeColumn({ isDefault: true }));

      await expect(service.deleteColumn('tenant-1', 'col-1', 'admin')).rejects.toThrow(
        'Cannot delete a default column',
      );
    });

    it('throws NotFoundError when column not found', async () => {
      columnRepo.findById.mockResolvedValue(null);

      await expect(service.deleteColumn('tenant-1', 'missing', 'admin')).rejects.toThrow('not found');
    });
  });

  // ── reorderColumns ────────────────────────────────────────────────────────

  describe('reorderColumns', () => {
    it('reorders columns and returns the updated list', async () => {
      columnRepo.reorder.mockResolvedValue(undefined);
      columnRepo.findByBoard.mockResolvedValue([
        makeColumn({ id: 'col-3', name: 'Done', position: 0 }),
        makeColumn({ id: 'col-1', name: 'To Do', position: 1 }),
        makeColumn({ id: 'col-2', name: 'Review', position: 2 }),
      ]);

      const result = await service.reorderColumns('tenant-1', 'board-1', ['col-3', 'col-1', 'col-2'], 'admin');

      expect(columnRepo.reorder).toHaveBeenCalledWith('tenant-1', 'board-1', ['col-3', 'col-1', 'col-2']);
      expect(result).toHaveLength(3);
      expect(result[0]?.id).toBe('col-3');
    });

    it('throws ForbiddenError when user is not admin', async () => {
      await expect(service.reorderColumns('tenant-1', 'board-1', ['col-1'], 'member')).rejects.toThrow(
        'Only owner or admin',
      );
    });
  });
});
