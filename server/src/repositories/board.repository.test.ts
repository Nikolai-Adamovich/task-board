import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BoardRepository } from './board.repository.js';
import type { BoardDocument } from './board.repository.js';
import type { Collection, InsertOneResult, DeleteResult } from 'mongodb';

// ─── Mock Collection Helper ──────────────────────────────────────────────────

function createMockCollection() {
  return {
    findOne: vi.fn(),
    find: vi.fn(),
    insertOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
    deleteOne: vi.fn(),
    updateMany: vi.fn(),
  } as unknown as Collection<BoardDocument> & {
    findOne: ReturnType<typeof vi.fn>;
    find: ReturnType<typeof vi.fn>;
    insertOne: ReturnType<typeof vi.fn>;
    findOneAndUpdate: ReturnType<typeof vi.fn>;
    deleteOne: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
}

function makeDoc(overrides: Partial<BoardDocument> = {}): BoardDocument {
  return {
    id: 'board-123',
    projectId: 'project-1',
    name: 'Main Board',
    type: 'KANBAN',
    columns: [
      { id: 'col-1', statusIds: ['status-1', 'status-2'], position: 0 },
      { id: 'col-2', statusIds: ['status-3'], position: 1 },
    ],
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('BoardRepository', () => {
  let collection: ReturnType<typeof createMockCollection>;
  let repo: BoardRepository;

  beforeEach(() => {
    collection = createMockCollection();
    repo = new BoardRepository(collection);
  });

  describe('findById', () => {
    it('returns a mapped board when found', async () => {
      collection.findOne.mockResolvedValue(makeDoc());

      const result = await repo.findById('board-123');

      expect(collection.findOne).toHaveBeenCalledWith({ id: 'board-123' });
      expect(result).toEqual({
        id: 'board-123',
        projectId: 'project-1',
        name: 'Main Board',
        type: 'KANBAN',
        columns: [
          { id: 'col-1', statusIds: ['status-1', 'status-2'], position: 0 },
          { id: 'col-2', statusIds: ['status-3'], position: 1 },
        ],
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      });
    });

    it('returns null when not found', async () => {
      collection.findOne.mockResolvedValue(null);

      const result = await repo.findById('missing');

      expect(result).toBeNull();
    });
  });

  describe('findByProject', () => {
    it('returns all boards for a project', async () => {
      const toArray = vi.fn().mockResolvedValue([makeDoc({ id: 'b1' }), makeDoc({ id: 'b2' })]);

      collection.find.mockReturnValue({ toArray });

      const result = await repo.findByProject('project-1');

      expect(collection.find).toHaveBeenCalledWith({ projectId: 'project-1' });
      expect(result).toHaveLength(2);
    });
  });

  describe('create', () => {
    it('inserts a document with embedded columns and returns domain board', async () => {
      collection.insertOne.mockResolvedValue({ acknowledged: true } as InsertOneResult);

      const result = await repo.create('project-1', {
        name: 'New Board',
        type: 'KANBAN',
        columns: [
          { id: 'col-1', statusIds: ['s1'], position: 0 },
          { id: 'col-2', statusIds: ['s2'], position: 1 },
        ],
      });

      expect(collection.insertOne).toHaveBeenCalledTimes(1);
      expect(result.name).toBe('New Board');
      expect(result.type).toBe('KANBAN');
      expect(result.columns).toHaveLength(2);
      expect(result.columns[0].id).toBe('col-1');
    });
  });

  describe('update', () => {
    it('returns the updated board', async () => {
      const updated = makeDoc({ name: 'Updated' });

      collection.findOneAndUpdate.mockResolvedValue(updated);

      const result = await repo.update('board-123', { name: 'Updated' });

      expect(result?.name).toBe('Updated');
    });
  });

  describe('delete', () => {
    it('returns true when deleted', async () => {
      collection.deleteOne.mockResolvedValue({ deletedCount: 1 } as DeleteResult);

      const result = await repo.delete('board-123');

      expect(result).toBe(true);
    });
  });

  describe('replaceStatusInColumns', () => {
    it('calls updateMany with arrayFilters', async () => {
      collection.updateMany.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 } as never);

      await repo.replaceStatusInColumns('project-1', 'old-status', 'new-status');

      expect(collection.updateMany).toHaveBeenCalledWith(
        { projectId: 'project-1', 'columns.statusIds': 'old-status' },
        {
          $set: {
            'columns.$[col].statusIds.$[sid]': 'new-status',
            updatedAt: expect.any(Date),
          },
        },
        { arrayFilters: [{ 'col.statusIds': 'old-status' }, { sid: 'old-status' }] },
      );
    });
  });
});
