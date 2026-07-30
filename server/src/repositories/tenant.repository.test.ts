import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TenantRepository } from './tenant.repository.js';
import type { TenantDocument } from './tenant.repository.js';
import type { Collection, InsertOneResult, DeleteResult } from 'mongodb';

// ─── Mock Collection Helper ──────────────────────────────────────────────────

function createMockCollection() {
  return {
    findOne: vi.fn(),
    find: vi.fn(),
    insertOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
    deleteOne: vi.fn(),
  } as unknown as Collection<TenantDocument> & {
    findOne: ReturnType<typeof vi.fn>;
    find: ReturnType<typeof vi.fn>;
    insertOne: ReturnType<typeof vi.fn>;
    findOneAndUpdate: ReturnType<typeof vi.fn>;
    deleteOne: ReturnType<typeof vi.fn>;
  };
}

function makeDoc(overrides: Partial<TenantDocument> = {}): TenantDocument {
  return {
    id: 'tenant-123',
    name: 'Test Tenant',
    slug: 'test-tenant',
    description: null,
    subscription: 'free',
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('TenantRepository', () => {
  let collection: ReturnType<typeof createMockCollection>;
  let repo: TenantRepository;

  beforeEach(() => {
    collection = createMockCollection();
    repo = new TenantRepository(collection);
  });

  describe('findById', () => {
    it('returns a mapped tenant when found', async () => {
      collection.findOne.mockResolvedValue(makeDoc());

      const result = await repo.findById('tenant-123');

      expect(collection.findOne).toHaveBeenCalledWith({ id: 'tenant-123' });
      expect(result).toEqual({
        id: 'tenant-123',
        name: 'Test Tenant',
        slug: 'test-tenant',
        subscription: 'free',
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      });
    });

    it('returns null when not found', async () => {
      collection.findOne.mockResolvedValue(null);

      const result = await repo.findById('missing');

      expect(result).toBeNull();
    });
  });

  describe('findBySlug', () => {
    it('queries by slug and maps the result', async () => {
      collection.findOne.mockResolvedValue(makeDoc());

      const result = await repo.findBySlug('test-tenant');

      expect(collection.findOne).toHaveBeenCalledWith({ slug: 'test-tenant' });
      expect(result).not.toBeNull();
      expect(result?.slug).toBe('test-tenant');
    });
  });

  describe('findAll', () => {
    it('returns all tenants mapped to domain objects', async () => {
      const toArray = vi
        .fn()
        .mockResolvedValue([makeDoc(), makeDoc({ id: 'tenant-456', name: 'Other', slug: 'other' })]);

      collection.find.mockReturnValue({ toArray });

      const result = await repo.findAll();

      expect(result).toHaveLength(2);
      expect(result[0]?.id).toBe('tenant-123');
      expect(result[1]?.id).toBe('tenant-456');
    });
  });

  describe('create', () => {
    it('inserts a document and returns the domain tenant', async () => {
      collection.insertOne.mockResolvedValue({ acknowledged: true } as InsertOneResult);

      const result = await repo.create({ name: 'New Tenant', slug: 'new-tenant' });

      expect(collection.insertOne).toHaveBeenCalledTimes(1);

      const insertedDoc = collection.insertOne.mock.calls[0]?.[0] as TenantDocument;

      expect(insertedDoc.name).toBe('New Tenant');
      expect(insertedDoc.slug).toBe('new-tenant');
      expect(insertedDoc.id).toBeDefined();
      expect(insertedDoc.createdAt).toBeInstanceOf(Date);
      expect(insertedDoc.updatedAt).toBeInstanceOf(Date);

      expect(result.name).toBe('New Tenant');
      expect(result.slug).toBe('new-tenant');
      // Domain object should have ISO string dates
      expect(typeof result.createdAt).toBe('string');
    });
  });

  describe('update', () => {
    it('returns the updated tenant', async () => {
      const updated = makeDoc({ name: 'Updated' });

      collection.findOneAndUpdate.mockResolvedValue(updated);

      const result = await repo.update('tenant-123', { name: 'Updated' });

      expect(collection.findOneAndUpdate).toHaveBeenCalledWith(
        { id: 'tenant-123' },
        { $set: { name: 'Updated', updatedAt: expect.any(Date) } },
        { returnDocument: 'after' },
      );
      expect(result?.name).toBe('Updated');
    });

    it('returns null when tenant not found', async () => {
      collection.findOneAndUpdate.mockResolvedValue(null);

      const result = await repo.update('missing', { name: 'X' });

      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('returns true when a document was deleted', async () => {
      collection.deleteOne.mockResolvedValue({ deletedCount: 1 } as DeleteResult);

      const result = await repo.delete('tenant-123');

      expect(result).toBe(true);
    });

    it('returns false when no document was deleted', async () => {
      collection.deleteOne.mockResolvedValue({ deletedCount: 0 } as DeleteResult);

      const result = await repo.delete('missing');

      expect(result).toBe(false);
    });
  });
});
