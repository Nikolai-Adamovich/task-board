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
      collection.findOne.mockResolvedValue(makeDoc({ taskTableColumns: ['key', 'title'] }));

      const result = await repo.findByUserAndProject('user-1', 'project-1');

      expect(collection.findOne).toHaveBeenCalledWith({ userId: 'user-1', projectId: 'project-1' });
      expect(result?.taskTableColumns).toEqual(['key', 'title']);
    });

    it('returns null when not found', async () => {
      collection.findOne.mockResolvedValue(null);

      const result = await repo.findByUserAndProject('missing', 'missing');

      expect(result).toBeNull();
    });
  });

  describe('upsert', () => {
    it('persists taskTableColumns when provided', async () => {
      collection.findOneAndUpdate.mockResolvedValue(makeDoc({ taskTableColumns: ['key', 'title', 'priority'] }));

      const result = await repo.upsert('user-1', 'project-1', { taskTableColumns: ['key', 'title', 'priority'] });

      expect(result.taskTableColumns).toEqual(['key', 'title', 'priority']);
      expect(collection.findOneAndUpdate).toHaveBeenCalledWith(
        { userId: 'user-1', projectId: 'project-1' },
        expect.objectContaining({
          $set: expect.objectContaining({ taskTableColumns: ['key', 'title', 'priority'] }),
        }),
        { upsert: true, returnDocument: 'after' },
      );
    });

    it('persists a null taskTableColumns reset', async () => {
      collection.findOneAndUpdate.mockResolvedValue(makeDoc());

      const result = await repo.upsert('user-1', 'project-1', { taskTableColumns: null });

      expect(result.taskTableColumns).toBeNull();
      expect(collection.findOneAndUpdate).toHaveBeenCalledWith(
        { userId: 'user-1', projectId: 'project-1' },
        expect.objectContaining({
          $set: expect.objectContaining({ taskTableColumns: null }),
        }),
        { upsert: true, returnDocument: 'after' },
      );
    });

    it('sets id/userId/projectId/createdAt via $setOnInsert', async () => {
      collection.findOneAndUpdate.mockResolvedValue(makeDoc());

      await repo.upsert('user-1', 'project-1', { taskTableColumns: ['key'] });

      const call = collection.findOneAndUpdate.mock.calls[0]?.[1] as { $setOnInsert?: Record<string, unknown> };

      expect(call?.$setOnInsert).toEqual(
        expect.objectContaining({ userId: 'user-1', projectId: 'project-1', createdAt: expect.any(Date) }),
      );
    });

    it('maps missing document fields to null in the domain object', async () => {
      // Legacy documents created before R3-P4 have the field missing entirely
      collection.findOneAndUpdate.mockResolvedValue({ ...makeDoc(), taskTableColumns: undefined });

      const result = await repo.upsert('user-1', 'project-1', { taskTableColumns: ['key', 'title'] });

      expect(result.taskTableColumns).toBeNull();
    });
  });
});
