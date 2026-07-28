import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SprintService } from './sprint.service.js';

// ─── Mock Factories ──────────────────────────────────────────────────────────

function createMockSprintRepo() {
  return {
    findById: vi.fn(),
    findByProject: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    addTask: vi.fn(),
    removeTask: vi.fn(),
  };
}

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

function createMockProjectRepo() {
  return {
    findById: vi.fn(),
    findByTenant: vi.fn(),
    findBySlug: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
}

const NOW = '2025-01-01T00:00:00.000Z';

function makeSprint(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sprint-1',
    tenantId: 'tenant-1',
    projectId: 'proj-1',
    name: 'Sprint 1',
    startDate: '2025-01-01T00:00:00.000Z',
    endDate: '2025-01-15T00:00:00.000Z',
    goal: 'Ship MVP',
    status: 'planned',
    taskIds: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 'task-1',
    tenantId: 'tenant-1',
    projectId: 'proj-1',
    boardId: 'board-1',
    columnId: 'col-1',
    sprintId: null,
    title: 'Test Task',
    description: null,
    assigneeIds: [],
    priority: 'medium',
    position: 0,
    createdBy: 'user-1',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeProject(overrides: Record<string, unknown> = {}) {
  return {
    id: 'proj-1',
    tenantId: 'tenant-1',
    name: 'Test Project',
    slug: 'test-project',
    description: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('SprintService', () => {
  let sprintRepo: ReturnType<typeof createMockSprintRepo>;
  let taskRepo: ReturnType<typeof createMockTaskRepo>;
  let projectRepo: ReturnType<typeof createMockProjectRepo>;
  let service: SprintService;

  beforeEach(() => {
    sprintRepo = createMockSprintRepo();
    taskRepo = createMockTaskRepo();
    projectRepo = createMockProjectRepo();
    service = new SprintService(sprintRepo as never, taskRepo as never, projectRepo as never);
  });

  // ── listSprints ──────────────────────────────────────────────────────────

  describe('listSprints', () => {
    it('returns all sprints for a project', async () => {
      projectRepo.findById.mockResolvedValue(makeProject());
      sprintRepo.findByProject.mockResolvedValue([makeSprint()]);

      const result = await service.listSprints('tenant-1', 'proj-1');

      expect(result).toHaveLength(1);
      expect(sprintRepo.findByProject).toHaveBeenCalledWith('tenant-1', 'proj-1');
    });

    it('throws NotFoundError when project does not exist', async () => {
      projectRepo.findById.mockResolvedValue(null);

      await expect(service.listSprints('tenant-1', 'missing')).rejects.toThrow('Project not found');
    });
  });

  // ── createSprint ─────────────────────────────────────────────────────────

  describe('createSprint', () => {
    it('creates a sprint when admin', async () => {
      projectRepo.findById.mockResolvedValue(makeProject());
      sprintRepo.create.mockResolvedValue(makeSprint());

      const result = await service.createSprint(
        'tenant-1',
        'proj-1',
        {
          name: 'Sprint 1',
          startDate: '2025-01-01T00:00:00.000Z',
          endDate: '2025-01-15T00:00:00.000Z',
          goal: 'Ship MVP',
        },
        'admin',
      );

      expect(result.name).toBe('Sprint 1');
      expect(result.status).toBe('planned');
    });

    it('throws ForbiddenError when user is not admin', async () => {
      await expect(
        service.createSprint(
          'tenant-1',
          'proj-1',
          {
            name: 'Sprint 1',
            startDate: '2025-01-01T00:00:00.000Z',
            endDate: '2025-01-15T00:00:00.000Z',
          },
          'member',
        ),
      ).rejects.toThrow('Only owner or admin');
    });
  });

  // ── getSprint ────────────────────────────────────────────────────────────

  describe('getSprint', () => {
    it('returns sprint with tasks', async () => {
      sprintRepo.findById.mockResolvedValue(makeSprint());
      taskRepo.findBySprint.mockResolvedValue([makeTask({ sprintId: 'sprint-1' })]);

      const result = await service.getSprint('tenant-1', 'sprint-1');

      expect(result.sprint.id).toBe('sprint-1');
      expect(result.tasks).toHaveLength(1);
    });

    it('throws NotFoundError when sprint does not exist', async () => {
      sprintRepo.findById.mockResolvedValue(null);

      await expect(service.getSprint('tenant-1', 'missing')).rejects.toThrow('Sprint not found');
    });
  });

  // ── updateSprint ─────────────────────────────────────────────────────────

  describe('updateSprint', () => {
    it('updates sprint when admin', async () => {
      sprintRepo.update.mockResolvedValue(makeSprint({ name: 'Updated Sprint' }));

      const result = await service.updateSprint('tenant-1', 'sprint-1', { name: 'Updated Sprint' }, 'admin');

      expect(result.name).toBe('Updated Sprint');
    });

    it('throws ForbiddenError when user is not admin', async () => {
      await expect(service.updateSprint('tenant-1', 'sprint-1', { name: 'X' }, 'member')).rejects.toThrow(
        'Only owner or admin',
      );
    });

    it('throws NotFoundError when sprint not found', async () => {
      sprintRepo.update.mockResolvedValue(null);

      await expect(service.updateSprint('tenant-1', 'missing', { name: 'X' }, 'admin')).rejects.toThrow(
        'Sprint not found',
      );
    });
  });

  // ── deleteSprint ─────────────────────────────────────────────────────────

  describe('deleteSprint', () => {
    it('deletes sprint and clears sprintId on tasks', async () => {
      taskRepo.findBySprint.mockResolvedValue([
        makeTask({ id: 'task-1', sprintId: 'sprint-1' }),
        makeTask({ id: 'task-2', sprintId: 'sprint-1' }),
      ]);
      taskRepo.update.mockResolvedValue(makeTask({ sprintId: null }));
      sprintRepo.delete.mockResolvedValue(true);

      await service.deleteSprint('tenant-1', 'sprint-1', 'admin');

      expect(taskRepo.update).toHaveBeenCalledTimes(2);
      expect(taskRepo.update).toHaveBeenCalledWith('tenant-1', 'task-1', {
        sprintId: null,
      });
      expect(sprintRepo.delete).toHaveBeenCalledWith('tenant-1', 'sprint-1');
    });

    it('throws ForbiddenError when user is not admin', async () => {
      await expect(service.deleteSprint('tenant-1', 'sprint-1', 'member')).rejects.toThrow('Only owner or admin');
    });
  });

  // ── addTaskToSprint ──────────────────────────────────────────────────────

  describe('addTaskToSprint', () => {
    it('adds task to sprint and updates task sprintId', async () => {
      sprintRepo.findById.mockResolvedValue(makeSprint());
      taskRepo.findById.mockResolvedValue(makeTask({ projectId: 'proj-1' }));
      taskRepo.update.mockResolvedValue(makeTask({ sprintId: 'sprint-1' }));
      sprintRepo.addTask.mockResolvedValue(makeSprint({ taskIds: ['task-1'] }));

      const result = await service.addTaskToSprint('tenant-1', 'sprint-1', 'task-1');

      expect(result.taskIds).toContain('task-1');
      expect(taskRepo.update).toHaveBeenCalledWith('tenant-1', 'task-1', {
        sprintId: 'sprint-1',
      });
    });

    it('throws ConflictError when task is from different project', async () => {
      sprintRepo.findById.mockResolvedValue(makeSprint({ projectId: 'proj-1' }));
      taskRepo.findById.mockResolvedValue(makeTask({ projectId: 'proj-2' }));

      await expect(service.addTaskToSprint('tenant-1', 'sprint-1', 'task-1')).rejects.toThrow(
        'Task must belong to the same project',
      );
    });

    it('throws NotFoundError when sprint does not exist', async () => {
      sprintRepo.findById.mockResolvedValue(null);

      await expect(service.addTaskToSprint('tenant-1', 'missing', 'task-1')).rejects.toThrow('Sprint not found');
    });
  });

  // ── removeTaskFromSprint ─────────────────────────────────────────────────

  describe('removeTaskFromSprint', () => {
    it('removes task from sprint and clears sprintId', async () => {
      sprintRepo.findById.mockResolvedValue(makeSprint({ taskIds: ['task-1'] }));
      taskRepo.findById.mockResolvedValue(makeTask({ sprintId: 'sprint-1' }));
      taskRepo.update.mockResolvedValue(makeTask({ sprintId: null }));
      sprintRepo.removeTask.mockResolvedValue(makeSprint({ taskIds: [] }));

      const result = await service.removeTaskFromSprint('tenant-1', 'sprint-1', 'task-1');

      expect(result.taskIds).toHaveLength(0);
      expect(taskRepo.update).toHaveBeenCalledWith('tenant-1', 'task-1', {
        sprintId: null,
      });
      expect(sprintRepo.removeTask).toHaveBeenCalledWith('tenant-1', 'sprint-1', 'task-1');
    });

    it('throws NotFoundError when task does not exist', async () => {
      sprintRepo.findById.mockResolvedValue(makeSprint());
      taskRepo.findById.mockResolvedValue(null);

      await expect(service.removeTaskFromSprint('tenant-1', 'sprint-1', 'missing')).rejects.toThrow('Task not found');
    });
  });
});
