import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ColumnRepository } from './column.repository.js';
import type { ColumnDocument } from './column.repository.js';
import type { Collection, InsertOneResult, DeleteResult } from 'mongodb';

// ─── Mock Collection Helper ──────────────────────────────────────────────────

function createMockCollection() {
  return {
    findOne: vi.fn(),
    find: vi.fn(),
    insertOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
    deleteOne: vi.fn(),
    bulkWrite: vi.fn(),
  } as unknown as Collection<ColumnDocument> & {
    findOne: ReturnType<typeof vi.fn>;
    find: ReturnType<typeof vi.fn>;
    insertOne: ReturnType<typeof vi.fn>;
    findOneAndUpdate: ReturnType<typeof vi.fn>;
    deleteOne: ReturnType<typeof vi.fn>;
    bulkWrite: ReturnType<typeof vi.fn>;
  };
}

function makeDoc(overrides: Partial<ColumnDocument> = {}): ColumnDocument {
  return {
    id: 'col-123',
    boardId: 'board-1',
    tenantId: 'tenant-1',
    name: 'To Do',
    position: 0,
    isDefault: true,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('ColumnRepository', () => {
  let collection: ReturnType<typeof createMockCollection>;
  let repo: ColumnRepository;

  beforeEach(() => {
    collection = createMockCollection();
    repo = new ColumnRepository(collection);
  });

  describe('findById', () => {
    it('returns a mapped column when found', async () => {
      collection.findOne.mockResolvedValue(makeDoc());

      const result = await repo.findById('tenant-1', 'col-123');

      expect(collection.findOne).toHaveBeenCalledWith({ id: 'col-123', tenantId: 'tenant-1' });
      expect(result).toEqual({
        id: 'col-123',
        boardId: 'board-1',
        tenantId: 'tenant-1',
        name: 'To Do',
        position: 0,
        isDefault: true,
        createdAt: '2025-01-01T00:00:00.000Z',
      });
    });

    it('returns null when not found', async () => {
      collection.findOne.mockResolvedValue(null);

      const result = await repo.findById('tenant-1', 'missing');

      expect(result).toBeNull();
    });
  });

  describe('findByBoard', () => {
    it('returns columns sorted by position', async () => {
      const toArray = vi
        .fn()
        .mockResolvedValue([
          makeDoc({ id: 'col-1', position: 0 }),
          makeDoc({ id: 'col-2', position: 1, name: 'In Progress', isDefault: false }),
        ]);
      const sortFn = vi.fn().mockReturnValue({ toArray });

      collection.find.mockReturnValue({ sort: sortFn });

      const result = await repo.findByBoard('tenant-1', 'board-1');

      expect(collection.find).toHaveBeenCalledWith({ tenantId: 'tenant-1', boardId: 'board-1' });
      expect(sortFn).toHaveBeenCalledWith({ position: 1 });
      expect(result).toHaveLength(2);
      expect(result[0]?.position).toBe(0);
      expect(result[1]?.position).toBe(1);
    });
  });

  describe('create', () => {
    it('inserts a document and returns the domain column', async () => {
      collection.insertOne.mockResolvedValue({ acknowledged: true } as InsertOneResult);

      const result = await repo.create('tenant-1', {
        boardId: 'board-1',
        name: 'New Column',
        position: 2,
      });

      expect(collection.insertOne).toHaveBeenCalledTimes(1);

      const insertedDoc = collection.insertOne.mock.calls[0]?.[0] as ColumnDocument;

      expect(insertedDoc.name).toBe('New Column');
      expect(insertedDoc.position).toBe(2);
      expect(insertedDoc.isDefault).toBe(false);
      expect(insertedDoc.id).toBeDefined();

      expect(result.name).toBe('New Column');
      expect(typeof result.createdAt).toBe('string');
    });

    it('sets isDefault to true when provided', async () => {
      collection.insertOne.mockResolvedValue({ acknowledged: true } as InsertOneResult);

      const result = await repo.create('tenant-1', {
        boardId: 'board-1',
        name: 'Default',
        position: 0,
        isDefault: true,
      });

      expect(result.isDefault).toBe(true);
    });
  });

  describe('update', () => {
    it('returns the updated column', async () => {
      const updated = makeDoc({ name: 'Updated' });

      collection.findOneAndUpdate.mockResolvedValue(updated);

      const result = await repo.update('tenant-1', 'col-123', { name: 'Updated' });

      expect(collection.findOneAndUpdate).toHaveBeenCalledWith(
        { id: 'col-123', tenantId: 'tenant-1' },
        { $set: { name: 'Updated' } },
        { returnDocument: 'after' },
      );
      expect(result?.name).toBe('Updated');
    });

    it('returns null when column not found', async () => {
      collection.findOneAndUpdate.mockResolvedValue(null);

      const result = await repo.update('tenant-1', 'missing', { name: 'X' });

      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('returns true when a document was deleted', async () => {
      collection.deleteOne.mockResolvedValue({ deletedCount: 1 } as DeleteResult);

      const result = await repo.delete('tenant-1', 'col-123');

      expect(result).toBe(true);
    });

    it('returns false when no document was deleted', async () => {
      collection.deleteOne.mockResolvedValue({ deletedCount: 0 } as DeleteResult);

      const result = await repo.delete('tenant-1', 'missing');

      expect(result).toBe(false);
    });
  });

  describe('reorder', () => {
    it('generates bulkWrite operations for reordering', async () => {
      collection.bulkWrite.mockResolvedValue({});

      await repo.reorder('tenant-1', 'board-1', ['col-2', 'col-1', 'col-3']);

      expect(collection.bulkWrite).toHaveBeenCalledWith([
        {
          updateOne: {
            filter: { id: 'col-2', boardId: 'board-1', tenantId: 'tenant-1' },
            update: { $set: { position: 0 } },
          },
        },
        {
          updateOne: {
            filter: { id: 'col-1', boardId: 'board-1', tenantId: 'tenant-1' },
            update: { $set: { position: 1 } },
          },
        },
        {
          updateOne: {
            filter: { id: 'col-3', boardId: 'board-1', tenantId: 'tenant-1' },
            update: { $set: { position: 2 } },
          },
        },
      ]);
    });
  });
});
