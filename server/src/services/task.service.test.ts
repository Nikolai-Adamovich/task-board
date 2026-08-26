import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskService } from './task.service.js';
import type {
  TaskServiceUserRepo,
  TaskServiceSprintRepo,
  TaskServiceCommentRepo,
  TaskServiceRelationshipRepo,
} from './task.service.js';
import { TaskRepository } from '../repositories/task.repository.js';
import { CounterService } from './counter.service.js';
import { ProjectRepository } from '../repositories/project.repository.js';
import { ProjectMemberRepository } from '../repositories/project-member.repository.js';
import { StatusRepository } from '../repositories/status.repository.js';
import { TaskTypeRepository } from '../repositories/task-type.repository.js';
import type { AuditService } from './audit.service.js';
import type { Task } from '@task-board/shared';

function createMock<T>(methods: Record<string, unknown>): T {
  return methods as unknown as T;
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    projectId: 'project-1',
    number: 1,
    typeId: 'type-1',
    title: 'Test Task',
    description: null,
    statusId: 'status-1',
    priority: 'MEDIUM',
    reporterId: 'user-1',
    reporterSnapshot: { displayName: 'Reporter' },
    assigneeId: null,
    assigneeSnapshot: null,
    sprintId: null,
    labelIds: [],
    createdById: 'user-1',
    createdBySnapshot: { displayName: 'Creator' },
    version: 1,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('TaskService', () => {
  let taskRepo: TaskRepository;
  let counterService: CounterService;
  let projectRepo: ProjectRepository;
  let projectMemberRepo: ProjectMemberRepository;
  let statusRepo: StatusRepository;
  let taskTypeRepo: TaskTypeRepository;
  let userRepo: TaskServiceUserRepo;
  let sprintRepo: TaskServiceSprintRepo;
  let commentRepo: TaskServiceCommentRepo;
  let relationshipRepo: TaskServiceRelationshipRepo;
  let auditService: AuditService;
  let service: TaskService;

  beforeEach(() => {
    taskRepo = createMock<TaskRepository>({
      findById: vi.fn(),
      findByProject: vi.fn(),
      create: vi.fn(),
      updateWithVersion: vi.fn(),
      delete: vi.fn(),
      countByStatus: vi.fn(),
      updateManyByStatus: vi.fn(),
      search: vi.fn(),
      removeLabelFromAll: vi.fn(),
    });

    counterService = createMock<CounterService>({
      getNextTaskNumber: vi.fn().mockResolvedValue(1),
    });

    projectRepo = createMock<ProjectRepository>({
      findById: vi.fn().mockResolvedValue({ id: 'project-1', tenantId: 'tenant-1', status: 'ACTIVE' }),
    });

    projectMemberRepo = createMock<ProjectMemberRepository>({
      findByUserAndProject: vi.fn().mockResolvedValue({ role: 'EDITOR' }),
    });

    statusRepo = createMock<StatusRepository>({
      findById: vi.fn().mockResolvedValue({ id: 'status-1', projectId: 'project-1' }),
    });

    taskTypeRepo = createMock<TaskTypeRepository>({
      findById: vi.fn().mockResolvedValue({ id: 'type-1', projectId: 'project-1' }),
    });

    userRepo = {
      findById: vi.fn().mockResolvedValue({ id: 'user-1', displayName: 'Test User', email: 'test@test.com' }),
    };

    sprintRepo = {
      findById: vi.fn().mockResolvedValue({ id: 'sprint-1', projectId: 'project-1' }),
    };

    commentRepo = {
      deleteByTask: vi.fn().mockResolvedValue(undefined),
    };

    relationshipRepo = {
      deleteByTask: vi.fn().mockResolvedValue(undefined),
    };

    auditService = createMock<AuditService>({
      log: vi.fn().mockResolvedValue({}),
      queryByProject: vi.fn(),
      queryByTenant: vi.fn(),
    });

    service = new TaskService(
      taskRepo,
      counterService,
      projectRepo,
      projectMemberRepo,
      statusRepo,
      taskTypeRepo,
      userRepo,
      sprintRepo,
      commentRepo,
      relationshipRepo,
      auditService,
    );
  });

  describe('getTasksByProject', () => {
    it('returns paginated tasks', async () => {
      taskRepo.findByProject = vi.fn().mockResolvedValue({
        data: [makeTask()],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });

      const result = await service.getTasksByProject('project-1');

      expect(result.data).toHaveLength(1);
    });
  });

  describe('getTask', () => {
    it('returns task when found', async () => {
      taskRepo.findById = vi.fn().mockResolvedValue(makeTask());

      const result = await service.getTask('task-1');

      expect(result.title).toBe('Test Task');
    });

    it('throws NOT_FOUND when not found', async () => {
      taskRepo.findById = vi.fn().mockResolvedValue(null);

      await expect(service.getTask('missing')).rejects.toThrow('Task not found');
    });
  });

  // DEC-032: canonical task URLs resolve by project + human-readable number
  describe('getTaskByNumber', () => {
    it('resolves a task by projectId and number', async () => {
      taskRepo.findByProjectAndNumber = vi.fn().mockResolvedValue(makeTask({ number: 42 }));

      const result = await service.getTaskByNumber('project-1', 42);

      expect(taskRepo.findByProjectAndNumber).toHaveBeenCalledWith('project-1', 42);
      expect(result.number).toBe(42);
    });

    it('throws NOT_FOUND when no task matches the number', async () => {
      taskRepo.findByProjectAndNumber = vi.fn().mockResolvedValue(null);

      await expect(service.getTaskByNumber('project-1', 999)).rejects.toThrow('Task not found');
    });
  });

  describe('createTask', () => {
    it('creates a task with sequential number and snapshots', async () => {
      taskRepo.create = vi.fn().mockResolvedValue(makeTask());

      const result = await service.createTask('project-1', 'user-1', 'OWNER', undefined, {
        typeId: 'type-1',
        title: 'New Task',
        statusId: 'status-1',
        priority: 'MEDIUM',
      });

      expect(result.title).toBe('Test Task');
      expect(counterService.getNextTaskNumber).toHaveBeenCalledWith('project-1');
    });

    it('creates audit event on task creation', async () => {
      taskRepo.create = vi.fn().mockResolvedValue(makeTask());

      await service.createTask('project-1', 'user-1', 'OWNER', undefined, {
        typeId: 'type-1',
        title: 'New Task',
        statusId: 'status-1',
        priority: 'MEDIUM',
      });

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          projectId: 'project-1',
          entityType: 'TASK',
          entityId: 'task-1',
          action: 'CREATED',
          actorId: 'user-1',
        }),
      );
    });
  });

  describe('updateTask', () => {
    it('updates task with matching version', async () => {
      taskRepo.findById = vi.fn().mockResolvedValue(makeTask());
      taskRepo.updateWithVersion = vi.fn().mockResolvedValue(makeTask({ title: 'Updated', version: 2 }));

      const result = await service.updateTask('task-1', { title: 'Updated', version: 1 }, 'user-1');

      expect(result.title).toBe('Updated');
    });

    it('throws TASK_VERSION_CONFLICT on version mismatch', async () => {
      taskRepo.findById = vi.fn().mockResolvedValue(makeTask());

      await expect(service.updateTask('task-1', { title: 'X', version: 999 })).rejects.toThrow('concurrently');
    });

    it('creates audit event on task update with changes', async () => {
      taskRepo.findById = vi.fn().mockResolvedValue(makeTask());
      taskRepo.updateWithVersion = vi.fn().mockResolvedValue(makeTask({ title: 'Updated', version: 2 }));

      await service.updateTask('task-1', { title: 'Updated', version: 1 }, 'user-1');

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'TASK',
          action: 'UPDATED',
          actorId: 'user-1',
          changes: expect.arrayContaining([
            expect.objectContaining({ field: 'title', oldValue: 'Test Task', newValue: 'Updated' }),
          ]),
        }),
      );
    });
  });

  describe('deleteTask', () => {
    it('cascades delete (comments, relationships, then task)', async () => {
      taskRepo.findById = vi.fn().mockResolvedValue(makeTask());
      taskRepo.delete = vi.fn().mockResolvedValue(true);

      await service.deleteTask('task-1');

      expect(commentRepo.deleteByTask).toHaveBeenCalledWith('task-1');
      expect(relationshipRepo.deleteByTask).toHaveBeenCalledWith('task-1');
      expect(taskRepo.delete).toHaveBeenCalledWith('task-1');
    });

    it('creates audit event before task deletion', async () => {
      taskRepo.findById = vi.fn().mockResolvedValue(makeTask());
      taskRepo.delete = vi.fn().mockResolvedValue(true);

      await service.deleteTask('task-1', 'user-1');

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'TASK',
          action: 'DELETED',
          actorId: 'user-1',
        }),
      );

      // Audit should be called before delete
      const auditCallOrder = (auditService.log as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0];
      const deleteCallOrder = (taskRepo.delete as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0];

      expect(auditCallOrder).toBeLessThan(deleteCallOrder);
    });
  });

  // ── V2-4: project RBAC enforcement on id-based mutations ─────────────────

  describe('project RBAC enforcement (V2-4)', () => {
    it('denies updateTask for a project VIEWER even with a valid version', async () => {
      taskRepo.findById = vi.fn().mockResolvedValue(makeTask());
      projectMemberRepo.findByUserAndProject = vi.fn().mockResolvedValue({ role: 'VIEWER' });

      await expect(service.updateTask('task-1', { version: 1, title: 'hacked' }, 'user-1', 'MEMBER')).rejects.toThrow(
        'edit_task',
      );
      expect(taskRepo.updateWithVersion).not.toHaveBeenCalled();
    });

    it('allows updateTask for a project EDITOR', async () => {
      taskRepo.findById = vi.fn().mockResolvedValue(makeTask());
      taskRepo.updateWithVersion = vi.fn().mockResolvedValue(makeTask({ title: 'Updated' }));
      projectMemberRepo.findByUserAndProject = vi.fn().mockResolvedValue({ role: 'EDITOR' });

      const result = await service.updateTask('task-1', { version: 1, title: 'Updated' }, 'user-1', 'MEMBER');

      expect(result.title).toBe('Updated');
    });

    it('bypasses the project role for a tenant OWNER (no membership needed)', async () => {
      taskRepo.findById = vi.fn().mockResolvedValue(makeTask());
      taskRepo.updateWithVersion = vi.fn().mockResolvedValue(makeTask({ title: 'Admin edit' }));
      projectMemberRepo.findByUserAndProject = vi.fn().mockResolvedValue(null);

      const result = await service.updateTask('task-1', { version: 1, title: 'Admin edit' }, 'user-1', 'OWNER');

      expect(result.title).toBe('Admin edit');
    });

    it('denies deleteTask for a project EDITOR', async () => {
      taskRepo.findById = vi.fn().mockResolvedValue(makeTask());
      projectMemberRepo.findByUserAndProject = vi.fn().mockResolvedValue({ role: 'EDITOR' });

      await expect(service.deleteTask('task-1', 'user-1', 'MEMBER')).rejects.toThrow('delete_task');
      expect(taskRepo.delete).not.toHaveBeenCalled();
    });

    it('allows deleteTask for a project PROJECT_ADMIN', async () => {
      taskRepo.findById = vi.fn().mockResolvedValue(makeTask());
      taskRepo.delete = vi.fn().mockResolvedValue(true);
      projectMemberRepo.findByUserAndProject = vi.fn().mockResolvedValue({ role: 'PROJECT_ADMIN' });

      await service.deleteTask('task-1', 'user-1', 'MEMBER');

      expect(taskRepo.delete).toHaveBeenCalledWith('task-1');
    });
  });
});
