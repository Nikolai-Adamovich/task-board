import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusService } from './status.service.js';
import type { StatusServiceTaskRepo, StatusServiceBoardRepo, StatusServiceProjectRepo } from './status.service.js';
import { StatusRepository } from '../repositories/status.repository.js';
import type { AuditService } from './audit.service.js';
import type { Status } from '@task-board/shared';

// ─── Mock Factories ──────────────────────────────────────────────────────────

function createMockStatusRepo() {
  return {
    findById: vi.fn(),
    findByProject: vi.fn(),
    findByProjectAndNormalizedName: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  } as unknown as StatusRepository;
}

function createMockTaskRepo(): StatusServiceTaskRepo {
  return {
    countByStatus: vi.fn().mockResolvedValue(0),
    updateManyByStatus: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockBoardRepo(): StatusServiceBoardRepo {
  return {
    replaceStatusInColumns: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockProjectRepo(): StatusServiceProjectRepo {
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

function makeStatus(overrides: Partial<Status> = {}): Status {
  return {
    id: 'status-1',
    projectId: 'project-1',
    name: 'TODO',
    normalizedName: 'todo',
    position: 0,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('StatusService', () => {
  let statusRepo: ReturnType<typeof createMockStatusRepo>;
  let taskRepo: StatusServiceTaskRepo;
  let boardRepo: StatusServiceBoardRepo;
  let projectRepo: StatusServiceProjectRepo;
  let auditService: AuditService;
  let service: StatusService;

  beforeEach(() => {
    statusRepo = createMockStatusRepo();
    taskRepo = createMockTaskRepo();
    boardRepo = createMockBoardRepo();
    projectRepo = createMockProjectRepo();
    auditService = createMockAuditService();
    service = new StatusService(statusRepo, taskRepo, boardRepo, projectRepo, auditService);
  });

  // ── V2-4: manage_statuses enforcement ────────────────────────────────────

  describe('manage_statuses enforcement (V2-4)', () => {
    let projectMemberRepo: { findByUserAndProject: ReturnType<typeof vi.fn> };

    beforeEach(() => {
      projectMemberRepo = { findByUserAndProject: vi.fn().mockResolvedValue(null) };
      service = new StatusService(statusRepo, taskRepo, boardRepo, projectRepo, auditService, projectMemberRepo);
    });

    it('denies createStatus for a VIEWER', async () => {
      projectMemberRepo.findByUserAndProject.mockResolvedValue({ role: 'VIEWER' });

      await expect(service.createStatus('project-1', { name: 'New', position: 5 }, 'user-1', 'MEMBER')).rejects.toThrow(
        'manage_statuses',
      );
      expect(statusRepo.create).not.toHaveBeenCalled();
    });

    it('allows createStatus for a PROJECT_ADMIN', async () => {
      statusRepo.findByProjectAndNormalizedName = vi.fn().mockResolvedValue(null);
      statusRepo.create = vi.fn().mockResolvedValue(makeStatus({ id: 'status-new', name: 'New' }));
      projectMemberRepo.findByUserAndProject.mockResolvedValue({ role: 'PROJECT_ADMIN' });

      const status = await service.createStatus('project-1', { name: 'New', position: 5 }, 'user-1', 'MEMBER');

      expect(status.id).toBe('status-new');
    });

    it('denies deleteStatus for an EDITOR (id-based route — service is the only gate)', async () => {
      statusRepo.findById = vi.fn().mockResolvedValue(makeStatus());
      projectMemberRepo.findByUserAndProject.mockResolvedValue({ role: 'EDITOR' });

      await expect(service.deleteStatus('status-1', undefined, 'user-1', 'MEMBER')).rejects.toThrow('manage_statuses');
      expect(statusRepo.delete).not.toHaveBeenCalled();
    });

    it('bypasses the project role for a tenant ADMIN', async () => {
      statusRepo.findById = vi.fn().mockResolvedValue(makeStatus());
      statusRepo.delete = vi.fn().mockResolvedValue(true);
      // no membership record at all
      projectMemberRepo.findByUserAndProject.mockResolvedValue(null);

      await service.deleteStatus('status-1', undefined, 'user-1', 'ADMIN');

      expect(statusRepo.delete).toHaveBeenCalledWith('status-1');
    });
  });

  describe('getStatusesByProject', () => {
    it('returns all statuses for a project', async () => {
      statusRepo.findByProject = vi.fn().mockResolvedValue([makeStatus()]);

      const result = await service.getStatusesByProject('project-1');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('TODO');
    });
  });

  describe('createStatus', () => {
    it('creates a status when name is unique', async () => {
      statusRepo.findByProjectAndNormalizedName = vi.fn().mockResolvedValue(null);
      statusRepo.create = vi.fn().mockResolvedValue(makeStatus());

      const result = await service.createStatus('project-1', { name: 'TODO', position: 0 }, 'user-1');

      expect(result.name).toBe('TODO');
      expect(statusRepo.create).toHaveBeenCalledWith('project-1', { name: 'TODO', position: 0 });
    });

    it('throws DUPLICATE_STATUS when name exists (case-insensitive)', async () => {
      statusRepo.findByProjectAndNormalizedName = vi.fn().mockResolvedValue(makeStatus());

      await expect(service.createStatus('project-1', { name: 'todo', position: 0 })).rejects.toThrow(
        'A status with this name already exists',
      );
    });

    it('creates audit event on status creation', async () => {
      statusRepo.findByProjectAndNormalizedName = vi.fn().mockResolvedValue(null);
      statusRepo.create = vi.fn().mockResolvedValue(makeStatus());

      await service.createStatus('project-1', { name: 'TODO', position: 0 }, 'user-1');

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          projectId: 'project-1',
          entityType: 'STATUS',
          entityId: 'status-1',
          action: 'CREATED',
          actorId: 'user-1',
        }),
      );
    });
  });

  describe('updateStatus', () => {
    it('updates name and normalizedName when name changes', async () => {
      statusRepo.findById = vi.fn().mockResolvedValue(makeStatus());
      statusRepo.findByProjectAndNormalizedName = vi.fn().mockResolvedValue(null);
      statusRepo.update = vi.fn().mockResolvedValue(makeStatus({ name: 'In Progress', normalizedName: 'in progress' }));

      await service.updateStatus('status-1', { name: 'In Progress' });

      expect(statusRepo.update).toHaveBeenCalledWith('status-1', {
        name: 'In Progress',
        normalizedName: 'in progress',
      });
    });

    it('throws DUPLICATE_STATUS when new name conflicts', async () => {
      statusRepo.findById = vi.fn().mockResolvedValue(makeStatus());
      statusRepo.findByProjectAndNormalizedName = vi.fn().mockResolvedValue(makeStatus({ id: 'status-2' }));

      await expect(service.updateStatus('status-1', { name: 'IN_PROGRESS' })).rejects.toThrow(
        'A status with this name already exists',
      );
    });

    it('creates audit event on status update', async () => {
      statusRepo.findById = vi.fn().mockResolvedValue(makeStatus());
      statusRepo.findByProjectAndNormalizedName = vi.fn().mockResolvedValue(null);
      statusRepo.update = vi.fn().mockResolvedValue(makeStatus({ name: 'In Progress', normalizedName: 'in progress' }));

      await service.updateStatus('status-1', { name: 'In Progress' }, 'user-1');

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'STATUS',
          action: 'UPDATED',
          actorId: 'user-1',
          changes: expect.arrayContaining([
            expect.objectContaining({ field: 'name', oldValue: 'TODO', newValue: 'In Progress' }),
          ]),
        }),
      );
    });
  });

  describe('deleteStatus', () => {
    it('deletes status not in use', async () => {
      statusRepo.findById = vi.fn().mockResolvedValue(makeStatus());
      (taskRepo.countByStatus as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      await service.deleteStatus('status-1');

      expect(statusRepo.delete).toHaveBeenCalledWith('status-1');
    });

    it('throws STATUS_IN_USE when status is in use without replacement', async () => {
      statusRepo.findById = vi.fn().mockResolvedValue(makeStatus());
      (taskRepo.countByStatus as ReturnType<typeof vi.fn>).mockResolvedValue(5);

      await expect(service.deleteStatus('status-1')).rejects.toThrow('Status is in use by tasks');
    });

    it('uses STATUS_IN_USE error code (not INVALID_STATUS_REPLACEMENT)', async () => {
      statusRepo.findById = vi.fn().mockResolvedValue(makeStatus());
      (taskRepo.countByStatus as ReturnType<typeof vi.fn>).mockResolvedValue(5);

      try {
        await service.deleteStatus('status-1');
        expect.fail('Should have thrown');
      } catch (error: unknown) {
        const err = error as { code: string };

        expect(err.code).toBe('STATUS_IN_USE');
      }
    });

    it('updates tasks and board columns when replacement provided', async () => {
      statusRepo.findById = vi.fn().mockResolvedValue(makeStatus());
      (taskRepo.countByStatus as ReturnType<typeof vi.fn>).mockResolvedValue(5);
      statusRepo.findById = vi
        .fn()
        .mockResolvedValueOnce(makeStatus()) // first call: the status being deleted
        .mockResolvedValueOnce(makeStatus({ id: 'status-2', name: 'IN_PROGRESS' })); // replacement

      await service.deleteStatus('status-1', 'status-2');

      expect(taskRepo.updateManyByStatus).toHaveBeenCalledWith('project-1', 'status-1', 'status-2');
      expect(boardRepo.replaceStatusInColumns).toHaveBeenCalledWith('project-1', 'status-1', 'status-2');
      expect(statusRepo.delete).toHaveBeenCalledWith('status-1');
    });

    it('creates audit event on status deletion', async () => {
      statusRepo.findById = vi.fn().mockResolvedValue(makeStatus());
      (taskRepo.countByStatus as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      await service.deleteStatus('status-1', undefined, 'user-1');

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'STATUS',
          action: 'DELETED',
          actorId: 'user-1',
        }),
      );
    });
  });
});
