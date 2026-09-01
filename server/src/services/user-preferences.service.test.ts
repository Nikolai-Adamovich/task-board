import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserPreferencesService } from './user-preferences.service.js';
import { UserPreferencesRepository } from '../repositories/user-preferences.repository.js';
import type { UserProjectBoardPreference } from '@task-board/shared';

function createMockPrefsRepo() {
  return {
    findByUserAndProject: vi.fn(),
    upsert: vi.fn(),
  } as unknown as UserPreferencesRepository;
}

function makePrefs(overrides: Partial<UserProjectBoardPreference> = {}): UserProjectBoardPreference {
  return {
    id: 'pref-1',
    userId: 'user-1',
    projectId: 'project-1',
    taskTableColumns: null,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('UserPreferencesService (single-board model — task-table columns only)', () => {
  let prefsRepo: ReturnType<typeof createMockPrefsRepo>;
  let service: UserPreferencesService;

  beforeEach(() => {
    prefsRepo = createMockPrefsRepo();
    service = new UserPreferencesService(prefsRepo);
  });

  describe('getPreferences', () => {
    it('returns preferences when found', async () => {
      prefsRepo.findByUserAndProject = vi.fn().mockResolvedValue(makePrefs({ taskTableColumns: ['key', 'title'] }));

      const result = await service.getPreferences('user-1', 'project-1');

      expect(result?.taskTableColumns).toEqual(['key', 'title']);
    });

    it('returns null when not found', async () => {
      prefsRepo.findByUserAndProject = vi.fn().mockResolvedValue(null);

      const result = await service.getPreferences('user-1', 'project-1');

      expect(result).toBeNull();
    });
  });

  describe('updatePreferences', () => {
    it('upserts the taskTableColumns preference', async () => {
      prefsRepo.upsert = vi.fn().mockResolvedValue(makePrefs({ taskTableColumns: ['key', 'title'] }));

      const result = await service.updatePreferences('user-1', 'project-1', { taskTableColumns: ['key', 'title'] });

      expect(result.taskTableColumns).toEqual(['key', 'title']);
      expect(prefsRepo.upsert).toHaveBeenCalledWith('user-1', 'project-1', { taskTableColumns: ['key', 'title'] });
    });

    it('passes a null reset through to the repository', async () => {
      prefsRepo.upsert = vi.fn().mockResolvedValue(makePrefs());

      const result = await service.updatePreferences('user-1', 'project-1', { taskTableColumns: null });

      expect(result.taskTableColumns).toBeNull();
    });
  });
});
