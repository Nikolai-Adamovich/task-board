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
  } as unknown as Collection<BoardDocument> & {
    findOne: ReturnType<typeof vi.fn>;
    find: ReturnType<typeof vi.fn>;
    insertOne: ReturnType<typeof vi.fn>;
    findOneAndUpdate: ReturnType<typeof vi.fn>;
    deleteOne: ReturnType<typeof vi.fn>;
  };
}

function makeDoc(overrides: Partial<BoardDocument> = {}): BoardDocument {
  return {
    id: 'board-123',
    tenantId: 'tenant-1',
    projectId: 'project-1',
    name: 'Test Board',
    description: 'A test board',
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

      const result = await repo.findById('tenant-1', 'board-123');

      expect(collection.findOne).toHaveBeenCalledWith({ id: 'board-123', tenantId: 'tenant-1' });
      expect(result).toEqual({
        id: 'board-123',
        tenantId: 'tenant-1',
        projectId: 'project-1',
        name: 'Test Board',
        description: 'A test board',
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      });
    });

    it('returns null when not found', async () => {
      collection.findOne.mockResolvedValue(null);

      const result = await repo.findById('tenant-1', 'missing');

      expect(result).toBeNull();
    });
  });

  describe('findByProject', () => {
    it('returns boards for a project', async () => {
      const toArray = vi
        .fn()
        .mockResolvedValue([makeDoc({ id: 'board-1', name: 'Board 1' }), makeDoc({ id: 'board-2', name: 'Board 2' })]);

      collection.find.mockReturnValue({ toArray });

      const result = await repo.findByProject('tenant-1', 'project-1');

      expect(collection.find).toHaveBeenCalledWith({ tenantId: 'tenant-1', projectId: 'project-1' });
      expect(result).toHaveLength(2);
      expect(result[0]?.name).toBe('Board 1');
      expect(result[1]?.name).toBe('Board 2');
    });
  });

  describe('create', () => {
    it('inserts a document and returns the domain board', async () => {
      collection.insertOne.mockResolvedValue({ acknowledged: true } as InsertOneResult);

      const result = await repo.create('tenant-1', {
        projectId: 'project-1',
        name: 'New Board',
        description: 'desc',
      });

      expect(collection.insertOne).toHaveBeenCalledTimes(1);

      const insertedDoc = collection.insertOne.mock.calls[0]?.[0] as BoardDocument;

      expect(insertedDoc.name).toBe('New Board');
      expect(insertedDoc.tenantId).toBe('tenant-1');
      expect(insertedDoc.projectId).toBe('project-1');
      expect(insertedDoc.id).toBeDefined();

      expect(result.name).toBe('New Board');
      expect(typeof result.createdAt).toBe('string');
    });

    it('defaults description to null when omitted', async () => {
      collection.insertOne.mockResolvedValue({ acknowledged: true } as InsertOneResult);

      await repo.create('tenant-1', { projectId: 'project-1', name: 'Board' });

      const insertedDoc = collection.insertOne.mock.calls[0]?.[0] as BoardDocument;

      expect(insertedDoc.description).toBeNull();
    });
  });

  describe('update', () => {
    it('returns the updated board', async () => {
      const updated = makeDoc({ name: 'Updated Board' });

      collection.findOneAndUpdate.mockResolvedValue(updated);

      const result = await repo.update('tenant-1', 'board-123', { name: 'Updated Board' });

      expect(collection.findOneAndUpdate).toHaveBeenCalledWith(
        { id: 'board-123', tenantId: 'tenant-1' },
        { $set: { name: 'Updated Board', updatedAt: expect.any(Date) } },
        { returnDocument: 'after' },
      );
      expect(result?.name).toBe('Updated Board');
    });

    it('returns null when board not found', async () => {
      collection.findOneAndUpdate.mockResolvedValue(null);

      const result = await repo.update('tenant-1', 'missing', { name: 'X' });

      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('returns true when a document was deleted', async () => {
      collection.deleteOne.mockResolvedValue({ deletedCount: 1 } as DeleteResult);

      const result = await repo.delete('tenant-1', 'board-123');

      expect(result).toBe(true);
    });

    it('returns false when no document was deleted', async () => {
      collection.deleteOne.mockResolvedValue({ deletedCount: 0 } as DeleteResult);

      const result = await repo.delete('tenant-1', 'missing');

      expect(result).toBe(false);
    });
  });
});
