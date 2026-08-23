import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SprintService } from './sprint.service.js';
import type { SprintServiceTaskRepo } from './sprint.service.js';
import { SprintRepository } from '../repositories/sprint.repository.js';
import { ProjectRepository } from '../repositories/project.repository.js';
import type { Sprint } from '@task-board/shared';

function createMockSprintRepo() {
  return {
    findById: vi.fn(),
    findByProject: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  } as unknown as SprintRepository;
}

function createMockProjectRepo() {
  return {
    findById: vi.fn(),
  } as unknown as ProjectRepository;
}

function createMockTaskRepo(): SprintServiceTaskRepo {
  return {
    clearSprintFromTasks: vi.fn().mockResolvedValue(undefined),
  };
}

function makeSprint(overrides: Partial<Sprint> = {}): Sprint {
  return {
    id: 'sprint-1',
    projectId: 'project-1',
    name: 'Sprint 1',
    status: 'FUTURE',
    startDate: null,
    endDate: null,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('SprintService', () => {
  let sprintRepo: ReturnType<typeof createMockSprintRepo>;
  let projectRepo: ReturnType<typeof createMockProjectRepo>;
  let taskRepo: SprintServiceTaskRepo;
  let service: SprintService;

  beforeEach(() => {
    sprintRepo = createMockSprintRepo();
    projectRepo = createMockProjectRepo();
    taskRepo = createMockTaskRepo();
    service = new SprintService(sprintRepo, projectRepo, taskRepo);
  });

  describe('getSprintsByProject', () => {
    it('returns sprints for a project', async () => {
      sprintRepo.findByProject = vi.fn().mockResolvedValue([makeSprint()]);

      const result = await service.getSprintsByProject('project-1');

      expect(result).toHaveLength(1);
    });
  });

  describe('getSprint', () => {
    it('returns sprint when found', async () => {
      sprintRepo.findById = vi.fn().mockResolvedValue(makeSprint());

      const result = await service.getSprint('sprint-1');

      expect(result.name).toBe('Sprint 1');
    });

    it('throws NOT_FOUND when not found', async () => {
      sprintRepo.findById = vi.fn().mockResolvedValue(null);

      await expect(service.getSprint('missing')).rejects.toThrow('Sprint not found');
    });
  });

  describe('createSprint', () => {
    it('creates sprint with FUTURE status', async () => {
      projectRepo.findById = vi.fn().mockResolvedValue({ id: 'project-1', status: 'ACTIVE' });
      sprintRepo.create = vi.fn().mockResolvedValue(makeSprint());

      const result = await service.createSprint('project-1', { name: 'Sprint 1' });

      expect(result.status).toBe('FUTURE');
    });

    it('throws when project is archived', async () => {
      projectRepo.findById = vi.fn().mockResolvedValue({ id: 'project-1', status: 'ARCHIVED' });

      await expect(service.createSprint('project-1', { name: 'Sprint 1' })).rejects.toThrow('archived project');
    });
  });

  describe('updateSprint', () => {
    it('updates sprint name', async () => {
      sprintRepo.findById = vi.fn().mockResolvedValue(makeSprint());
      sprintRepo.update = vi.fn().mockResolvedValue(makeSprint({ name: 'Updated' }));

      const result = await service.updateSprint('sprint-1', { name: 'Updated' });

      expect(result.name).toBe('Updated');
    });

    it('sets startDate when transitioning to ACTIVE without startDate', async () => {
      sprintRepo.findById = vi.fn().mockResolvedValue(makeSprint({ startDate: null }));
      sprintRepo.update = vi.fn().mockImplementation((_id, input) =>
        Promise.resolve(
          makeSprint({
            status: input.status,
            startDate: input.startDate ? new Date(input.startDate).toISOString() : null,
          }),
        ),
      );

      await service.updateSprint('sprint-1', { status: 'ACTIVE' });

      expect(sprintRepo.update).toHaveBeenCalledWith('sprint-1', expect.objectContaining({ status: 'ACTIVE' }));
    });

    it('sets endDate when completing sprint', async () => {
      sprintRepo.findById = vi.fn().mockResolvedValue(makeSprint({ status: 'ACTIVE', endDate: null }));
      sprintRepo.update = vi.fn().mockResolvedValue(makeSprint({ status: 'COMPLETED' }));

      await service.updateSprint('sprint-1', { status: 'COMPLETED' });

      expect(sprintRepo.update).toHaveBeenCalledWith('sprint-1', expect.objectContaining({ status: 'COMPLETED' }));
    });
  });

  describe('deleteSprint', () => {
    it('clears sprint from tasks and deletes sprint', async () => {
      sprintRepo.findById = vi.fn().mockResolvedValue(makeSprint());
      sprintRepo.delete = vi.fn().mockResolvedValue(true);

      await service.deleteSprint('sprint-1');

      expect(taskRepo.clearSprintFromTasks).toHaveBeenCalledWith('project-1', 'sprint-1');
      expect(sprintRepo.delete).toHaveBeenCalledWith('sprint-1');
    });

    it('throws when sprint not found', async () => {
      sprintRepo.findById = vi.fn().mockResolvedValue(null);

      await expect(service.deleteSprint('missing')).rejects.toThrow('Sprint not found');
    });
  });
});
