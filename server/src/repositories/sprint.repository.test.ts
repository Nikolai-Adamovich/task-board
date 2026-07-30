import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SprintRepository } from './sprint.repository.js';
import type { SprintDocument } from './sprint.repository.js';
import type { Collection, InsertOneResult, DeleteResult } from 'mongodb';

// ─── Mock Collection Helper ──────────────────────────────────────────────────

function createMockCollection() {
  return {
    findOne: vi.fn(),
    find: vi.fn(),
    insertOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
    deleteOne: vi.fn(),
  } as unknown as Collection<SprintDocument> & {
    findOne: ReturnType<typeof vi.fn>;
    find: ReturnType<typeof vi.fn>;
    insertOne: ReturnType<typeof vi.fn>;
    findOneAndUpdate: ReturnType<typeof vi.fn>;
    deleteOne: ReturnType<typeof vi.fn>;
  };
}

function makeDoc(overrides: Partial<SprintDocument> = {}): SprintDocument {
  return {
    id: 'sprint-123',
    tenantId: 'tenant-1',
    projectId: 'project-1',
    name: 'Sprint 1',
    startDate: new Date('2025-01-01T00:00:00Z'),
    endDate: new Date('2025-01-15T00:00:00Z'),
    goal: 'Complete MVP',
    status: 'planned',
    taskIds: [],
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('SprintRepository', () => {
  let collection: ReturnType<typeof createMockCollection>;
  let repo: SprintRepository;

  beforeEach(() => {
    collection = createMockCollection();
    repo = new SprintRepository(collection);
  });

  describe('findById', () => {
    it('returns a mapped sprint when found', async () => {
      collection.findOne.mockResolvedValue(makeDoc());

      const result = await repo.findById('tenant-1', 'sprint-123');

      expect(collection.findOne).toHaveBeenCalledWith({ id: 'sprint-123', tenantId: 'tenant-1' });
      expect(result).toEqual({
        id: 'sprint-123',
        tenantId: 'tenant-1',
        projectId: 'project-1',
        name: 'Sprint 1',
        startDate: '2025-01-01T00:00:00.000Z',
        endDate: '2025-01-15T00:00:00.000Z',
        goal: 'Complete MVP',
        status: 'planned',
        taskIds: [],
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
    it('returns sprints sorted by startDate desc', async () => {
      const toArray = vi
        .fn()
        .mockResolvedValue([makeDoc({ id: 's2', name: 'Sprint 2' }), makeDoc({ id: 's1', name: 'Sprint 1' })]);
      const sortFn = vi.fn().mockReturnValue({ toArray });

      collection.find.mockReturnValue({ sort: sortFn });

      const result = await repo.findByProject('tenant-1', 'project-1');

      expect(collection.find).toHaveBeenCalledWith({ tenantId: 'tenant-1', projectId: 'project-1' });
      expect(sortFn).toHaveBeenCalledWith({ startDate: -1 });
      expect(result).toHaveLength(2);
    });
  });

  describe('findByTenant', () => {
    it('returns all sprints for a tenant sorted by startDate desc', async () => {
      const toArray = vi.fn().mockResolvedValue([makeDoc()]);
      const sortFn = vi.fn().mockReturnValue({ toArray });

      collection.find.mockReturnValue({ sort: sortFn });

      const result = await repo.findByTenant('tenant-1');

      expect(collection.find).toHaveBeenCalledWith({ tenantId: 'tenant-1' });
      expect(result).toHaveLength(1);
    });
  });

  describe('create', () => {
    it('inserts a document and returns the domain sprint', async () => {
      collection.insertOne.mockResolvedValue({ acknowledged: true } as InsertOneResult);

      const result = await repo.create('tenant-1', {
        projectId: 'project-1',
        name: 'New Sprint',
        startDate: '2025-02-01T00:00:00Z',
        endDate: '2025-02-15T00:00:00Z',
        goal: 'Ship feature',
      });

      expect(collection.insertOne).toHaveBeenCalledTimes(1);

      const insertedDoc = collection.insertOne.mock.calls[0]?.[0] as SprintDocument;

      expect(insertedDoc.name).toBe('New Sprint');
      expect(insertedDoc.status).toBe('planned');
      expect(insertedDoc.taskIds).toEqual([]);
      expect(insertedDoc.id).toBeDefined();

      expect(result.name).toBe('New Sprint');
      expect(typeof result.createdAt).toBe('string');
    });

    it('defaults goal to null when omitted', async () => {
      collection.insertOne.mockResolvedValue({ acknowledged: true } as InsertOneResult);

      await repo.create('tenant-1', {
        projectId: 'project-1',
        name: 'Sprint',
        startDate: '2025-02-01T00:00:00Z',
        endDate: '2025-02-15T00:00:00Z',
      });

      const insertedDoc = collection.insertOne.mock.calls[0]?.[0] as SprintDocument;

      expect(insertedDoc.goal).toBeNull();
    });
  });

  describe('update', () => {
    it('updates the specified fields', async () => {
      const updated = makeDoc({ name: 'Updated Sprint', status: 'active' });

      collection.findOneAndUpdate.mockResolvedValue(updated);

      const result = await repo.update('tenant-1', 'sprint-123', {
        name: 'Updated Sprint',
        status: 'active',
      });

      expect(collection.findOneAndUpdate).toHaveBeenCalledWith(
        { id: 'sprint-123', tenantId: 'tenant-1' },
        { $set: { name: 'Updated Sprint', status: 'active', updatedAt: expect.any(Date) } },
        { returnDocument: 'after' },
      );
      expect(result?.name).toBe('Updated Sprint');
      expect(result?.status).toBe('active');
    });

    it('returns null when sprint not found', async () => {
      collection.findOneAndUpdate.mockResolvedValue(null);

      const result = await repo.update('tenant-1', 'missing', { name: 'X' });

      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('returns true when a document was deleted', async () => {
      collection.deleteOne.mockResolvedValue({ deletedCount: 1 } as DeleteResult);

      const result = await repo.delete('tenant-1', 'sprint-123');

      expect(result).toBe(true);
    });

    it('returns false when no document was deleted', async () => {
      collection.deleteOne.mockResolvedValue({ deletedCount: 0 } as DeleteResult);

      const result = await repo.delete('tenant-1', 'missing');

      expect(result).toBe(false);
    });
  });

  describe('addTask', () => {
    it('uses $addToSet to add a taskId', async () => {
      const updated = makeDoc({ taskIds: ['task-1'] });

      collection.findOneAndUpdate.mockResolvedValue(updated);

      const result = await repo.addTask('tenant-1', 'sprint-123', 'task-1');

      expect(collection.findOneAndUpdate).toHaveBeenCalledWith(
        { id: 'sprint-123', tenantId: 'tenant-1' },
        { $addToSet: { taskIds: 'task-1' }, $set: { updatedAt: expect.any(Date) } },
        { returnDocument: 'after' },
      );
      expect(result?.taskIds).toContain('task-1');
    });

    it('returns null when sprint not found', async () => {
      collection.findOneAndUpdate.mockResolvedValue(null);

      const result = await repo.addTask('tenant-1', 'missing', 'task-1');

      expect(result).toBeNull();
    });
  });

  describe('removeTask', () => {
    it('uses $pull to remove a taskId', async () => {
      const updated = makeDoc({ taskIds: [] });

      collection.findOneAndUpdate.mockResolvedValue(updated);

      const result = await repo.removeTask('tenant-1', 'sprint-123', 'task-1');

      expect(collection.findOneAndUpdate).toHaveBeenCalledWith(
        { id: 'sprint-123', tenantId: 'tenant-1' },
        { $pull: { taskIds: 'task-1' }, $set: { updatedAt: expect.any(Date) } },
        { returnDocument: 'after' },
      );
      expect(result?.taskIds).not.toContain('task-1');
    });
  });
});
