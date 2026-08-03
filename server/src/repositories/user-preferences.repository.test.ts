import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserPreferencesRepository } from './user-preferences.repository.js';
import type { UserPreferencesDocument } from './user-preferences.repository.js';
import type { Collection } from 'mongodb';

// ─── Mock Collection Helper ──────────────────────────────────────────────────

function createMockCollection() {
  return {
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
  } as unknown as Collection<UserPreferencesDocument> & {
    findOne: ReturnType<typeof vi.fn>;
    findOneAndUpdate: ReturnType<typeof vi.fn>;
  };
}

function makeDoc(overrides: Partial<UserPreferencesDocument> = {}): UserPreferencesDocument {
  return {
    userId: 'user-123',
    zoom: 100,
    theme: 'light',
    language: 'en',
    updatedAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('UserPreferencesRepository', () => {
  let collection: ReturnType<typeof createMockCollection>;
  let repo: UserPreferencesRepository;

  beforeEach(() => {
    collection = createMockCollection();
    repo = new UserPreferencesRepository(collection);
  });

  // ── findByUserId ───────────────────────────────────────────────────────

  describe('findByUserId', () => {
    it('returns mapped preferences when found', async () => {
      collection.findOne.mockResolvedValue(makeDoc());

      const result = await repo.findByUserId('user-123');

      expect(collection.findOne).toHaveBeenCalledWith({ userId: 'user-123' });
      expect(result).toEqual({
        userId: 'user-123',
        zoom: 100,
        theme: 'light',
        language: 'en',
        updatedAt: '2025-01-01T00:00:00.000Z',
      });
    });

    it('returns null when not found', async () => {
      collection.findOne.mockResolvedValue(null);

      const result = await repo.findByUserId('missing');

      expect(result).toBeNull();
    });
  });

  // ── upsert ─────────────────────────────────────────────────────────────

  describe('upsert', () => {
    it('creates a new document when none exists', async () => {
      const created = makeDoc({ zoom: 150, theme: 'dark', language: 'pl' });

      collection.findOneAndUpdate.mockResolvedValue(created);

      const result = await repo.upsert('user-123', { zoom: 150, theme: 'dark', language: 'pl' });

      expect(collection.findOneAndUpdate).toHaveBeenCalledWith(
        { userId: 'user-123' },
        {
          $set: { updatedAt: expect.any(Date), zoom: 150, theme: 'dark', language: 'pl' },
          $setOnInsert: { userId: 'user-123' },
        },
        { upsert: true, returnDocument: 'after' },
      );
      expect(result).toEqual({
        userId: 'user-123',
        zoom: 150,
        theme: 'dark',
        language: 'pl',
        updatedAt: '2025-01-01T00:00:00.000Z',
      });
    });

    it('updates an existing document', async () => {
      const updated = makeDoc({ zoom: 200 });

      collection.findOneAndUpdate.mockResolvedValue(updated);

      const result = await repo.upsert('user-123', { zoom: 200 });

      expect(collection.findOneAndUpdate).toHaveBeenCalledWith(
        { userId: 'user-123' },
        {
          $set: { updatedAt: expect.any(Date), zoom: 200 },
          $setOnInsert: { userId: 'user-123', theme: 'light', language: 'en' },
        },
        { upsert: true, returnDocument: 'after' },
      );
      expect(result.zoom).toBe(200);
    });
  });
});
