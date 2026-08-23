import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserPreferencesRepository } from './user-preferences.repository.js';
import type { UserPreferencesDocument } from './user-preferences.repository.js';
import type { Collection } from 'mongodb';

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
    id: 'pref-123',
    userId: 'user-1',
    projectId: 'project-1',
    defaultBoardId: 'board-1',
    createdAt: new Date('2025-01-01T00:00:00Z'),
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

  describe('findByUserAndProject', () => {
    it('returns preferences when found', async () => {
      collection.findOne.mockResolvedValue(makeDoc());

      const result = await repo.findByUserAndProject('user-1', 'project-1');

      expect(collection.findOne).toHaveBeenCalledWith({ userId: 'user-1', projectId: 'project-1' });
      expect(result?.defaultBoardId).toBe('board-1');
    });

    it('returns null when not found', async () => {
      collection.findOne.mockResolvedValue(null);

      const result = await repo.findByUserAndProject('missing', 'missing');

      expect(result).toBeNull();
    });
  });

  describe('upsert', () => {
    it('upserts preferences', async () => {
      collection.findOneAndUpdate.mockResolvedValue(makeDoc({ defaultBoardId: 'board-2' }));

      const result = await repo.upsert('user-1', 'project-1', { defaultBoardId: 'board-2' });

      expect(result.defaultBoardId).toBe('board-2');
      expect(collection.findOneAndUpdate).toHaveBeenCalledWith(
        { userId: 'user-1', projectId: 'project-1' },
        expect.objectContaining({
          $set: expect.objectContaining({ defaultBoardId: 'board-2' }),
        }),
        { upsert: true, returnDocument: 'after' },
      );
    });
  });
});
