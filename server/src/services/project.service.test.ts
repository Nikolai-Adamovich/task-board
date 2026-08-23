import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectService } from './project.service.js';

// ─── Mock Factories ──────────────────────────────────────────────────────────

function createMockProjectRepo() {
  return {
    findById: vi.fn(),
    findByTenant: vi.fn(),
    findByTenantAndKey: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
}

function createMockProjectMemberRepo() {
  return {
    findByUserAndProject: vi.fn(),
    findByProject: vi.fn(),
    findByProjectWithUsers: vi.fn(),
    findByUser: vi.fn(),
    create: vi.fn(),
    updateRole: vi.fn(),
    delete: vi.fn(),
  };
}

function createMockCollections() {
  return {
    taskTypes: { insertOne: vi.fn() },
    statuses: { insertOne: vi.fn() },
    boards: { insertOne: vi.fn() },
  };
}

const NOW = '2025-01-01T00:00:00.000Z';

function makeProject(overrides: Record<string, unknown> = {}) {
  return {
    id: 'proj-1',
    tenantId: 'tenant-1',
    key: 'TEST',
    name: 'Test Project',
    description: null,
    status: 'ACTIVE',
    defaultStatusId: 'status-todo',
    defaultBoardId: 'board-1',
    archiveReason: null,
    deletionScheduledAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeProjectMember(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pmember-1',
    userId: 'user-1',
    projectId: 'proj-1',
    role: 'PROJECT_ADMIN',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ProjectService', () => {
  let projectRepo: ReturnType<typeof createMockProjectRepo>;
  let memberRepo: ReturnType<typeof createMockProjectMemberRepo>;
  let collections: ReturnType<typeof createMockCollections>;
  let service: ProjectService;

  beforeEach(() => {
    projectRepo = createMockProjectRepo();
    memberRepo = createMockProjectMemberRepo();
    collections = createMockCollections();
    service = new ProjectService(projectRepo as never, memberRepo as never, collections as never);
  });

  // ── listProjects ──────────────────────────────────────────────────────────

  describe('listProjects', () => {
    it('returns all projects in a tenant', async () => {
      projectRepo.findByTenant.mockResolvedValue([makeProject(), makeProject({ id: 'proj-2', key: 'PROJ2' })]);

      const result = await service.listProjects('tenant-1');

      expect(result).toHaveLength(2);
      expect(projectRepo.findByTenant).toHaveBeenCalledWith('tenant-1');
    });
  });

  // ── createProject ─────────────────────────────────────────────────────────

  describe('createProject', () => {
    it('creates a project with seed data and adds the creator as PROJECT_ADMIN', async () => {
      projectRepo.findByTenantAndKey.mockResolvedValue(null);
      projectRepo.create.mockResolvedValue(makeProject({ defaultStatusId: '', defaultBoardId: '' }));
      projectRepo.findById.mockResolvedValue(makeProject());
      memberRepo.create.mockResolvedValue(makeProjectMember());

      const result = await service.createProject('tenant-1', 'user-1', 'ADMIN', {
        key: 'TEST',
        name: 'Test Project',
      });

      expect(projectRepo.create).toHaveBeenCalledWith('tenant-1', { key: 'TEST', name: 'Test Project' });
      expect(collections.statuses.insertOne).toHaveBeenCalledTimes(5); // 5 seed statuses
      expect(collections.taskTypes.insertOne).toHaveBeenCalledTimes(3); // 3 seed task types
      expect(collections.boards.insertOne).toHaveBeenCalledTimes(1); // 1 default board
      expect(memberRepo.create).toHaveBeenCalledWith({
        userId: 'user-1',
        projectId: 'proj-1',
        role: 'PROJECT_ADMIN',
      });
      expect(result.key).toBe('TEST');
    });

    it('throws ConflictError for duplicate key', async () => {
      projectRepo.findByTenantAndKey.mockResolvedValue(makeProject());

      await expect(service.createProject('tenant-1', 'user-1', 'ADMIN', { key: 'TEST', name: 'Dup' })).rejects.toThrow(
        'already exists',
      );
    });

    it('throws ForbiddenError when user is not admin or owner', async () => {
      await expect(service.createProject('tenant-1', 'user-1', 'MEMBER', { key: 'TEST', name: 'X' })).rejects.toThrow(
        'Only owner or admin',
      );
    });

    it('throws for invalid key format', async () => {
      await expect(service.createProject('tenant-1', 'user-1', 'ADMIN', { key: 'ab', name: 'X' })).rejects.toThrow(
        'Key must start with a letter',
      );
    });
  });

  // ── getProject ────────────────────────────────────────────────────────────

  describe('getProject', () => {
    it('returns the project', async () => {
      projectRepo.findById.mockResolvedValue(makeProject());

      const result = await service.getProject('proj-1');

      expect(result.id).toBe('proj-1');
    });

    it('throws NotFoundError when project does not exist', async () => {
      projectRepo.findById.mockResolvedValue(null);

      await expect(service.getProject('missing')).rejects.toThrow('not found');
    });
  });

  // ── updateProject ─────────────────────────────────────────────────────────

  describe('updateProject', () => {
    it('updates the project', async () => {
      projectRepo.findById.mockResolvedValue(makeProject());
      projectRepo.update.mockResolvedValue(makeProject({ name: 'Updated' }));

      const result = await service.updateProject('proj-1', 'ADMIN', { name: 'Updated' });

      expect(result.name).toBe('Updated');
    });

    it('throws ForbiddenError when user is not admin', async () => {
      await expect(service.updateProject('proj-1', 'MEMBER', { name: 'X' })).rejects.toThrow('Only owner or admin');
    });

    it('throws for archived project', async () => {
      projectRepo.findById.mockResolvedValue(makeProject({ status: 'ARCHIVED' }));

      await expect(service.updateProject('proj-1', 'ADMIN', { name: 'X' })).rejects.toThrow('archived');
    });
  });

  // ── deleteProject ─────────────────────────────────────────────────────────

  describe('deleteProject', () => {
    it('sets status to DELETION_PENDING', async () => {
      projectRepo.findById.mockResolvedValue(makeProject());
      projectRepo.update.mockResolvedValue(makeProject({ status: 'DELETION_PENDING' }));

      await service.deleteProject('proj-1', 'ADMIN');

      expect(projectRepo.update).toHaveBeenCalledWith('proj-1', {
        status: 'DELETION_PENDING',
        deletionScheduledAt: expect.any(Date),
      });
    });
  });

  // ── archiveProject ────────────────────────────────────────────────────────

  describe('archiveProject', () => {
    it('sets status to ARCHIVED with archiveReason', async () => {
      projectRepo.findById.mockResolvedValue(makeProject());

      await service.archiveProject('proj-1', 'ADMIN');

      expect(projectRepo.update).toHaveBeenCalledWith('proj-1', {
        status: 'ARCHIVED',
        archiveReason: 'PROJECT_ARCHIVE',
      });
    });
  });

  // ── restoreProject ────────────────────────────────────────────────────────

  describe('restoreProject', () => {
    it('sets status to ACTIVE and clears archive fields', async () => {
      await service.restoreProject('proj-1', 'ADMIN');

      expect(projectRepo.update).toHaveBeenCalledWith('proj-1', {
        status: 'ACTIVE',
        archiveReason: null,
        deletionScheduledAt: null,
      });
    });
  });

  // ── addMember ─────────────────────────────────────────────────────────────

  describe('addMember', () => {
    it('adds a member to the project', async () => {
      projectRepo.findById.mockResolvedValue(makeProject());
      memberRepo.findByUserAndProject.mockResolvedValue(null);
      memberRepo.create.mockResolvedValue(makeProjectMember({ userId: 'user-2', role: 'EDITOR' }));

      const result = await service.addMember('proj-1', 'user-2', 'EDITOR', 'ADMIN');

      expect(memberRepo.create).toHaveBeenCalledWith({
        userId: 'user-2',
        projectId: 'proj-1',
        role: 'EDITOR',
      });
      expect(result.role).toBe('EDITOR');
    });

    it('throws ConflictError when user is already a member', async () => {
      projectRepo.findById.mockResolvedValue(makeProject());
      memberRepo.findByUserAndProject.mockResolvedValue(makeProjectMember());

      await expect(service.addMember('proj-1', 'user-1', 'EDITOR', 'ADMIN')).rejects.toThrow('already a member');
    });
  });

  // ── removeMember ──────────────────────────────────────────────────────────

  describe('removeMember', () => {
    it('removes a member from the project', async () => {
      projectRepo.findById.mockResolvedValue(makeProject());
      memberRepo.delete.mockResolvedValue(true);

      await service.removeMember('proj-1', 'user-2', 'ADMIN');

      expect(memberRepo.delete).toHaveBeenCalledWith('proj-1', 'user-2');
    });

    it('throws NotFoundError when member not found', async () => {
      projectRepo.findById.mockResolvedValue(makeProject());
      memberRepo.delete.mockResolvedValue(false);

      await expect(service.removeMember('proj-1', 'missing', 'ADMIN')).rejects.toThrow('not found');
    });
  });

  // ── getProjectMembers ─────────────────────────────────────────────────────

  describe('getProjectMembers', () => {
    it('returns all project members', async () => {
      projectRepo.findById.mockResolvedValue(makeProject());
      memberRepo.findByProjectWithUsers.mockResolvedValue([
        makeProjectMember(),
        makeProjectMember({ id: 'pm-2', userId: 'user-2', role: 'EDITOR' }),
      ]);

      const result = await service.getProjectMembers('proj-1');

      expect(result).toHaveLength(2);
    });
  });
});
