import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskService } from './task.service.js';

// ─── Mock Factories ──────────────────────────────────────────────────────────

function createMockTaskRepo() {
  return {
    findById: vi.fn(),
    findByBoardAndColumn: vi.fn(),
    findBySprint: vi.fn(),
    findByProject: vi.fn(),
    findByFilters: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getMaxPosition: vi.fn(),
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

function makeTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 'task-1',
    tenantId: 'tenant-1',
    projectId: 'proj-1',
    boardId: 'board-1',
    columnId: 'col-1',
    sprintId: null,
    title: 'Test Task',
    description: 'A test task',
    assigneeIds: [],
    priority: 'medium',
    position: 0,
    createdBy: 'user-1',
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

describe('TaskService', () => {
  let taskRepo: ReturnType<typeof createMockTaskRepo>;
  let columnRepo: ReturnType<typeof createMockColumnRepo>;
  let service: TaskService;

  beforeEach(() => {
    taskRepo = createMockTaskRepo();
    columnRepo = createMockColumnRepo();
    service = new TaskService(taskRepo as never, columnRepo as never, {} as never, {} as never, {} as never);
  });

  // ── listTasks ────────────────────────────────────────────────────────────

  describe('listTasks', () => {
    it('returns filtered tasks with pagination', async () => {
      taskRepo.findByFilters.mockResolvedValue([makeTask(), makeTask({ id: 'task-2', title: 'Task 2' })]);

      const result = await service.listTasks('tenant-1', {
        boardId: 'board-1',
        page: 1,
        limit: 10,
      });

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(taskRepo.findByFilters).toHaveBeenCalledWith('tenant-1', {
        boardId: 'board-1',
        columnId: undefined,
        projectId: undefined,
        sprintId: undefined,
        assigneeId: undefined,
      });
    });
  });

  // ── createTask ───────────────────────────────────────────────────────────

  describe('createTask', () => {
    it('creates a task with auto-assigned position', async () => {
      columnRepo.findById.mockResolvedValue(makeColumn());
      taskRepo.getMaxPosition.mockResolvedValue(2);
      taskRepo.create.mockResolvedValue(makeTask({ position: 3 }));

      const result = await service.createTask('tenant-1', 'user-1', {
        title: 'New Task',
        projectId: 'proj-1',
        boardId: 'board-1',
        columnId: 'col-1',
        priority: 'high',
        assigneeIds: [],
      } as never);

      expect(result.position).toBe(3);
      expect(taskRepo.create).toHaveBeenCalledWith('tenant-1', {
        projectId: 'proj-1',
        boardId: 'board-1',
        columnId: 'col-1',
        sprintId: undefined,
        title: 'New Task',
        description: undefined,
        assigneeIds: [],
        priority: 'high',
        position: 3,
        createdBy: 'user-1',
      });
    });

    it('throws NotFoundError when column does not exist', async () => {
      columnRepo.findById.mockResolvedValue(null);

      await expect(
        service.createTask('tenant-1', 'user-1', {
          title: 'Task',
          projectId: 'proj-1',
          boardId: 'board-1',
          columnId: 'missing-col',
          priority: 'medium',
          assigneeIds: [],
        } as never),
      ).rejects.toThrow('Column not found');
    });
  });

  // ── getTask ──────────────────────────────────────────────────────────────

  describe('getTask', () => {
    it('returns the task', async () => {
      taskRepo.findById.mockResolvedValue(makeTask());

      const result = await service.getTask('tenant-1', 'task-1');

      expect(result.id).toBe('task-1');
      expect(taskRepo.findById).toHaveBeenCalledWith('tenant-1', 'task-1');
    });

    it('throws NotFoundError when task does not exist', async () => {
      taskRepo.findById.mockResolvedValue(null);

      await expect(service.getTask('tenant-1', 'missing')).rejects.toThrow('Task not found');
    });
  });

  // ── updateTask ───────────────────────────────────────────────────────────

  describe('updateTask', () => {
    it('allows admin to update any task', async () => {
      taskRepo.findById.mockResolvedValue(makeTask({ createdBy: 'other-user' }));
      taskRepo.update.mockResolvedValue(makeTask({ title: 'Updated' }));

      const result = await service.updateTask('tenant-1', 'user-1', 'task-1', { title: 'Updated' }, 'admin');

      expect(result.title).toBe('Updated');
    });

    it('allows member to update own task', async () => {
      taskRepo.findById.mockResolvedValue(makeTask({ createdBy: 'user-1' }));
      taskRepo.update.mockResolvedValue(makeTask({ title: 'Updated' }));

      const result = await service.updateTask('tenant-1', 'user-1', 'task-1', { title: 'Updated' }, 'member');

      expect(result.title).toBe('Updated');
    });

    it('prevents member from updating other user task', async () => {
      taskRepo.findById.mockResolvedValue(makeTask({ createdBy: 'other-user' }));

      await expect(service.updateTask('tenant-1', 'user-1', 'task-1', { title: 'Hacked' }, 'member')).rejects.toThrow(
        'You can only edit your own tasks',
      );
    });
  });

  // ── deleteTask ───────────────────────────────────────────────────────────

  describe('deleteTask', () => {
    it('deletes the task when admin', async () => {
      taskRepo.delete.mockResolvedValue(true);

      await service.deleteTask('tenant-1', 'task-1', 'admin');

      expect(taskRepo.delete).toHaveBeenCalledWith('tenant-1', 'task-1');
    });

    it('throws ForbiddenError when user is member', async () => {
      await expect(service.deleteTask('tenant-1', 'task-1', 'member')).rejects.toThrow('Only owner or admin');
    });

    it('throws NotFoundError when task not found', async () => {
      taskRepo.delete.mockResolvedValue(false);

      await expect(service.deleteTask('tenant-1', 'missing', 'admin')).rejects.toThrow('Task not found');
    });
  });

  // ── moveTask ─────────────────────────────────────────────────────────────

  describe('moveTask', () => {
    it('moves task to a different column', async () => {
      taskRepo.findById.mockResolvedValue(makeTask());
      columnRepo.findById.mockResolvedValue(makeColumn({ id: 'col-2', boardId: 'board-1' }));
      taskRepo.getMaxPosition.mockResolvedValue(1);
      taskRepo.update.mockResolvedValue(makeTask({ columnId: 'col-2', position: 2 }));

      const result = await service.moveTask('tenant-1', {
        taskId: 'task-1',
        targetColumnId: 'col-2',
      });

      expect(result.columnId).toBe('col-2');
      expect(result.position).toBe(2);
    });

    it('throws ValidationError when target column is on different board', async () => {
      taskRepo.findById.mockResolvedValue(makeTask({ boardId: 'board-1' }));
      columnRepo.findById.mockResolvedValue(makeColumn({ id: 'col-2', boardId: 'board-2' }));

      await expect(
        service.moveTask('tenant-1', {
          taskId: 'task-1',
          targetColumnId: 'col-2',
        }),
      ).rejects.toThrow('Target column must belong to the same board');
    });

    it('throws NotFoundError when target column does not exist', async () => {
      taskRepo.findById.mockResolvedValue(makeTask());
      columnRepo.findById.mockResolvedValue(null);

      await expect(
        service.moveTask('tenant-1', {
          taskId: 'task-1',
          targetColumnId: 'missing',
        }),
      ).rejects.toThrow('Target column not found');
    });
  });

  // ── assignTask ───────────────────────────────────────────────────────────

  describe('assignTask', () => {
    it('updates assigneeIds', async () => {
      taskRepo.findById.mockResolvedValue(makeTask());
      taskRepo.update.mockResolvedValue(makeTask({ assigneeIds: ['user-2', 'user-3'] }));

      const result = await service.assignTask('tenant-1', {
        taskId: 'task-1',
        assigneeIds: ['user-2', 'user-3'],
      });

      expect(result.assigneeIds).toEqual(['user-2', 'user-3']);
      expect(taskRepo.update).toHaveBeenCalledWith('tenant-1', 'task-1', {
        assigneeIds: ['user-2', 'user-3'],
      });
    });
  });
});
