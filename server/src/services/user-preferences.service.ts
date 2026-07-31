import { Theme } from '@task-board/shared';
import type { UserPreferences, UpdateUserPreferences } from '@task-board/shared';
import type { UserPreferencesRepository } from '../repositories/user-preferences.repository.js';

// ─── Default Preferences ─────────────────────────────────────────────────────

function defaultPreferences(userId: string): UserPreferences {
  return {
    userId,
    zoom: 100,
    theme: Theme.Light,
    language: 'en',
    updatedAt: new Date().toISOString(),
  };
}

// ─── User Preferences Service ────────────────────────────────────────────────

export class UserPreferencesService {
  constructor(private readonly repo: UserPreferencesRepository) {}

  /**
   * Get preferences for a user. Returns defaults if none are stored yet.
   */
  async getPreferences(userId: string): Promise<UserPreferences> {
    const existing = await this.repo.findByUserId(userId);

    return existing ?? defaultPreferences(userId);
  }

  /**
   * Create or update preferences for a user.
   */
  async updatePreferences(userId: string, data: UpdateUserPreferences): Promise<UserPreferences> {
    return this.repo.upsert(userId, data);
  }
}
