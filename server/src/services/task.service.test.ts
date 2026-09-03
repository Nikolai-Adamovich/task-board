import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskService } from './task.service.js';
import type {
  TaskServiceUserRepo,
  TaskServiceSprintRepo,
  TaskServiceCommentRepo,
  TaskServiceRelationshipRepo,
  TaskServiceBoardRepo,
} from './task.service.js';
import { decodeBoardCursor } from '@task-board/shared';
import type { BoardConfig } from '@task-board/shared';
import { NotFoundError, ValidationError } from '../errors/app-error.js';
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
    priorityLevel: 1,
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
      bulkUpdateWithVersion: vi.fn().mockResolvedValue([]),
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
      findById: vi.fn().mockResolvedValue({ id: 'status-1', projectId: 'project-1', name: 'Todo' }),
      findByIds: vi.fn().mockResolvedValue([{ id: 'status-1', projectId: 'project-1', name: 'Todo' }]),
    });

    taskTypeRepo = createMock<TaskTypeRepository>({
      findById: vi.fn().mockResolvedValue({ id: 'type-1', projectId: 'project-1' }),
      findByIds: vi.fn().mockResolvedValue([{ id: 'type-1', projectId: 'project-1' }]),
    });

    userRepo = {
      findById: vi.fn().mockResolvedValue({ id: 'user-1', displayName: 'Test User', email: 'test@test.com' }),
    };

    sprintRepo = {
      findById: vi.fn().mockResolvedValue({ id: 'sprint-1', projectId: 'project-1', name: 'Sprint 1' }),
      findByIds: vi.fn().mockResolvedValue([{ id: 'sprint-1', projectId: 'project-1', name: 'Sprint 1' }]),
    };

    commentRepo = {
      deleteByTask: vi.fn().mockResolvedValue(undefined),
    };

    relationshipRepo = {
      deleteByTask: vi.fn().mockResolvedValue(undefined),
    };

    auditService = createMock<AuditService>({
      log: vi.fn().mockResolvedValue({}),
      // TOP-3 №2: batched audit writes
      logMany: vi.fn().mockResolvedValue(undefined),
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

  describe('getBoardTasks', () => {
    it('maps the projected result to the exact BoardTask DTO — no description/reporter/timestamp leakage', async () => {
      taskRepo.findByProject = vi.fn().mockResolvedValue({
        data: [makeTask()],
        pagination: { page: 1, limit: 200, total: 1, totalPages: 1 },
      });

      const result = await service.getBoardTasks('project-1');
      const [boardTask] = result.data;

      expect(taskRepo.findByProject).toHaveBeenCalledWith('project-1', { view: 'board' });
      expect(boardTask).toEqual({
        id: expect.any(String),
        number: expect.any(Number),
        title: expect.any(String),
        typeId: expect.any(String),
        statusId: expect.any(String),
        priorityLevel: expect.any(Number),
        assigneeId: null,
        assigneeSnapshot: null,
        version: 1,
      });
      // Explicit no-leakage proof: the serialized DTO carries exactly the card fields
      expect(Object.keys(boardTask ?? {}).sort()).toEqual([
        'assigneeId',
        'assigneeSnapshot',
        'id',
        'number',
        'priorityLevel',
        'statusId',
        'title',
        'typeId',
        'version',
      ]);
    });
  });

  describe('getTask', () => {
    it('returns task when found', async () => {
      taskRepo.findById = vi.fn().mockResolvedValue(makeTask());

      const result = await service.getTask('task-1', 'tenant-1');

      expect(result.title).toBe('Test Task');
    });

    it('throws NOT_FOUND when not found', async () => {
      taskRepo.findById = vi.fn().mockResolvedValue(null);

      await expect(service.getTask('missing', 'tenant-1')).rejects.toThrow('Task not found');
    });

    it('throws NOT_FOUND (not 403) when the task belongs to another tenant (M-02)', async () => {
      taskRepo.findById = vi.fn().mockResolvedValue(makeTask());
      projectRepo.findById = vi.fn().mockResolvedValue({ id: 'project-1', tenantId: 'tenant-OTHER' });

      await expect(service.getTask('task-1', 'tenant-1')).rejects.toMatchObject({
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    });
  });

  describe('getTaskByKey (S-04)', () => {
    it('resolves the project within the caller tenant and returns the task', async () => {
      projectRepo.findByTenantAndKey = vi.fn().mockResolvedValue({ id: 'project-1', tenantId: 'tenant-1' });
      taskRepo.findByProjectAndNumber = vi.fn().mockResolvedValue(makeTask({ number: 7 }));

      const result = await service.getTaskByKey('tenant-1', 'PRO', 7);

      expect(projectRepo.findByTenantAndKey).toHaveBeenCalledWith('tenant-1', 'PRO');
      expect(result.number).toBe(7);
    });

    it('throws NOT_FOUND when the key belongs to a project of another tenant (S-04)', async () => {
      projectRepo.findByTenantAndKey = vi.fn().mockResolvedValue(null);
      taskRepo.findByProjectAndNumber = vi.fn();

      await expect(service.getTaskByKey('tenant-1', 'OTHER', 1)).rejects.toMatchObject({
        statusCode: 404,
        code: 'NOT_FOUND',
      });
      expect(taskRepo.findByProjectAndNumber).not.toHaveBeenCalled();
    });

    it('throws NOT_FOUND when no task matches the number', async () => {
      projectRepo.findByTenantAndKey = vi.fn().mockResolvedValue({ id: 'project-1', tenantId: 'tenant-1' });
      taskRepo.findByProjectAndNumber = vi.fn().mockResolvedValue(null);

      await expect(service.getTaskByKey('tenant-1', 'PRO', 999)).rejects.toThrow('Task not found');
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
        priorityLevel: 1,
      });

      expect(result.title).toBe('Test Task');
      expect(counterService.getNextTaskNumber).toHaveBeenCalledWith('project-1');
    });

    it('M-14: resolves refs with ONE batched findByIds per repo (no sequential findById)', async () => {
      taskRepo.create = vi.fn().mockResolvedValue(makeTask());

      await service.createTask('project-1', 'user-1', 'OWNER', undefined, {
        typeId: 'type-1',
        title: 'New Task',
        statusId: 'status-1',
        priorityLevel: 1,
        sprintId: 'sprint-1',
      });

      expect(taskTypeRepo.findByIds).toHaveBeenCalledTimes(1);
      expect(taskTypeRepo.findByIds).toHaveBeenCalledWith(['type-1']);
      expect(statusRepo.findByIds).toHaveBeenCalledTimes(1);
      expect(statusRepo.findByIds).toHaveBeenCalledWith(['status-1']);
      expect(sprintRepo.findByIds).toHaveBeenCalledTimes(1);
      expect(sprintRepo.findByIds).toHaveBeenCalledWith(['sprint-1']);
      expect(taskTypeRepo.findById).not.toHaveBeenCalled();
      expect(statusRepo.findById).not.toHaveBeenCalled();
      expect(sprintRepo.findById).not.toHaveBeenCalled();
    });

    it('creates audit event on task creation', async () => {
      taskRepo.create = vi.fn().mockResolvedValue(makeTask());

      await service.createTask('project-1', 'user-1', 'OWNER', undefined, {
        typeId: 'type-1',
        title: 'New Task',
        statusId: 'status-1',
        priorityLevel: 1,
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
      const deleteCallOrder = (taskRepo.delete as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0] ?? Number.NaN;

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

  // ─── TOP-3 №1: bulkUpdateTasks via ONE bulkWrite ──────────────────────────

  describe('bulkUpdateTasks (TOP-3 №1: single bulkWrite)', () => {
    function makeAssignedTask(id: string, version: number) {
      return makeTask({ id, version, statusId: 'status-old' });
    }

    it('updates several tasks via one bulkWrite and reports per-task success', async () => {
      const t1 = makeAssignedTask('t1', 1);
      const t2 = makeAssignedTask('t2', 3);

      taskRepo.findByIds = vi.fn().mockResolvedValue([t1, t2]);
      taskRepo.bulkUpdateWithVersion = vi.fn().mockResolvedValue([
        { ...t1, version: 2, statusId: 'status-2', statusName: 'Done' },
        { ...t2, version: 4, statusId: 'status-2', statusName: 'Done' },
      ]);

      const result = await service.bulkUpdateTasks('project-1', ['t1', 't2'], { statusId: 'status-2' });

      expect(result.updated).toBe(2);
      expect(result.failed).toBeUndefined();
      // TOP-2 semantics preserved: the denormalized name travels with the change
      expect(taskRepo.bulkUpdateWithVersion).toHaveBeenCalledWith(
        [
          { id: 't1', version: 1 },
          { id: 't2', version: 3 },
        ],
        { statusId: 'status-2', statusName: 'Todo' },
      );
    });

    it('reports VERSION_CONFLICT per task when the version did not match', async () => {
      const t1 = makeAssignedTask('t1', 1);
      const t2 = makeAssignedTask('t2', 5);

      taskRepo.findByIds = vi.fn().mockResolvedValue([t1, t2]);
      // bulkWrite applies only matching versions → t2 is absent from the result
      taskRepo.bulkUpdateWithVersion = vi.fn().mockResolvedValue([{ ...t1, version: 2, statusId: 'status-2' }]);

      const result = await service.bulkUpdateTasks('project-1', ['t1', 't2'], { statusId: 'status-2' });

      expect(result.updated).toBe(1);
      expect(result.failed).toEqual([{ taskId: 't2', reason: 'VERSION_CONFLICT' }]);
    });

    it('keeps TASK_NOT_FOUND and TASK_NOT_IN_PROJECT per-id failures', async () => {
      // belongs to another project → must be rejected as TASK_NOT_IN_PROJECT
      const foreign = { ...makeAssignedTask('t-foreign', 1), projectId: 'project-other' };

      taskRepo.findByIds = vi.fn().mockResolvedValue([foreign, makeAssignedTask('t1', 1)]);
      taskRepo.bulkUpdateWithVersion = vi.fn().mockResolvedValue([{ ...makeAssignedTask('t1', 1), version: 2 }]);

      const result = await service.bulkUpdateTasks('project-1', ['t-missing', 't-foreign', 't1'], {
        statusId: 'status-2',
      });

      expect(result.updated).toBe(1);
      expect(result.failed).toEqual([
        { taskId: 't-missing', reason: 'TASK_NOT_FOUND' },
        { taskId: 't-foreign', reason: 'TASK_NOT_IN_PROJECT' },
      ]);
    });

    it('keeps the sprint denormalized name in the payload and nulls it when clearing', async () => {
      const t1 = makeAssignedTask('t1', 1);

      taskRepo.findByIds = vi.fn().mockResolvedValue([t1]);
      taskRepo.bulkUpdateWithVersion = vi
        .fn()
        .mockResolvedValue([{ ...t1, version: 2, sprintId: 'sprint-1', sprintName: 'Sprint 1' }]);

      await service.bulkUpdateTasks('project-1', ['t1'], { sprintId: 'sprint-1' });

      expect(taskRepo.bulkUpdateWithVersion).toHaveBeenCalledWith([{ id: 't1', version: 1 }], {
        sprintId: 'sprint-1',
        sprintName: 'Sprint 1',
      });

      await service.bulkUpdateTasks('project-1', ['t1'], { sprintId: null });

      expect(taskRepo.bulkUpdateWithVersion).toHaveBeenLastCalledWith([{ id: 't1', version: 1 }], {
        sprintId: null,
        sprintName: null,
      });
    });

    it('TOP-3 №2: persists audit events as ONE batch (logMany), not per-task log()', async () => {
      const t1 = makeAssignedTask('t1', 1);
      const t2 = makeAssignedTask('t2', 2);

      taskRepo.findByIds = vi.fn().mockResolvedValue([t1, t2]);
      taskRepo.bulkUpdateWithVersion = vi.fn().mockResolvedValue([
        { ...t1, version: 2, statusId: 'status-2' },
        { ...t2, version: 3, statusId: 'status-2' },
      ]);

      await service.bulkUpdateTasks('project-1', ['t1', 't2'], { statusId: 'status-2' }, 'user-1');

      expect(auditService.log).not.toHaveBeenCalled();
      expect(auditService.logMany).toHaveBeenCalledTimes(1);
      expect(auditService.logMany).toHaveBeenCalledWith('user-1', [
        expect.objectContaining({
          projectId: 'project-1',
          entityType: 'TASK',
          entityId: 't1',
          action: 'UPDATED',
          changes: [{ field: 'statusId', oldValue: 'status-old', newValue: 'status-2' }],
        }),
        expect.objectContaining({
          entityId: 't2',
          changes: [{ field: 'statusId', oldValue: 'status-old', newValue: 'status-2' }],
        }),
      ]);
    });

    it('TOP-3 №2: creates no audit event for a task that was not updated (version conflict)', async () => {
      const t1 = makeAssignedTask('t1', 1);
      const t2 = makeAssignedTask('t2', 5);

      taskRepo.findByIds = vi.fn().mockResolvedValue([t1, t2]);
      // t2 conflicts — absent from the bulkWrite result
      taskRepo.bulkUpdateWithVersion = vi.fn().mockResolvedValue([{ ...t1, version: 2, statusId: 'status-2' }]);

      await service.bulkUpdateTasks('project-1', ['t1', 't2'], { statusId: 'status-2' }, 'user-1');

      const logManyMock = auditService.logMany as unknown as ReturnType<typeof vi.fn>;
      const events = (logManyMock.mock.calls.at(0)?.[1] ?? []) as {
        entityId: string;
      }[];

      expect(events).toHaveLength(1);
      expect(events[0]?.entityId).toBe('t1');
    });
  });

  describe('getBoardPages (one HTTP request, parallel column queries)', () => {
    const COL_A = '550e8400-e29b-41d4-a716-4466554400a1';
    const COL_B = '550e8400-e29b-41d4-a716-4466554400b2';

    function makeBoard(): BoardConfig {
      return {
        projectId: 'project-1',
        columns: [
          { id: COL_A, statusIds: ['status-1', 'status-2'], position: 0 },
          { id: COL_B, statusIds: ['status-2'], position: 1 },
        ],
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      };
    }

    function boardService(board: BoardConfig | null) {
      const boardRepo = createMock<TaskServiceBoardRepo>({
        findByProject: vi.fn().mockResolvedValue(board),
      });

      // Default (tests that need data assign their own mock first).
      if (!taskRepo.findBoardPage) taskRepo.findBoardPage = vi.fn();

      return new TaskService(
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
        boardRepo,
      );
    }

    it('loads the first page of every column on initial load with exclusive statuses', async () => {
      taskRepo.findBoardPage = vi
        .fn()
        .mockResolvedValueOnce({
          tasks: [makeTask({ id: 't1', statusId: 'status-1', number: 1 })],
          hasMore: true,
          nextCursor: { priorityLevel: 1, number: 1 },
        })
        .mockResolvedValueOnce({ tasks: [], hasMore: false, nextCursor: null });

      const page = await boardService(makeBoard()).getBoardPages('project-1');

      // COL_B owns status-2 (most specific column wins — V4-12 parity), so
      // COL_A is queried with the exclusive remainder only.
      expect(taskRepo.findBoardPage).toHaveBeenCalledTimes(2);
      expect(taskRepo.findBoardPage).toHaveBeenCalledWith('project-1', {
        statusIds: ['status-1'],
        cursor: null,
        sprintId: undefined,
        assigneeId: undefined,
        priorityLevel: undefined,
      });
      expect(taskRepo.findBoardPage).toHaveBeenCalledWith('project-1', {
        statusIds: ['status-2'],
        cursor: null,
        sprintId: undefined,
        assigneeId: undefined,
        priorityLevel: undefined,
      });
      expect(Object.keys(page).sort()).toEqual([COL_A, COL_B].sort());
      // Exact BoardTask DTO shape — no description/reporter/timestamp leakage.
      expect(page[COL_A]?.tasks[0]).toEqual({
        id: 't1',
        number: 1,
        title: 'Test Task',
        typeId: 'type-1',
        statusId: 'status-1',
        priorityLevel: 1,
        assigneeId: null,
        assigneeSnapshot: null,
        version: 1,
      });
      expect(page[COL_A]?.hasMore).toBe(true);
      expect(decodeBoardCursor(page[COL_A]?.nextCursor)).toEqual({ priorityLevel: 1, number: 1 });
      expect(page[COL_B]).toEqual({ tasks: [], hasMore: false, nextCursor: null });
    });

    it('loads only the requested columns on follow-up pages and forwards filters', async () => {
      taskRepo.findBoardPage = vi.fn().mockResolvedValue({ tasks: [], hasMore: false, nextCursor: null });

      await boardService(makeBoard()).getBoardPages('project-1', {
        cursors: { [COL_B]: { priorityLevel: 2, number: 184 } },
        sprintId: 'sprint-1',
        assigneeId: 'user-2',
        priorityLevel: 3,
      });

      expect(taskRepo.findBoardPage).toHaveBeenCalledTimes(1);
      expect(taskRepo.findBoardPage).toHaveBeenCalledWith('project-1', {
        statusIds: ['status-2'],
        cursor: { priorityLevel: 2, number: 184 },
        sprintId: 'sprint-1',
        assigneeId: 'user-2',
        priorityLevel: 3,
      });
    });

    it('throws NOT_FOUND when the project has no board', async () => {
      await expect(boardService(null).getBoardPages('project-1')).rejects.toThrow(NotFoundError);
    });

    it('BoardTask response does not contain projectId or description', async () => {
      taskRepo.findBoardPage = vi.fn().mockResolvedValue({
        tasks: [makeTask({ description: 'should never leak' })],
        hasMore: false,
        nextCursor: null,
      });

      const page = await boardService(makeBoard()).getBoardPages('project-1');
      const card = page[COL_A]?.tasks[0] ?? {};

      expect('projectId' in card).toBe(false);
      expect('description' in card).toBe(false);
      expect(Object.keys(card).sort()).toEqual([
        'assigneeId',
        'assigneeSnapshot',
        'id',
        'number',
        'priorityLevel',
        'statusId',
        'title',
        'typeId',
        'version',
      ]);
    });

    it('throws a 400 ValidationError for unknown column ids (no statusIds injection)', async () => {
      await expect(
        boardService(makeBoard()).getBoardPages('project-1', {
          cursors: { '550e8400-e29b-41d4-a716-446655440099': { priorityLevel: 1, number: 1 } },
        }),
      ).rejects.toThrow(ValidationError);

      expect(taskRepo.findBoardPage).not.toHaveBeenCalled();
    });
  });
});
