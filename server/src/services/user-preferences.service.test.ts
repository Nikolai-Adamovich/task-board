import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserPreferencesService } from './user-preferences.service.js';
import type { UserPreferencesServiceBoardRepo } from './user-preferences.service.js';
import { UserPreferencesRepository } from '../repositories/user-preferences.repository.js';
import type { UserProjectBoardPreference } from '@task-board/shared';

function createMockPrefsRepo() {
  return {
    findByUserAndProject: vi.fn(),
    upsert: vi.fn(),
  } as unknown as UserPreferencesRepository;
}

function createMockBoardRepo(): UserPreferencesServiceBoardRepo {
  return {
    findById: vi.fn().mockResolvedValue({ id: 'board-1', projectId: 'project-1' }),
  };
}

function makePrefs(overrides: Partial<UserProjectBoardPreference> = {}): UserProjectBoardPreference {
  return {
    id: 'pref-1',
    userId: 'user-1',
    projectId: 'project-1',
    defaultBoardId: 'board-1',
    taskTableColumns: null,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('UserPreferencesService', () => {
  let prefsRepo: ReturnType<typeof createMockPrefsRepo>;
  let boardRepo: UserPreferencesServiceBoardRepo;
  let service: UserPreferencesService;

  beforeEach(() => {
    prefsRepo = createMockPrefsRepo();
    boardRepo = createMockBoardRepo();
    service = new UserPreferencesService(prefsRepo, boardRepo);
  });

  describe('getPreferences', () => {
    it('returns preferences when found', async () => {
      prefsRepo.findByUserAndProject = vi.fn().mockResolvedValue(makePrefs());

      const result = await service.getPreferences('user-1', 'project-1');

      expect(result?.defaultBoardId).toBe('board-1');
    });

    it('returns null when not found', async () => {
      prefsRepo.findByUserAndProject = vi.fn().mockResolvedValue(null);

      const result = await service.getPreferences('user-1', 'project-1');

      expect(result).toBeNull();
    });
  });

  describe('updatePreferences', () => {
    it('upserts preferences with valid board', async () => {
      prefsRepo.upsert = vi.fn().mockResolvedValue(makePrefs({ defaultBoardId: 'board-2' }));

      const result = await service.updatePreferences('user-1', 'project-1', { defaultBoardId: 'board-2' });

      expect(result.defaultBoardId).toBe('board-2');
    });

    it('throws NOT_FOUND when board not in project', async () => {
      boardRepo.findById = vi.fn().mockResolvedValue(null);

      await expect(service.updatePreferences('user-1', 'project-1', { defaultBoardId: 'bad-board' })).rejects.toThrow(
        'not found in project',
      );
    });

    it('allows null defaultBoardId', async () => {
      prefsRepo.upsert = vi.fn().mockResolvedValue(makePrefs({ defaultBoardId: null }));

      const result = await service.updatePreferences('user-1', 'project-1', { defaultBoardId: null });

      expect(result.defaultBoardId).toBeNull();
    });
  });
});
