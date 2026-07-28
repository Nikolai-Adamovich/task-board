import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectService } from './project.service.js';

// ─── Mock Factories ──────────────────────────────────────────────────────────

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

function createMockProjectMemberRepo() {
  return {
    findByProjectAndUser: vi.fn(),
    findByProject: vi.fn(),
    findByUser: vi.fn(),
    create: vi.fn(),
    updateRole: vi.fn(),
    delete: vi.fn(),
  };
}

const NOW = '2025-01-01T00:00:00.000Z';

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

function makeProjectMember(overrides: Record<string, unknown> = {}) {
  return {
    userId: 'user-1',
    projectId: 'proj-1',
    tenantId: 'tenant-1',
    role: 'admin',
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ProjectService', () => {
  let projectRepo: ReturnType<typeof createMockProjectRepo>;
  let memberRepo: ReturnType<typeof createMockProjectMemberRepo>;
  let service: ProjectService;

  beforeEach(() => {
    projectRepo = createMockProjectRepo();
    memberRepo = createMockProjectMemberRepo();
    service = new ProjectService(projectRepo as never, memberRepo as never);
  });

  // ── listProjects ──────────────────────────────────────────────────────────

  describe('listProjects', () => {
    it('returns all projects in a tenant', async () => {
      projectRepo.findByTenant.mockResolvedValue([makeProject(), makeProject({ id: 'proj-2' })]);

      const result = await service.listProjects('tenant-1');

      expect(result).toHaveLength(2);
      expect(projectRepo.findByTenant).toHaveBeenCalledWith('tenant-1');
    });

    it('returns empty array when no projects exist', async () => {
      projectRepo.findByTenant.mockResolvedValue([]);

      const result = await service.listProjects('tenant-1');
      expect(result).toEqual([]);
    });
  });

  // ── createProject ─────────────────────────────────────────────────────────

  describe('createProject', () => {
    it('creates a project and adds the creator as admin', async () => {
      projectRepo.findBySlug.mockResolvedValue(null);
      projectRepo.create.mockResolvedValue(makeProject());
      memberRepo.create.mockResolvedValue(makeProjectMember());

      const result = await service.createProject('tenant-1', 'user-1', 'admin', {
        name: 'Test Project',
        slug: 'test-project',
      });

      expect(projectRepo.create).toHaveBeenCalledWith('tenant-1', {
        name: 'Test Project',
        slug: 'test-project',
      });
      expect(memberRepo.create).toHaveBeenCalledWith({
        userId: 'user-1',
        projectId: 'proj-1',
        tenantId: 'tenant-1',
        role: 'admin',
      });
      expect(result.name).toBe('Test Project');
    });

    it('throws ConflictError when slug is already taken', async () => {
      projectRepo.findBySlug.mockResolvedValue(makeProject());

      await expect(
        service.createProject('tenant-1', 'user-1', 'admin', {
          name: 'X',
          slug: 'test-project',
        }),
      ).rejects.toThrow('already exists');
    });

    it('throws ForbiddenError when user is not admin or owner', async () => {
      await expect(
        service.createProject('tenant-1', 'user-1', 'member', {
          name: 'X',
          slug: 'test',
        }),
      ).rejects.toThrow('Only owner or admin');
    });
  });

  // ── getProject ────────────────────────────────────────────────────────────

  describe('getProject', () => {
    it('returns the project', async () => {
      projectRepo.findById.mockResolvedValue(makeProject());

      const result = await service.getProject('tenant-1', 'proj-1');
      expect(result.id).toBe('proj-1');
    });

    it('throws NotFoundError when project does not exist', async () => {
      projectRepo.findById.mockResolvedValue(null);

      await expect(service.getProject('tenant-1', 'missing')).rejects.toThrow('not found');
    });
  });

  // ── updateProject ─────────────────────────────────────────────────────────

  describe('updateProject', () => {
    it('updates the project', async () => {
      projectRepo.findBySlug.mockResolvedValue(null);
      projectRepo.update.mockResolvedValue(makeProject({ name: 'Updated' }));

      const result = await service.updateProject('tenant-1', 'proj-1', 'admin', {
        name: 'Updated',
      });

      expect(result.name).toBe('Updated');
    });

    it('throws ConflictError when new slug is already taken', async () => {
      projectRepo.findBySlug.mockResolvedValue(makeProject({ id: 'other-proj' }));

      await expect(service.updateProject('tenant-1', 'proj-1', 'admin', { slug: 'taken-slug' })).rejects.toThrow(
        'already exists',
      );
    });

    it('throws ForbiddenError when user is not admin', async () => {
      await expect(service.updateProject('tenant-1', 'proj-1', 'member', { name: 'X' })).rejects.toThrow(
        'Only owner or admin',
      );
    });
  });

  // ── deleteProject ─────────────────────────────────────────────────────────

  describe('deleteProject', () => {
    it('deletes the project', async () => {
      projectRepo.delete.mockResolvedValue(true);

      await service.deleteProject('tenant-1', 'proj-1', 'admin');

      expect(projectRepo.delete).toHaveBeenCalledWith('tenant-1', 'proj-1');
    });

    it('throws NotFoundError when project not found', async () => {
      projectRepo.delete.mockResolvedValue(false);

      await expect(service.deleteProject('tenant-1', 'missing', 'admin')).rejects.toThrow('not found');
    });
  });

  // ── addMember ─────────────────────────────────────────────────────────────

  describe('addMember', () => {
    it('adds a member to the project', async () => {
      projectRepo.findById.mockResolvedValue(makeProject());
      memberRepo.findByProjectAndUser.mockResolvedValue(null);
      memberRepo.create.mockResolvedValue(makeProjectMember({ userId: 'user-2', role: 'developer' }));

      const result = await service.addMember('tenant-1', 'proj-1', 'user-2', 'developer', 'admin');

      expect(memberRepo.create).toHaveBeenCalledWith({
        userId: 'user-2',
        projectId: 'proj-1',
        tenantId: 'tenant-1',
        role: 'developer',
      });
      expect(result.role).toBe('developer');
    });

    it('throws ConflictError when user is already a member', async () => {
      projectRepo.findById.mockResolvedValue(makeProject());
      memberRepo.findByProjectAndUser.mockResolvedValue(makeProjectMember());

      await expect(service.addMember('tenant-1', 'proj-1', 'user-1', 'developer', 'admin')).rejects.toThrow(
        'already a member',
      );
    });
  });

  // ── updateMemberRole ──────────────────────────────────────────────────────

  describe('updateMemberRole', () => {
    it('updates a member role', async () => {
      projectRepo.findById.mockResolvedValue(makeProject());
      memberRepo.updateRole.mockResolvedValue(makeProjectMember({ role: 'viewer' }));

      const result = await service.updateMemberRole('tenant-1', 'proj-1', 'user-1', 'viewer', 'admin');

      expect(result.role).toBe('viewer');
    });

    it('throws NotFoundError when member not found', async () => {
      projectRepo.findById.mockResolvedValue(makeProject());
      memberRepo.updateRole.mockResolvedValue(null);

      await expect(service.updateMemberRole('tenant-1', 'proj-1', 'missing', 'viewer', 'admin')).rejects.toThrow(
        'not found',
      );
    });
  });

  // ── removeMember ──────────────────────────────────────────────────────────

  describe('removeMember', () => {
    it('removes a member from the project', async () => {
      projectRepo.findById.mockResolvedValue(makeProject());
      memberRepo.delete.mockResolvedValue(true);

      await service.removeMember('tenant-1', 'proj-1', 'user-2', 'admin');

      expect(memberRepo.delete).toHaveBeenCalledWith('proj-1', 'user-2');
    });

    it('throws NotFoundError when member not found', async () => {
      projectRepo.findById.mockResolvedValue(makeProject());
      memberRepo.delete.mockResolvedValue(false);

      await expect(service.removeMember('tenant-1', 'proj-1', 'missing', 'admin')).rejects.toThrow('not found');
    });
  });

  // ── getProjectMembers ─────────────────────────────────────────────────────

  describe('getProjectMembers', () => {
    it('returns all project members', async () => {
      projectRepo.findById.mockResolvedValue(makeProject());
      memberRepo.findByProject.mockResolvedValue([
        makeProjectMember(),
        makeProjectMember({ userId: 'user-2', role: 'developer' }),
      ]);

      const result = await service.getProjectMembers('tenant-1', 'proj-1');

      expect(result).toHaveLength(2);
    });
  });
});
