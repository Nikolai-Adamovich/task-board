import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LabelService } from './label.service.js';
import type { LabelRepository } from '../repositories/label.repository.js';
import type { LabelServiceTaskRepo, LabelServiceProjectRepo, LabelServiceProjectMemberRepo } from './label.service.js';
import type { AuditService } from './audit.service.js';
import { ConflictError, ForbiddenError, NotFoundError } from '../errors/app-error.js';
import type { Label } from '@task-board/shared';

// ─── Mock Factories ──────────────────────────────────────────────────────────

function createMockLabelRepo() {
  return {
    findByProject: vi.fn(),
    findByProjectAndNormalizedName: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  } as unknown as LabelRepository;
}

function createMockTaskRepo() {
  return {
    removeLabelFromAll: vi.fn(),
  } as unknown as LabelServiceTaskRepo;
}

function createMockProjectRepo() {
  return {
    findById: vi.fn().mockResolvedValue({ tenantId: 'tenant-1' }),
  } as unknown as LabelServiceProjectRepo;
}

function createMockProjectMemberRepo(role: string | null) {
  return {
    findByUserAndProject: vi.fn().mockResolvedValue(role ? { role } : null),
  } as unknown as LabelServiceProjectMemberRepo;
}

function createMockAuditService() {
  return {
    log: vi.fn().mockResolvedValue(undefined),
  } as unknown as AuditService;
}

function makeLabel(overrides: Partial<Label> = {}): Label {
  return {
    id: 'label-1',
    projectId: 'project-1',
    name: 'bug',
    color: '#ff0000',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  } as Label;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('LabelService', () => {
  let labelRepo: ReturnType<typeof createMockLabelRepo>;
  let taskRepo: ReturnType<typeof createMockTaskRepo>;
  let projectRepo: ReturnType<typeof createMockProjectRepo>;
  let auditService: ReturnType<typeof createMockAuditService>;

  beforeEach(() => {
    labelRepo = createMockLabelRepo();
    taskRepo = createMockTaskRepo();
    projectRepo = createMockProjectRepo();
    auditService = createMockAuditService();
  });

  describe('getLabelsByProject', () => {
    it('returns all labels for a project', async () => {
      labelRepo.findByProject = vi.fn().mockResolvedValue([makeLabel()]);

      const service = new LabelService(labelRepo, taskRepo);
      const result = await service.getLabelsByProject('project-1');

      expect(result).toHaveLength(1);
      expect(labelRepo.findByProject).toHaveBeenCalledWith('project-1');
    });
  });

  describe('createLabel', () => {
    const input = { name: 'Bug', color: '#ff0000' };

    it('creates a label for a project admin', async () => {
      labelRepo.findByProjectAndNormalizedName = vi.fn().mockResolvedValue(null);
      labelRepo.create = vi.fn().mockResolvedValue(makeLabel());

      const service = new LabelService(
        labelRepo,
        taskRepo,
        projectRepo,
        auditService,
        createMockProjectMemberRepo('PROJECT_ADMIN'),
      );
      const result = await service.createLabel('project-1', input, 'user-1', 'MEMBER');

      expect(result.name).toBe('bug');
      expect(labelRepo.create).toHaveBeenCalledWith('project-1', input);
    });

    it('allows tenant admins without project membership (RBAC bypass)', async () => {
      labelRepo.findByProjectAndNormalizedName = vi.fn().mockResolvedValue(null);
      labelRepo.create = vi.fn().mockResolvedValue(makeLabel());

      const service = new LabelService(
        labelRepo,
        taskRepo,
        projectRepo,
        auditService,
        createMockProjectMemberRepo(null),
      );
      const result = await service.createLabel('project-1', input, 'user-1', 'ADMIN');

      expect(result.name).toBe('bug');
    });

    it('throws ForbiddenError for a viewer (manage_labels denied)', async () => {
      const service = new LabelService(
        labelRepo,
        taskRepo,
        projectRepo,
        auditService,
        createMockProjectMemberRepo('VIEWER'),
      );

      await expect(service.createLabel('project-1', input, 'user-1', 'MEMBER')).rejects.toThrow(ForbiddenError);
      expect(labelRepo.create).not.toHaveBeenCalled();
    });

    it('throws ForbiddenError when membership lookup is unavailable', async () => {
      const service = new LabelService(labelRepo, taskRepo);

      await expect(service.createLabel('project-1', input, 'user-1', 'MEMBER')).rejects.toThrow(
        'Project membership lookup is unavailable',
      );
    });

    it('throws ConflictError on duplicate normalized name', async () => {
      labelRepo.findByProjectAndNormalizedName = vi.fn().mockResolvedValue(makeLabel());

      const service = new LabelService(
        labelRepo,
        taskRepo,
        projectRepo,
        auditService,
        createMockProjectMemberRepo('PROJECT_ADMIN'),
      );

      await expect(service.createLabel('project-1', input, 'user-1', 'MEMBER')).rejects.toThrow(ConflictError);
      expect(labelRepo.create).not.toHaveBeenCalled();
    });

    it('writes an audit event when audit service and project repo are present', async () => {
      labelRepo.findByProjectAndNormalizedName = vi.fn().mockResolvedValue(null);
      labelRepo.create = vi.fn().mockResolvedValue(makeLabel());

      const service = new LabelService(
        labelRepo,
        taskRepo,
        projectRepo,
        auditService,
        createMockProjectMemberRepo('PROJECT_ADMIN'),
      );

      await service.createLabel('project-1', input, 'user-1', 'MEMBER');

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ entityType: 'LABEL', action: 'CREATED', actorId: 'user-1' }),
      );
    });
  });

  describe('updateLabel', () => {
    const input = { name: 'Defect', color: '#00ff00' };

    it('updates a label for a project admin', async () => {
      labelRepo.findById = vi.fn().mockResolvedValue(makeLabel());
      labelRepo.findByProjectAndNormalizedName = vi.fn().mockResolvedValue(null);
      labelRepo.update = vi.fn().mockResolvedValue(makeLabel({ name: 'Defect' }));

      const service = new LabelService(
        labelRepo,
        taskRepo,
        projectRepo,
        auditService,
        createMockProjectMemberRepo('PROJECT_ADMIN'),
      );
      const result = await service.updateLabel('label-1', input, 'user-1', 'MEMBER');

      expect(result.name).toBe('Defect');
      expect(labelRepo.update).toHaveBeenCalledWith('label-1', { name: 'Defect', normalizedName: 'defect' });
    });

    it('throws NotFoundError when the label does not exist', async () => {
      labelRepo.findById = vi.fn().mockResolvedValue(null);

      const service = new LabelService(labelRepo, taskRepo);

      await expect(service.updateLabel('missing', input, 'user-1', 'MEMBER')).rejects.toThrow(NotFoundError);
    });

    it('throws ForbiddenError for a viewer', async () => {
      labelRepo.findById = vi.fn().mockResolvedValue(makeLabel());

      const service = new LabelService(
        labelRepo,
        taskRepo,
        projectRepo,
        auditService,
        createMockProjectMemberRepo('VIEWER'),
      );

      await expect(service.updateLabel('label-1', input, 'user-1', 'MEMBER')).rejects.toThrow(ForbiddenError);
    });

    it('throws ConflictError when another label with the same name exists', async () => {
      labelRepo.findById = vi.fn().mockResolvedValue(makeLabel());
      labelRepo.findByProjectAndNormalizedName = vi.fn().mockResolvedValue(makeLabel({ id: 'label-2' }));

      const service = new LabelService(
        labelRepo,
        taskRepo,
        projectRepo,
        auditService,
        createMockProjectMemberRepo('PROJECT_ADMIN'),
      );

      await expect(service.updateLabel('label-1', input, 'user-1', 'MEMBER')).rejects.toThrow(ConflictError);
    });

    it('allows renaming to the same normalized name (self-match)', async () => {
      labelRepo.findById = vi.fn().mockResolvedValue(makeLabel());
      labelRepo.findByProjectAndNormalizedName = vi.fn().mockResolvedValue(makeLabel());
      labelRepo.update = vi.fn().mockResolvedValue(makeLabel({ name: 'Defect' }));

      const service = new LabelService(
        labelRepo,
        taskRepo,
        projectRepo,
        auditService,
        createMockProjectMemberRepo('PROJECT_ADMIN'),
      );
      const result = await service.updateLabel('label-1', input, 'user-1', 'MEMBER');

      expect(result.name).toBe('Defect');
    });

    it('throws NotFoundError when the update returns null', async () => {
      labelRepo.findById = vi.fn().mockResolvedValue(makeLabel());
      labelRepo.findByProjectAndNormalizedName = vi.fn().mockResolvedValue(null);
      labelRepo.update = vi.fn().mockResolvedValue(null);

      const service = new LabelService(
        labelRepo,
        taskRepo,
        projectRepo,
        auditService,
        createMockProjectMemberRepo('PROJECT_ADMIN'),
      );

      await expect(service.updateLabel('label-1', input, 'user-1', 'MEMBER')).rejects.toThrow(NotFoundError);
    });
  });

  describe('deleteLabel', () => {
    it('deletes a label and removes task associations for a project admin', async () => {
      labelRepo.findById = vi.fn().mockResolvedValue(makeLabel());
      labelRepo.delete = vi.fn().mockResolvedValue(undefined);

      const service = new LabelService(
        labelRepo,
        taskRepo,
        projectRepo,
        auditService,
        createMockProjectMemberRepo('PROJECT_ADMIN'),
      );

      await service.deleteLabel('label-1', 'user-1', 'MEMBER');

      expect(taskRepo.removeLabelFromAll).toHaveBeenCalledWith('project-1', 'label-1');
      expect(labelRepo.delete).toHaveBeenCalledWith('label-1');
    });

    it('throws NotFoundError when the label does not exist', async () => {
      labelRepo.findById = vi.fn().mockResolvedValue(null);

      const service = new LabelService(labelRepo, taskRepo);

      await expect(service.deleteLabel('missing', 'user-1', 'MEMBER')).rejects.toThrow(NotFoundError);
    });

    it('throws ForbiddenError for a viewer', async () => {
      labelRepo.findById = vi.fn().mockResolvedValue(makeLabel());

      const service = new LabelService(
        labelRepo,
        taskRepo,
        projectRepo,
        auditService,
        createMockProjectMemberRepo('VIEWER'),
      );

      await expect(service.deleteLabel('label-1', 'user-1', 'MEMBER')).rejects.toThrow(ForbiddenError);
      expect(taskRepo.removeLabelFromAll).not.toHaveBeenCalled();
    });

    it('writes a DELETED audit event before deleting', async () => {
      labelRepo.findById = vi.fn().mockResolvedValue(makeLabel());
      labelRepo.delete = vi.fn().mockResolvedValue(undefined);

      const service = new LabelService(
        labelRepo,
        taskRepo,
        projectRepo,
        auditService,
        createMockProjectMemberRepo('PROJECT_ADMIN'),
      );

      await service.deleteLabel('label-1', 'user-1', 'MEMBER');

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ entityType: 'LABEL', action: 'DELETED', actorId: 'user-1' }),
      );
    });
  });
});
