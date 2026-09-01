import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BoardRepository } from './board.repository.js';
import type { BoardDocument } from './board.repository.js';
import type { Collection, InsertOneResult } from 'mongodb';

// ─── Mock Collection Helper ──────────────────────────────────────────────────

function createMockCollection() {
  return {
    findOne: vi.fn(),
    find: vi.fn(),
    insertOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
    deleteOne: vi.fn(),
    deleteMany: vi.fn(),
    updateMany: vi.fn(),
  } as unknown as Collection<BoardDocument> & {
    findOne: ReturnType<typeof vi.fn>;
    find: ReturnType<typeof vi.fn>;
    insertOne: ReturnType<typeof vi.fn>;
    findOneAndUpdate: ReturnType<typeof vi.fn>;
    deleteOne: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
}

function makeDoc(overrides: Partial<BoardDocument> = {}): BoardDocument {
  return {
    projectId: 'project-1',
    columns: [
      { id: 'col-1', statusIds: ['status-1', 'status-2'], position: 0 },
      { id: 'col-2', statusIds: ['status-3'], position: 1 },
    ],
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('BoardRepository (single-board model)', () => {
  let collection: ReturnType<typeof createMockCollection>;
  let repo: BoardRepository;

  beforeEach(() => {
    collection = createMockCollection();
    repo = new BoardRepository(collection);
  });

  describe('findByProject', () => {
    it('returns the mapped board when found', async () => {
      collection.findOne.mockResolvedValue(makeDoc());

      const result = await repo.findByProject('project-1');

      expect(collection.findOne).toHaveBeenCalledWith({ projectId: 'project-1' });
      expect(result).toEqual({
        projectId: 'project-1',
        columns: [
          { id: 'col-1', statusIds: ['status-1', 'status-2'], position: 0 },
          { id: 'col-2', statusIds: ['status-3'], position: 1 },
        ],
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      });
    });

    it('returns null when the project has no board', async () => {
      collection.findOne.mockResolvedValue(null);

      const result = await repo.findByProject('missing');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('inserts a projectId-keyed document with generated column ids', async () => {
      collection.insertOne.mockResolvedValue({ acknowledged: true } as InsertOneResult);

      const result = await repo.create('project-1', [
        { statusIds: ['s1'], position: 0 },
        { statusIds: ['s2'], position: 1 },
      ]);

      expect(collection.insertOne).toHaveBeenCalledTimes(1);
      expect(collection.insertOne).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: 'project-1', columns: expect.any(Array) }),
      );
      expect(result.projectId).toBe('project-1');
      expect(result.columns).toHaveLength(2);
      expect(result.columns[0]?.id).toEqual(expect.any(String));
    });
  });

  describe('updateColumns', () => {
    it('returns the updated board', async () => {
      const updated = makeDoc({ columns: [{ id: 'col-9', statusIds: ['s1'], position: 0 }] });

      collection.findOneAndUpdate.mockResolvedValue(updated);

      const result = await repo.updateColumns('project-1', [{ id: 'col-9', statusIds: ['s1'], position: 0 }]);

      expect(collection.findOneAndUpdate).toHaveBeenCalledWith(
        { projectId: 'project-1' },
        expect.objectContaining({ $set: expect.objectContaining({ columns: expect.any(Array) }) }),
        expect.objectContaining({ returnDocument: 'after' }),
      );
      expect(result?.columns[0]?.id).toBe('col-9');
    });

    it('generates column ids when the payload omits them', async () => {
      collection.findOneAndUpdate.mockResolvedValue(makeDoc());

      await repo.updateColumns('project-1', [{ statusIds: ['s1'], position: 0 }]);

      const call = collection.findOneAndUpdate.mock.calls[0]?.[1] as { $set: { columns: { id: string }[] } };

      expect(call.$set.columns[0]?.id).toEqual(expect.any(String));
    });

    it('returns null when no board exists', async () => {
      collection.findOneAndUpdate.mockResolvedValue(null);

      const result = await repo.updateColumns('missing', [{ statusIds: ['s1'], position: 0 }]);

      expect(result).toBeNull();
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

  describe('deleteByProject', () => {
    it('deletes all boards of the project (cascade)', async () => {
      collection.deleteMany.mockResolvedValue({ deletedCount: 1 } as never);

      await repo.deleteByProject('project-1');

      expect(collection.deleteMany).toHaveBeenCalledWith({ projectId: 'project-1' });
    });
  });
});
