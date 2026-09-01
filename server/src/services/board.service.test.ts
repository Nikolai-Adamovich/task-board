import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BoardService } from './board.service.js';
import { BoardRepository } from '../repositories/board.repository.js';
import { StatusRepository } from '../repositories/status.repository.js';
import type { BoardConfig, Status } from '@task-board/shared';

// ─── Mock Factories ──────────────────────────────────────────────────────────

function createMockBoardRepo() {
  return {
    findByProject: vi.fn(),
    create: vi.fn(),
    updateColumns: vi.fn(),
    replaceStatusInColumns: vi.fn(),
    deleteByProject: vi.fn(),
  } as unknown as BoardRepository;
}

function createMockStatusRepo() {
  return {
    findById: vi.fn(),
    findByIds: vi.fn(),
    findByProject: vi.fn(),
    findByProjectAndNormalizedName: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  } as unknown as StatusRepository;
}

function makeBoard(overrides: Partial<BoardConfig> = {}): BoardConfig {
  return {
    projectId: 'project-1',
    columns: [
      { id: 'col-1', statusIds: ['status-1'], position: 0 },
      { id: 'col-2', statusIds: ['status-2'], position: 1 },
    ],
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
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

describe('BoardService (single-board model)', () => {
  let boardRepo: ReturnType<typeof createMockBoardRepo>;
  let statusRepo: ReturnType<typeof createMockStatusRepo>;
  let projectRepo: { findById: ReturnType<typeof vi.fn> };
  let service: BoardService;

  beforeEach(() => {
    boardRepo = createMockBoardRepo();
    statusRepo = createMockStatusRepo();
    projectRepo = { findById: vi.fn().mockResolvedValue({ id: 'project-1', tenantId: 'tenant-1' }) };
    service = new BoardService(boardRepo, statusRepo, projectRepo as never);
  });

  describe('getBoardByProject', () => {
    it('returns the project board when found', async () => {
      boardRepo.findByProject = vi.fn().mockResolvedValue(makeBoard());

      const result = await service.getBoardByProject('project-1');

      expect(result.projectId).toBe('project-1');
      expect(boardRepo.findByProject).toHaveBeenCalledWith('project-1');
    });

    it('throws NOT_FOUND when the board does not exist', async () => {
      boardRepo.findByProject = vi.fn().mockResolvedValue(null);

      await expect(service.getBoardByProject('project-1')).rejects.toThrow('Board not found');
    });
  });

  describe('updateColumns', () => {
    it('updates the columns after validating statuses', async () => {
      boardRepo.findByProject = vi.fn().mockResolvedValue(makeBoard());
      statusRepo.findByIds = vi.fn().mockResolvedValue([makeStatus(), makeStatus({ id: 'status-2' })]);
      boardRepo.updateColumns = vi
        .fn()
        .mockResolvedValue(makeBoard({ columns: [{ id: 'col-1', statusIds: ['status-1', 'status-2'], position: 0 }] }));

      const result = await service.updateColumns('project-1', {
        columns: [{ statusIds: ['status-1', 'status-2'], position: 0 }],
      });

      expect(boardRepo.updateColumns).toHaveBeenCalledWith('project-1', [
        { statusIds: ['status-1', 'status-2'], position: 0 },
      ]);
      expect(result.columns[0]?.statusIds).toEqual(['status-1', 'status-2']);
    });

    it('throws NOT_FOUND when the board does not exist', async () => {
      boardRepo.findByProject = vi.fn().mockResolvedValue(null);

      await expect(
        service.updateColumns('project-1', { columns: [{ statusIds: ['status-1'], position: 0 }] }),
      ).rejects.toThrow('Board not found');
    });

    it('throws NOT_FOUND when a status does not belong to the project', async () => {
      boardRepo.findByProject = vi.fn().mockResolvedValue(makeBoard());
      statusRepo.findByIds = vi.fn().mockResolvedValue([]);

      await expect(
        service.updateColumns('project-1', { columns: [{ statusIds: ['bad-status'], position: 0 }] }),
      ).rejects.toThrow('not found in project');
    });

    it('M-14: validates all status ids with ONE batched findByIds call', async () => {
      boardRepo.findByProject = vi.fn().mockResolvedValue(makeBoard());
      statusRepo.findByIds = vi.fn().mockResolvedValue([makeStatus(), makeStatus({ id: 'status-2' })]);
      boardRepo.updateColumns = vi.fn().mockResolvedValue(makeBoard());

      await service.updateColumns('project-1', {
        columns: [
          { statusIds: ['status-1'], position: 0 },
          { statusIds: ['status-2', 'status-1'], position: 1 },
        ],
      });

      // one batched lookup for the deduped id set — not one findById per status
      expect(statusRepo.findByIds).toHaveBeenCalledTimes(1);
      expect(statusRepo.findByIds).toHaveBeenCalledWith(['status-1', 'status-2']);
      expect(statusRepo.findById).not.toHaveBeenCalled();
    });
  });

  // ── V2-4: manage_boards enforcement ──────────────────────────────────────

  describe('manage_boards enforcement', () => {
    let projectMemberRepo: { findByUserAndProject: ReturnType<typeof vi.fn> };

    beforeEach(() => {
      projectMemberRepo = { findByUserAndProject: vi.fn().mockResolvedValue(null) };
      service = new BoardService(boardRepo, statusRepo, projectRepo as never, undefined, projectMemberRepo);
      boardRepo.findByProject = vi.fn().mockResolvedValue(makeBoard());
      statusRepo.findByIds = vi.fn().mockResolvedValue([makeStatus()]);
      boardRepo.updateColumns = vi.fn().mockResolvedValue(makeBoard());
    });

    it('denies updateColumns for an EDITOR (manage_boards is PROJECT_ADMIN only)', async () => {
      projectMemberRepo.findByUserAndProject.mockResolvedValue({ role: 'EDITOR' });

      await expect(
        service.updateColumns('project-1', { columns: [{ statusIds: ['status-1'], position: 0 }] }, 'user-1', 'MEMBER'),
      ).rejects.toThrow("Insufficient permissions. Requires 'manage_boards'.");
      expect(boardRepo.updateColumns).not.toHaveBeenCalled();
    });

    it('allows updateColumns for a PROJECT_ADMIN', async () => {
      projectMemberRepo.findByUserAndProject.mockResolvedValue({ role: 'PROJECT_ADMIN' });

      await expect(
        service.updateColumns('project-1', { columns: [{ statusIds: ['status-1'], position: 0 }] }, 'user-1', 'MEMBER'),
      ).resolves.toBeDefined();
    });

    it('bypasses the project role for a tenant ADMIN', async () => {
      projectMemberRepo.findByUserAndProject.mockResolvedValue(null);

      await expect(
        service.updateColumns('project-1', { columns: [{ statusIds: ['status-1'], position: 0 }] }, 'user-1', 'ADMIN'),
      ).resolves.toBeDefined();
    });

    it('skips the check when no caller context is provided (legacy/test callers)', async () => {
      await expect(
        service.updateColumns('project-1', { columns: [{ statusIds: ['status-1'], position: 0 }] }),
      ).resolves.toBeDefined();
      expect(projectMemberRepo.findByUserAndProject).not.toHaveBeenCalled();
    });
  });
});
