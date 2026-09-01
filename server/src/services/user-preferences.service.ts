import type { UserProjectBoardPreference, UpdateUserProjectBoardPreference } from '@task-board/shared';
import { UserPreferencesRepository } from '../repositories/user-preferences.repository.js';
import type { UserSettings, UpdateUserSettings } from '../repositories/user-settings.repository.js';

export class UserPreferencesService {
  constructor(
    private readonly prefsRepo: UserPreferencesRepository,
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

  /** Per-user project preferences (task-table columns). Null when never saved. */
  async getPreferences(userId: string, projectId: string): Promise<UserProjectBoardPreference | null> {
    return this.prefsRepo.findByUserAndProject(userId, projectId);
  }

  async updatePreferences(
    userId: string,
    projectId: string,
    input: UpdateUserProjectBoardPreference,
  ): Promise<UserProjectBoardPreference> {
    return this.prefsRepo.upsert(userId, projectId, input);
  }
}
