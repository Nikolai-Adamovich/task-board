import type { UserProjectBoardPreference, UpdateUserProjectBoardPreference } from '@task-board/shared';
import { NotFoundError } from '../errors/app-error.js';
import { UserPreferencesRepository } from '../repositories/user-preferences.repository.js';
import type { UserSettings, UpdateUserSettings } from '../repositories/user-settings.repository.js';

export interface UserPreferencesServiceBoardRepo {
  findById(id: string): Promise<{ id: string; projectId: string } | null>;
}

export class UserPreferencesService {
  constructor(
    private readonly prefsRepo: UserPreferencesRepository,
    private readonly boardRepo: UserPreferencesServiceBoardRepo,
    private readonly settingsRepo?: {
      findByUserId(userId: string): Promise<UserSettings>;
      upsert(userId: string, patch: UpdateUserSettings): Promise<UserSettings>;
    },
  ) {}

  /** Global (user-level) settings: zoom, theme, language, page size. */
  async getGlobalSettings(userId: string): Promise<UserSettings> {
    if (!this.settingsRepo) {
      throw new Error('UserSettingsRepository is not configured');
    }
    return this.settingsRepo.findByUserId(userId);
  }

  /** Partially update global (user-level) settings. */
  async updateGlobalSettings(userId: string, patch: UpdateUserSettings): Promise<UserSettings> {
    if (!this.settingsRepo) {
      throw new Error('UserSettingsRepository is not configured');
    }
    return this.settingsRepo.upsert(userId, patch);
  }

  async getPreferences(userId: string, projectId: string): Promise<UserProjectBoardPreference | null> {
    return this.prefsRepo.findByUserAndProject(userId, projectId);
  }

  async updatePreferences(
    userId: string,
    projectId: string,
    input: UpdateUserProjectBoardPreference,
  ): Promise<UserProjectBoardPreference> {
    // Validate defaultBoardId belongs to the same project
    if (input.defaultBoardId) {
      const board = await this.boardRepo.findById(input.defaultBoardId);

      if (!board || board.projectId !== projectId) {
        throw new NotFoundError(`Board ${input.defaultBoardId} not found in project ${projectId}`);
      }
    }

    return this.prefsRepo.upsert(userId, projectId, input);
  }
}
