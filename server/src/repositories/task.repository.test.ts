import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskRepository } from './task.repository.js';
import type { TaskDocument } from './task.repository.js';
import type { Collection, InsertOneResult, DeleteResult } from 'mongodb';

function createMockCollection() {
  return {
    findOne: vi.fn(),
    find: vi.fn(),
    insertOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
    deleteOne: vi.fn(),
    updateMany: vi.fn(),
    countDocuments: vi.fn(),
  } as unknown as Collection<TaskDocument> & {
    findOne: ReturnType<typeof vi.fn>;
    find: ReturnType<typeof vi.fn>;
    insertOne: ReturnType<typeof vi.fn>;
    findOneAndUpdate: ReturnType<typeof vi.fn>;
    deleteOne: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
    countDocuments: ReturnType<typeof vi.fn>;
  };
}

function makeDoc(overrides: Partial<TaskDocument> = {}): TaskDocument {
  return {
    id: 'task-123',
    projectId: 'project-1',
    number: 1,
    typeId: 'type-1',
    title: 'Test Task',
    description: 'A test task',
    statusId: 'status-1',
    statusName: 'Todo',
    sprintName: null,
    priority: 'MEDIUM',
    reporterId: 'user-1',
    reporterSnapshot: { displayName: 'Reporter' },
    assigneeId: 'user-2',
    assigneeSnapshot: { displayName: 'Assignee' },
    sprintId: null,
    labelIds: [],
    createdById: 'user-1',
    createdBySnapshot: { displayName: 'Creator' },
    version: 1,
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

      const result = await repo.findById('task-123');

      expect(collection.findOne).toHaveBeenCalledWith({ id: 'task-123' });
      expect(result?.title).toBe('Test Task');
      expect(result?.number).toBe(1);
      expect(result?.version).toBe(1);
      expect(result?.assigneeId).toBe('user-2');
    });

    it('returns null when not found', async () => {
      collection.findOne.mockResolvedValue(null);

      const result = await repo.findById('missing');

      expect(result).toBeNull();
    });
  });

  describe('findByProject', () => {
    it('returns paginated tasks', async () => {
      const toArray = vi.fn().mockResolvedValue([makeDoc()]);
      const limit = vi.fn().mockReturnValue({ toArray });
      const skip = vi.fn().mockReturnValue({ limit });
      const sort = vi.fn().mockReturnValue({ skip });

      collection.find.mockReturnValue({ sort });
      collection.countDocuments.mockResolvedValue(1);

      const result = await repo.findByProject('project-1', { page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
    });

    it('F5: requests NO projection by default (description included)', async () => {
      const toArray = vi.fn().mockResolvedValue([makeDoc()]);
      const limit = vi.fn().mockReturnValue({ toArray });
      const skip = vi.fn().mockReturnValue({ limit });
      const sort = vi.fn().mockReturnValue({ skip });

      collection.find.mockReturnValue({ sort });
      collection.countDocuments.mockResolvedValue(1);

      await repo.findByProject('project-1', {});

      expect(collection.find).toHaveBeenCalledWith({ projectId: 'project-1' }, undefined);
    });

    it('F5: projects description out when excludeDescription is set', async () => {
      const toArray = vi.fn().mockResolvedValue([makeDoc()]);
      const limit = vi.fn().mockReturnValue({ toArray });
      const skip = vi.fn().mockReturnValue({ limit });
      const sort = vi.fn().mockReturnValue({ skip });

      collection.find.mockReturnValue({ sort });
      collection.countDocuments.mockResolvedValue(1);

      await repo.findByProject('project-1', { excludeDescription: true });

      expect(collection.find).toHaveBeenCalledWith({ projectId: 'project-1' }, { projection: { description: 0 } });
    });
  });

  describe('findAssignedTo (audit #3: /tasks/my)', () => {
    function chain(docs: TaskDocument[]) {
      const toArray = vi.fn().mockResolvedValue(docs);
      const limit = vi.fn().mockReturnValue({ toArray });
      const sort = vi.fn().mockReturnValue({ limit });

      collection.find.mockReturnValue({ sort });

      return { toArray, limit, sort };
    }

    it('filters by assigneeId, sorts by updatedAt desc and applies the minimal projection', async () => {
      const { sort, limit } = chain([makeDoc()]);

      await repo.findAssignedTo('user-9');

      expect(collection.find).toHaveBeenCalledWith(
        { assigneeId: 'user-9' },
        {
          projection: {
            id: 1,
            projectId: 1,
            number: 1,
            title: 1,
            priority: 1,
            createdAt: 1,
            updatedAt: 1,
          },
        },
      );
      expect(sort).toHaveBeenCalledWith({ updatedAt: -1 });
      expect(limit).toHaveBeenCalledWith(50);
    });

    it('maps projected documents — fields outside the projection are simply absent', async () => {
      const projected = {
        id: 'task-123',
        projectId: 'project-1',
        number: 7,
        title: 'Widget Task',
        priority: 'HIGH',
        createdAt: new Date('2025-01-01T00:00:00Z'),
        updatedAt: new Date('2025-01-02T00:00:00Z'),
      } as unknown as TaskDocument;

      chain([projected]);

      const result = await repo.findAssignedTo('user-9');

      expect(result).toHaveLength(1);

      const [task] = result;

      expect(task?.title).toBe('Widget Task');
      expect(task?.priority).toBe('HIGH');
      // Excluded fields (description, snapshots, …) are not part of the response.
      expect(task?.description).toBeUndefined();
      expect(task?.assigneeSnapshot).toBeUndefined();
    });

    it('honours a custom limit', async () => {
      const { limit } = chain([]);

      await repo.findAssignedTo('user-9', 10);

      expect(limit).toHaveBeenCalledWith(10);
    });
  });

  describe('create', () => {
    it('creates a task with version 1', async () => {
      collection.insertOne.mockResolvedValue({ acknowledged: true } as InsertOneResult);

      const result = await repo.create({
        projectId: 'project-1',
        number: 1,
        typeId: 'type-1',
        title: 'New Task',
        statusId: 'status-1',
        priority: 'HIGH',
        createdById: 'user-1',
        createdBySnapshot: { displayName: 'Creator' },
      });

      expect(result.title).toBe('New Task');
      expect(result.version).toBe(1);
    });
  });

  describe('updateWithVersion', () => {
    it('returns updated task on version match', async () => {
      collection.findOneAndUpdate.mockResolvedValue(makeDoc({ title: 'Updated', version: 2 }));

      const result = await repo.updateWithVersion('task-123', 1, { title: 'Updated' });

      expect(result?.title).toBe('Updated');
      expect(result?.version).toBe(2);
    });

    it('returns null on version mismatch', async () => {
      collection.findOneAndUpdate.mockResolvedValue(null);

      const result = await repo.updateWithVersion('task-123', 999, { title: 'Updated' });

      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('returns true when deleted', async () => {
      collection.deleteOne.mockResolvedValue({ deletedCount: 1 } as DeleteResult);

      const result = await repo.delete('task-123');

      expect(result).toBe(true);
    });
  });

  describe('countByStatus', () => {
    it('returns count of tasks with status', async () => {
      collection.countDocuments.mockResolvedValue(5);

      const result = await repo.countByStatus('project-1', 'status-1');

      expect(result).toBe(5);
    });
  });

  describe('updateManyByStatus', () => {
    it('updates status on all matching tasks', async () => {
      collection.updateMany.mockResolvedValue({ matchedCount: 3, modifiedCount: 3 } as never);

      await repo.updateManyByStatus('project-1', 'old-status', 'new-status');

      expect(collection.updateMany).toHaveBeenCalled();
    });
  });

  describe('countByType', () => {
    it('returns count of tasks with type', async () => {
      collection.countDocuments.mockResolvedValue(3);

      const result = await repo.countByType('project-1', 'type-1');

      expect(result).toBe(3);
    });
  });

  describe('updateManyByType', () => {
    it('updates type on all matching tasks', async () => {
      collection.updateMany.mockResolvedValue({ matchedCount: 2, modifiedCount: 2 } as never);

      await repo.updateManyByType('project-1', 'old-type', 'new-type');

      expect(collection.updateMany).toHaveBeenCalled();
    });
  });

  describe('removeLabelFromAll', () => {
    it('removes label from all tasks', async () => {
      collection.updateMany.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 } as never);

      await repo.removeLabelFromAll('project-1', 'label-1');

      expect(collection.updateMany).toHaveBeenCalled();
    });
  });

  describe('clearSprintFromTasks', () => {
    it('sets sprintId to null on all matching tasks', async () => {
      collection.updateMany.mockResolvedValue({ matchedCount: 2, modifiedCount: 2 } as never);

      await repo.clearSprintFromTasks('project-1', 'sprint-1');

      expect(collection.updateMany).toHaveBeenCalled();
    });
  });

  describe('search', () => {
    it('searches tasks by text', async () => {
      const toArray = vi.fn().mockResolvedValue([makeDoc()]);
      const limit = vi.fn().mockReturnValue({ toArray });
      const sort = vi.fn().mockReturnValue({ limit });

      collection.find.mockReturnValue({ sort });

      const result = await repo.search('project-1', 'test');

      expect(result).toHaveLength(1);
    });
  });
});
