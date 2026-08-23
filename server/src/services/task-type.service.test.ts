import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskTypeService } from './task-type.service.js';
import type { TaskTypeServiceTaskRepo, TaskTypeServiceProjectRepo } from './task-type.service.js';
import { TaskTypeRepository } from '../repositories/task-type.repository.js';
import type { AuditService } from './audit.service.js';
import type { TaskType } from '@task-board/shared';

// ─── Mock Factories ──────────────────────────────────────────────────────────

function createMockTaskTypeRepo() {
  return {
    findById: vi.fn(),
    findByProject: vi.fn(),
    findByProjectAndKey: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  } as unknown as TaskTypeRepository;
}

function createMockTaskRepo(): TaskTypeServiceTaskRepo {
  return {
    countByType: vi.fn().mockResolvedValue(0),
    updateManyByType: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockProjectRepo(): TaskTypeServiceProjectRepo {
  return {
    findById: vi.fn().mockResolvedValue({ tenantId: 'tenant-1' }),
  };
}

function createMockAuditService(): AuditService {
  return {
    log: vi.fn().mockResolvedValue({}),
    queryByProject: vi.fn(),
    queryByTenant: vi.fn(),
  } as unknown as AuditService;
}

function makeTaskType(overrides: Partial<TaskType> = {}): TaskType {
  return {
    id: 'type-1',
    projectId: 'project-1',
    key: 'TASK',
    name: 'Task',
    icon: '📋',
    position: 0,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('TaskTypeService', () => {
  let taskTypeRepo: ReturnType<typeof createMockTaskTypeRepo>;
  let taskRepo: TaskTypeServiceTaskRepo;
  let projectRepo: TaskTypeServiceProjectRepo;
  let auditService: AuditService;
  let service: TaskTypeService;

  beforeEach(() => {
    taskTypeRepo = createMockTaskTypeRepo();
    taskRepo = createMockTaskRepo();
    projectRepo = createMockProjectRepo();
    auditService = createMockAuditService();
    service = new TaskTypeService(taskTypeRepo, taskRepo, projectRepo, auditService);
  });

  describe('getTaskTypesByProject', () => {
    it('returns all task types for a project', async () => {
      taskTypeRepo.findByProject = vi.fn().mockResolvedValue([makeTaskType()]);

      const result = await service.getTaskTypesByProject('project-1');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Task');
    });
  });

  describe('createTaskType', () => {
    it('creates a task type when key is unique', async () => {
      taskTypeRepo.findByProjectAndKey = vi.fn().mockResolvedValue(null);
      taskTypeRepo.create = vi.fn().mockResolvedValue(makeTaskType());

      const result = await service.createTaskType('project-1', { key: 'TASK', name: 'Task', position: 0 }, 'user-1');

      expect(result.name).toBe('Task');
    });

    it('throws CONFLICT when key exists', async () => {
      taskTypeRepo.findByProjectAndKey = vi.fn().mockResolvedValue(makeTaskType());

      await expect(service.createTaskType('project-1', { key: 'TASK', name: 'Task', position: 0 })).rejects.toThrow(
        'A task type with this key already exists',
      );
    });

    it('creates audit event on task type creation', async () => {
      taskTypeRepo.findByProjectAndKey = vi.fn().mockResolvedValue(null);
      taskTypeRepo.create = vi.fn().mockResolvedValue(makeTaskType());

      await service.createTaskType('project-1', { key: 'TASK', name: 'Task', position: 0 }, 'user-1');

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'TASK_TYPE',
          action: 'CREATED',
          actorId: 'user-1',
        }),
      );
    });
  });

  describe('updateTaskType', () => {
    it('updates name only (key is immutable)', async () => {
      taskTypeRepo.findById = vi.fn().mockResolvedValue(makeTaskType());
      taskTypeRepo.update = vi.fn().mockResolvedValue(makeTaskType({ name: 'New Name' }));

      await service.updateTaskType('type-1', { name: 'New Name' }, 'user-1');

      expect(taskTypeRepo.update).toHaveBeenCalledWith('type-1', {
        name: 'New Name',
        icon: undefined,
        position: undefined,
      });
    });

    it('creates audit event on task type update', async () => {
      taskTypeRepo.findById = vi.fn().mockResolvedValue(makeTaskType());
      taskTypeRepo.update = vi.fn().mockResolvedValue(makeTaskType({ name: 'New Name' }));

      await service.updateTaskType('type-1', { name: 'New Name' }, 'user-1');

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'TASK_TYPE',
          action: 'UPDATED',
          actorId: 'user-1',
          changes: expect.arrayContaining([
            expect.objectContaining({ field: 'name', oldValue: 'Task', newValue: 'New Name' }),
          ]),
        }),
      );
    });
  });

  describe('deleteTaskType', () => {
    it('deletes task type not in use', async () => {
      taskTypeRepo.findById = vi.fn().mockResolvedValue(makeTaskType());
      (taskRepo.countByType as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      await service.deleteTaskType('type-1');

      expect(taskTypeRepo.delete).toHaveBeenCalledWith('type-1');
    });

    it('throws TASK_TYPE_IN_USE when type is in use without replacement', async () => {
      taskTypeRepo.findById = vi.fn().mockResolvedValue(makeTaskType());
      (taskRepo.countByType as ReturnType<typeof vi.fn>).mockResolvedValue(5);

      await expect(service.deleteTaskType('type-1')).rejects.toThrow('Task type is in use by tasks');
    });

    it('uses TASK_TYPE_IN_USE error code (not INVALID_STATUS_REPLACEMENT)', async () => {
      taskTypeRepo.findById = vi.fn().mockResolvedValue(makeTaskType());
      (taskRepo.countByType as ReturnType<typeof vi.fn>).mockResolvedValue(5);

      try {
        await service.deleteTaskType('type-1');
        expect.fail('Should have thrown');
      } catch (error: unknown) {
        const err = error as { code: string };

        expect(err.code).toBe('TASK_TYPE_IN_USE');
      }
    });

    it('updates tasks when replacement provided', async () => {
      taskTypeRepo.findById = vi
        .fn()
        .mockResolvedValueOnce(makeTaskType())
        .mockResolvedValueOnce(makeTaskType({ id: 'type-2', key: 'BUG', name: 'Bug' }));
      (taskRepo.countByType as ReturnType<typeof vi.fn>).mockResolvedValue(5);

      await service.deleteTaskType('type-1', 'type-2');

      expect(taskRepo.updateManyByType).toHaveBeenCalledWith('project-1', 'type-1', 'type-2');
      expect(taskTypeRepo.delete).toHaveBeenCalledWith('type-1');
    });

    it('creates audit event on task type deletion', async () => {
      taskTypeRepo.findById = vi.fn().mockResolvedValue(makeTaskType());
      (taskRepo.countByType as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      await service.deleteTaskType('type-1', undefined, 'user-1');

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'TASK_TYPE',
          action: 'DELETED',
          actorId: 'user-1',
        }),
      );
    });
  });
});
