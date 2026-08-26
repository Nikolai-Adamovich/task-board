import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserSettingsRepository } from './user-settings.repository.js';
import type { UserSettingsDocument } from './user-settings.repository.js';
import type { Collection } from 'mongodb';

// ─── Mock Collection Helper ──────────────────────────────────────────────────

function createMockCollection() {
  return {
    findOne: vi.fn(),
    updateOne: vi.fn().mockResolvedValue({ acknowledged: true }),
  } as unknown as Collection<UserSettingsDocument> & {
    findOne: ReturnType<typeof vi.fn>;
    updateOne: ReturnType<typeof vi.fn>;
  };
}

function makeDoc(overrides: Partial<UserSettingsDocument> = {}): UserSettingsDocument {
  return {
    userId: 'user-1',
    zoom: 100,
    theme: 'light',
    language: 'en',
    pageSize: 20,
    dateFormat: null,
    timeFormat: null,
    updatedAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('UserSettingsRepository', () => {
  let collection: ReturnType<typeof createMockCollection>;
  let repo: UserSettingsRepository;

  beforeEach(() => {
    collection = createMockCollection();
    repo = new UserSettingsRepository(collection);
  });

  describe('findByUserId', () => {
    it('returns defaults (dateFormat/timeFormat null) when no document exists', async () => {
      collection.findOne.mockResolvedValue(null);

      const result = await repo.findByUserId('user-1');

      expect(result.dateFormat).toBeNull();
      expect(result.timeFormat).toBeNull();
    });

    it('maps persisted date/time formats to the domain shape', async () => {
      collection.findOne.mockResolvedValue(makeDoc({ dateFormat: 'MM/DD/YYYY', timeFormat: '12h' }));

      const result = await repo.findByUserId('user-1');

      expect(result.dateFormat).toBe('MM/DD/YYYY');
      expect(result.timeFormat).toBe('12h');
    });

    it('falls back to null defaults for legacy documents missing the fields', async () => {
      collection.findOne.mockResolvedValue(makeDoc({ dateFormat: undefined as never, timeFormat: undefined as never }));

      const result = await repo.findByUserId('user-1');

      expect(result.dateFormat).toBeNull();
      expect(result.timeFormat).toBeNull();
    });
  });

  describe('upsert', () => {
    it('persists dateFormat/timeFormat when provided', async () => {
      collection.findOne.mockResolvedValue(makeDoc({ dateFormat: 'DD/MM/YYYY', timeFormat: '24h' }));

      const result = await repo.upsert('user-1', { dateFormat: 'DD/MM/YYYY', timeFormat: '24h' });
      const update = collection.updateOne.mock.calls[0][1] as Record<string, Record<string, unknown>>;

      expect(update.$set.dateFormat).toBe('DD/MM/YYYY');
      expect(update.$set.timeFormat).toBe('24h');
      expect(result.dateFormat).toBe('DD/MM/YYYY');
      expect(result.timeFormat).toBe('24h');
    });

    it('sets $setOnInsert defaults (null) for untouched fields on first insert', async () => {
      collection.findOne.mockResolvedValue(makeDoc());

      await repo.upsert('user-1', { zoom: 125 });

      const update = collection.updateOne.mock.calls[0][1] as Record<string, Record<string, unknown>>;

      expect(update.$set.zoom).toBe(125);
      expect(update.$setOnInsert.dateFormat).toBeNull();
      expect(update.$setOnInsert.timeFormat).toBeNull();
    });
  });
});
