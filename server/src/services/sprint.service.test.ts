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

  // ── V2-4: sprint mutation enforcement ─────────────────────────────────────

  describe('sprint RBAC enforcement (V2-4)', () => {
    let projectMemberRepo: { findByUserAndProject: ReturnType<typeof vi.fn> };

    beforeEach(() => {
      projectMemberRepo = { findByUserAndProject: vi.fn().mockResolvedValue(null) };
      service = new SprintService(sprintRepo, projectRepo, taskRepo, undefined, projectMemberRepo);
    });

    it('denies createSprint for a project EDITOR', async () => {
      projectRepo.findById = vi.fn().mockResolvedValue({ id: 'project-1', status: 'ACTIVE' });
      projectMemberRepo.findByUserAndProject.mockResolvedValue({ role: 'EDITOR' });

      await expect(service.createSprint('project-1', { name: 'Sprint X' }, 'user-1', 'MEMBER')).rejects.toThrow(
        'create_sprint',
      );
      expect(sprintRepo.create).not.toHaveBeenCalled();
    });

    it('allows createSprint for a PROJECT_ADMIN', async () => {
      projectRepo.findById = vi.fn().mockResolvedValue({ id: 'project-1', status: 'ACTIVE' });
      sprintRepo.create = vi.fn().mockResolvedValue(makeSprint({ id: 'sprint-new' }));
      projectMemberRepo.findByUserAndProject.mockResolvedValue({ role: 'PROJECT_ADMIN' });

      const sprint = await service.createSprint('project-1', { name: 'Sprint X' }, 'user-1', 'MEMBER');

      expect(sprint.id).toBe('sprint-new');
    });

    it('denies updateSprint for a project VIEWER (id-based route — service is the only gate)', async () => {
      sprintRepo.findById = vi.fn().mockResolvedValue(makeSprint());
      projectMemberRepo.findByUserAndProject.mockResolvedValue({ role: 'VIEWER' });

      await expect(service.updateSprint('sprint-1', { name: 'Renamed' }, 'user-1', 'MEMBER')).rejects.toThrow(
        'change_sprint_status',
      );
      expect(sprintRepo.update).not.toHaveBeenCalled();
    });

    it('denies deleteSprint for a project EDITOR but allows a tenant OWNER bypass', async () => {
      sprintRepo.findById = vi.fn().mockResolvedValue(makeSprint());
      sprintRepo.delete = vi.fn().mockResolvedValue(true);

      projectMemberRepo.findByUserAndProject.mockResolvedValue({ role: 'EDITOR' });
      await expect(service.deleteSprint('sprint-1', 'user-1', 'MEMBER')).rejects.toThrow('change_sprint_status');
      expect(sprintRepo.delete).not.toHaveBeenCalled();

      // tenant OWNER bypasses without any project membership
      projectMemberRepo.findByUserAndProject.mockClear();
      await service.deleteSprint('sprint-1', 'user-1', 'OWNER');
      expect(sprintRepo.delete).toHaveBeenCalledWith('sprint-1');
    });
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

    it('sets startDate but not endDate when transitioning to ACTIVE without dates (DEC-016)', async () => {
      sprintRepo.findById = vi.fn().mockResolvedValue(makeSprint({ status: 'FUTURE', startDate: null, endDate: null }));
      sprintRepo.update = vi.fn().mockImplementation((_id, input) =>
        Promise.resolve(
          makeSprint({
            status: input.status,
            startDate: input.startDate ? new Date(input.startDate).toISOString() : null,
            endDate: input.endDate ? new Date(input.endDate).toISOString() : null,
          }),
        ),
      );

      await service.updateSprint('sprint-1', { status: 'ACTIVE' });

      expect(sprintRepo.update).toHaveBeenCalledWith(
        'sprint-1',
        expect.objectContaining({ status: 'ACTIVE', startDate: expect.any(Date) }),
      );
      // DEC-016: endDate must never be filled on start
      expect(sprintRepo.update).toHaveBeenCalledWith(
        'sprint-1',
        expect.not.objectContaining({ endDate: expect.anything() }),
      );
    });

    it('keeps existing startDate when transitioning to ACTIVE', async () => {
      const existingStart = '2025-06-01T00:00:00.000Z';

      sprintRepo.findById = vi.fn().mockResolvedValue(makeSprint({ status: 'FUTURE', startDate: existingStart }));
      sprintRepo.update = vi.fn().mockResolvedValue(makeSprint({ status: 'ACTIVE' }));

      await service.updateSprint('sprint-1', { status: 'ACTIVE' });

      // Existing startDate is preserved by not being included in the update payload
      expect(sprintRepo.update).toHaveBeenCalledWith('sprint-1', { status: 'ACTIVE' });
    });

    it('sets endDate when completing sprint with null endDate', async () => {
      sprintRepo.findById = vi.fn().mockResolvedValue(makeSprint({ status: 'ACTIVE', endDate: null }));
      sprintRepo.update = vi.fn().mockResolvedValue(makeSprint({ status: 'COMPLETED' }));

      await service.updateSprint('sprint-1', { status: 'COMPLETED' });

      expect(sprintRepo.update).toHaveBeenCalledWith(
        'sprint-1',
        expect.objectContaining({ status: 'COMPLETED', endDate: expect.any(Date) }),
      );
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
