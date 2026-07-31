import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserPreferencesService } from './user-preferences.service.js';

// ─── Mock Factory ────────────────────────────────────────────────────────────

function createMockRepo() {
  return {
    findByUserId: vi.fn(),
    upsert: vi.fn(),
  };
}

const NOW = '2025-01-01T00:00:00.000Z';

function makePrefs(overrides: Record<string, unknown> = {}) {
  return {
    userId: 'user-123',
    zoom: 100,
    theme: 'light',
    language: 'en',
    updatedAt: NOW,
    ...overrides,
  };
}

describe('UserPreferencesService', () => {
  let repo: ReturnType<typeof createMockRepo>;
  let service: UserPreferencesService;

  beforeEach(() => {
    repo = createMockRepo();
    service = new UserPreferencesService(repo as never);
  });

  // ── getPreferences ─────────────────────────────────────────────────────

  describe('getPreferences', () => {
    it('returns existing preferences from repo', async () => {
      repo.findByUserId.mockResolvedValue(makePrefs({ zoom: 150, theme: 'dark' }));

      const result = await service.getPreferences('user-123');

      expect(repo.findByUserId).toHaveBeenCalledWith('user-123');
      expect(result).toEqual(makePrefs({ zoom: 150, theme: 'dark' }));
    });

    it('returns defaults when repo returns null', async () => {
      repo.findByUserId.mockResolvedValue(null);

      const result = await service.getPreferences('user-123');

      expect(result).toEqual({
        userId: 'user-123',
        zoom: 100,
        theme: 'light',
        language: 'en',
        updatedAt: expect.any(String),
      });
    });
  });

  // ── updatePreferences ──────────────────────────────────────────────────

  describe('updatePreferences', () => {
    it('delegates to repo.upsert', async () => {
      repo.upsert.mockResolvedValue(makePrefs({ zoom: 200 }));

      const result = await service.updatePreferences('user-123', { zoom: 200 });

      expect(repo.upsert).toHaveBeenCalledWith('user-123', { zoom: 200 });
      expect(result.zoom).toBe(200);
    });
  });
});
