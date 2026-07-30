import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskRepository } from './task.repository.js';
import type { TaskDocument } from './task.repository.js';
import type { Collection, InsertOneResult, DeleteResult } from 'mongodb';

// ─── Mock Collection Helper ──────────────────────────────────────────────────

function createMockCollection() {
  return {
    findOne: vi.fn(),
    find: vi.fn(),
    insertOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
    deleteOne: vi.fn(),
  } as unknown as Collection<TaskDocument> & {
    findOne: ReturnType<typeof vi.fn>;
    find: ReturnType<typeof vi.fn>;
    insertOne: ReturnType<typeof vi.fn>;
    findOneAndUpdate: ReturnType<typeof vi.fn>;
    deleteOne: ReturnType<typeof vi.fn>;
  };
}

function makeDoc(overrides: Partial<TaskDocument> = {}): TaskDocument {
  return {
    id: 'task-123',
    tenantId: 'tenant-1',
    projectId: 'project-1',
    boardId: 'board-1',
    columnId: 'col-1',
    sprintId: null,
    title: 'Test Task',
    description: 'A test task',
    assigneeIds: [],
    priority: 'medium',
    position: 0,
    createdBy: 'user-1',
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('TaskRepository', () => {
  let collection: ReturnType<typeof createMockCollection>;
  let repo: TaskRepository;

  beforeEach(() => {
    collection = createMockCollection();
    repo = new TaskRepository(collection);
  });

  describe('findById', () => {
    it('returns a mapped task when found', async () => {
      collection.findOne.mockResolvedValue(makeDoc());

      const result = await repo.findById('tenant-1', 'task-123');

      expect(collection.findOne).toHaveBeenCalledWith({ id: 'task-123', tenantId: 'tenant-1' });
      expect(result).toEqual({
        id: 'task-123',
        tenantId: 'tenant-1',
        projectId: 'project-1',
        boardId: 'board-1',
        columnId: 'col-1',
        sprintId: null,
        title: 'Test Task',
        description: 'A test task',
        assigneeIds: [],
        priority: 'medium',
        position: 0,
        createdBy: 'user-1',
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

  describe('findByBoardAndColumn', () => {
    it('returns tasks sorted by position', async () => {
      const toArray = vi
        .fn()
        .mockResolvedValue([makeDoc({ id: 't1', position: 0 }), makeDoc({ id: 't2', position: 1 })]);
      const sortFn = vi.fn().mockReturnValue({ toArray });

      collection.find.mockReturnValue({ sort: sortFn });

      const result = await repo.findByBoardAndColumn('tenant-1', 'board-1', 'col-1');

      expect(collection.find).toHaveBeenCalledWith({ tenantId: 'tenant-1', boardId: 'board-1', columnId: 'col-1' });
      expect(sortFn).toHaveBeenCalledWith({ position: 1 });
      expect(result).toHaveLength(2);
    });
  });

  describe('findBySprint', () => {
    it('returns tasks for a sprint sorted by position', async () => {
      const toArray = vi.fn().mockResolvedValue([makeDoc({ sprintId: 'sprint-1' })]);
      const sortFn = vi.fn().mockReturnValue({ toArray });

      collection.find.mockReturnValue({ sort: sortFn });

      const result = await repo.findBySprint('tenant-1', 'sprint-1');

      expect(collection.find).toHaveBeenCalledWith({ tenantId: 'tenant-1', sprintId: 'sprint-1' });
      expect(result).toHaveLength(1);
    });
  });

  describe('findByProject', () => {
    it('returns tasks for a project', async () => {
      const toArray = vi.fn().mockResolvedValue([makeDoc()]);
      const sortFn = vi.fn().mockReturnValue({ toArray });

      collection.find.mockReturnValue({ sort: sortFn });

      const result = await repo.findByProject('tenant-1', 'project-1');

      expect(collection.find).toHaveBeenCalledWith({ tenantId: 'tenant-1', projectId: 'project-1' });
      expect(result).toHaveLength(1);
    });
  });

  describe('findByFilters', () => {
    it('builds a query from provided filters', async () => {
      const toArray = vi.fn().mockResolvedValue([makeDoc()]);
      const sortFn = vi.fn().mockReturnValue({ toArray });

      collection.find.mockReturnValue({ sort: sortFn });

      await repo.findByFilters('tenant-1', { projectId: 'p1', sprintId: 's1' });

      expect(collection.find).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        projectId: 'p1',
        sprintId: 's1',
      });
    });

    it('uses assigneeId to filter by assigneeIds', async () => {
      const toArray = vi.fn().mockResolvedValue([]);
      const sortFn = vi.fn().mockReturnValue({ toArray });

      collection.find.mockReturnValue({ sort: sortFn });

      await repo.findByFilters('tenant-1', { assigneeId: 'user-42' });

      expect(collection.find).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        assigneeIds: 'user-42',
      });
    });
  });

  describe('create', () => {
    it('inserts a document and returns the domain task', async () => {
      collection.insertOne.mockResolvedValue({ acknowledged: true } as InsertOneResult);

      const result = await repo.create('tenant-1', {
        projectId: 'project-1',
        boardId: 'board-1',
        columnId: 'col-1',
        title: 'New Task',
        position: 5,
        createdBy: 'user-1',
      });

      expect(collection.insertOne).toHaveBeenCalledTimes(1);

      const insertedDoc = collection.insertOne.mock.calls[0]?.[0] as TaskDocument;

      expect(insertedDoc.title).toBe('New Task');
      expect(insertedDoc.sprintId).toBeNull();
      expect(insertedDoc.assigneeIds).toEqual([]);
      expect(insertedDoc.priority).toBe('medium');
      expect(insertedDoc.position).toBe(5);
      expect(insertedDoc.id).toBeDefined();

      expect(result.title).toBe('New Task');
      expect(typeof result.createdAt).toBe('string');
    });

    it('passes through optional fields', async () => {
      collection.insertOne.mockResolvedValue({ acknowledged: true } as InsertOneResult);

      const result = await repo.create('tenant-1', {
        projectId: 'project-1',
        boardId: 'board-1',
        columnId: 'col-1',
        sprintId: 'sprint-1',
        title: 'Sprint Task',
        description: 'desc',
        assigneeIds: ['user-1'],
        priority: 'high',
        position: 0,
        createdBy: 'user-1',
      });

      expect(result.sprintId).toBe('sprint-1');
      expect(result.description).toBe('desc');
      expect(result.assigneeIds).toEqual(['user-1']);
      expect(result.priority).toBe('high');
    });
  });

  describe('update', () => {
    it('returns the updated task', async () => {
      const updated = makeDoc({ title: 'Updated Task' });

      collection.findOneAndUpdate.mockResolvedValue(updated);

      const result = await repo.update('tenant-1', 'task-123', { title: 'Updated Task' });

      expect(collection.findOneAndUpdate).toHaveBeenCalledWith(
        { id: 'task-123', tenantId: 'tenant-1' },
        { $set: { title: 'Updated Task', updatedAt: expect.any(Date) } },
        { returnDocument: 'after' },
      );
      expect(result?.title).toBe('Updated Task');
    });

    it('returns null when task not found', async () => {
      collection.findOneAndUpdate.mockResolvedValue(null);

      const result = await repo.update('tenant-1', 'missing', { title: 'X' });

      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('returns true when a document was deleted', async () => {
      collection.deleteOne.mockResolvedValue({ deletedCount: 1 } as DeleteResult);

      const result = await repo.delete('tenant-1', 'task-123');

      expect(result).toBe(true);
    });

    it('returns false when no document was deleted', async () => {
      collection.deleteOne.mockResolvedValue({ deletedCount: 0 } as DeleteResult);

      const result = await repo.delete('tenant-1', 'missing');

      expect(result).toBe(false);
    });
  });

  describe('findByAssignee', () => {
    it('returns raw TaskDocuments for the assignee', async () => {
      const toArray = vi.fn().mockResolvedValue([makeDoc({ assigneeIds: ['user-1'] })]);
      const sortFn = vi.fn().mockReturnValue({ toArray });

      collection.find.mockReturnValue({ sort: sortFn });

      const result = await repo.findByAssignee('user-1', ['tenant-1', 'tenant-2']);

      expect(collection.find).toHaveBeenCalledWith({
        assigneeIds: 'user-1',
        tenantId: { $in: ['tenant-1', 'tenant-2'] },
      });
      expect(sortFn).toHaveBeenCalledWith({ updatedAt: -1 });
      expect(result).toHaveLength(1);
    });
  });

  describe('getMaxPosition', () => {
    it('returns the max position in a column', async () => {
      const toArray = vi.fn().mockResolvedValue([{ position: 4 }]);
      const sortFn = vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue({ toArray }) });

      collection.find.mockReturnValue({ sort: sortFn });

      const result = await repo.getMaxPosition('tenant-1', 'board-1', 'col-1');

      expect(result).toBe(4);
    });

    it('returns -1 when column is empty', async () => {
      const toArray = vi.fn().mockResolvedValue([]);
      const sortFn = vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue({ toArray }) });

      collection.find.mockReturnValue({ sort: sortFn });

      const result = await repo.getMaxPosition('tenant-1', 'board-1', 'col-1');

      expect(result).toBe(-1);
    });
  });
});
