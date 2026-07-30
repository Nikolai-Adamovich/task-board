import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserRepository } from './user.repository.js';
import type { UserDocument } from './user.repository.js';
import type { Collection, InsertOneResult } from 'mongodb';

// ─── Mock Collection Helper ──────────────────────────────────────────────────

function createMockCollection() {
  return {
    findOne: vi.fn(),
    insertOne: vi.fn(),
  } as unknown as Collection<UserDocument> & {
    findOne: ReturnType<typeof vi.fn>;
    insertOne: ReturnType<typeof vi.fn>;
  };
}

function makeDoc(overrides: Partial<UserDocument> = {}): UserDocument {
  return {
    id: 'user-123',
    email: 'test@example.com',
    displayName: 'Test User',
    passwordHash: 'hashed-pw',
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('UserRepository', () => {
  let collection: ReturnType<typeof createMockCollection>;
  let repo: UserRepository;

  beforeEach(() => {
    collection = createMockCollection();
    repo = new UserRepository(collection);
  });

  describe('findById', () => {
    it('returns a mapped user when found', async () => {
      collection.findOne.mockResolvedValue(makeDoc());

      const result = await repo.findById('user-123');

      expect(collection.findOne).toHaveBeenCalledWith({ id: 'user-123' });
      expect(result).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        displayName: 'Test User',
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      });
    });

    it('returns null when not found', async () => {
      collection.findOne.mockResolvedValue(null);

      const result = await repo.findById('missing');

      expect(result).toBeNull();
    });

    it('does not expose passwordHash in domain object', async () => {
      collection.findOne.mockResolvedValue(makeDoc());

      const result = await repo.findById('user-123');

      expect(result).not.toHaveProperty('passwordHash');
    });
  });

  describe('findByEmail', () => {
    it('returns the raw document when found', async () => {
      const doc = makeDoc();

      collection.findOne.mockResolvedValue(doc);

      const result = await repo.findByEmail('test@example.com');

      expect(collection.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
      expect(result).toBe(doc);
    });

    it('returns null when not found', async () => {
      collection.findOne.mockResolvedValue(null);

      const result = await repo.findByEmail('missing@example.com');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('inserts a document and returns the domain user', async () => {
      collection.insertOne.mockResolvedValue({ acknowledged: true } as InsertOneResult);

      const result = await repo.create({
        email: 'new@example.com',
        displayName: 'New User',
        passwordHash: 'hashed',
      });

      expect(collection.insertOne).toHaveBeenCalledTimes(1);

      const insertedDoc = collection.insertOne.mock.calls[0]?.[0] as UserDocument;

      expect(insertedDoc.email).toBe('new@example.com');
      expect(insertedDoc.displayName).toBe('New User');
      expect(insertedDoc.passwordHash).toBe('hashed');
      expect(insertedDoc.id).toBeDefined();
      expect(insertedDoc.createdAt).toBeInstanceOf(Date);
      expect(insertedDoc.updatedAt).toBeInstanceOf(Date);

      expect(result.email).toBe('new@example.com');
      expect(result.displayName).toBe('New User');
      expect(result).not.toHaveProperty('passwordHash');
      expect(typeof result.createdAt).toBe('string');
    });
  });
});
