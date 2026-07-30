import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TenantMemberRepository } from './tenant-member.repository.js';
import type { TenantMemberDocument } from './tenant-member.repository.js';
import type { Collection, InsertOneResult, DeleteResult } from 'mongodb';

// ─── Mock Collection Helper ──────────────────────────────────────────────────

function createMockCollection() {
  return {
    findOne: vi.fn(),
    find: vi.fn(),
    insertOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
    deleteOne: vi.fn(),
    countDocuments: vi.fn(),
  } as unknown as Collection<TenantMemberDocument> & {
    findOne: ReturnType<typeof vi.fn>;
    find: ReturnType<typeof vi.fn>;
    insertOne: ReturnType<typeof vi.fn>;
    findOneAndUpdate: ReturnType<typeof vi.fn>;
    deleteOne: ReturnType<typeof vi.fn>;
    countDocuments: ReturnType<typeof vi.fn>;
  };
}

function makeDoc(overrides: Partial<TenantMemberDocument> = {}): TenantMemberDocument {
  return {
    id: 'member-123',
    userId: 'user-1',
    tenantId: 'tenant-1',
    role: 'owner',
    status: 'active',
    invitedEmail: null,
    invitationToken: null,
    invitedAt: null,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('TenantMemberRepository', () => {
  let collection: ReturnType<typeof createMockCollection>;
  let repo: TenantMemberRepository;

  beforeEach(() => {
    collection = createMockCollection();
    repo = new TenantMemberRepository(collection);
  });

  describe('findByUserAndTenant', () => {
    it('returns a mapped member when found', async () => {
      collection.findOne.mockResolvedValue(makeDoc());

      const result = await repo.findByUserAndTenant('user-1', 'tenant-1');

      expect(collection.findOne).toHaveBeenCalledWith({ userId: 'user-1', tenantId: 'tenant-1' });
      expect(result).toEqual({
        userId: 'user-1',
        tenantId: 'tenant-1',
        role: 'owner',
        status: 'active',
        invitedEmail: null,
        invitationToken: null,
        invitedAt: null,
      });
    });

    it('returns null when not found', async () => {
      collection.findOne.mockResolvedValue(null);

      const result = await repo.findByUserAndTenant('missing', 'tenant-1');

      expect(result).toBeNull();
    });
  });

  describe('findByTenant', () => {
    it('returns all members for a tenant', async () => {
      const toArray = vi
        .fn()
        .mockResolvedValue([makeDoc({ userId: 'user-1' }), makeDoc({ userId: 'user-2', role: 'member' })]);

      collection.find.mockReturnValue({ toArray });

      const result = await repo.findByTenant('tenant-1');

      expect(collection.find).toHaveBeenCalledWith({ tenantId: 'tenant-1' });
      expect(result).toHaveLength(2);
    });
  });

  describe('findByUser', () => {
    it('returns all memberships for a user', async () => {
      const toArray = vi
        .fn()
        .mockResolvedValue([
          makeDoc({ tenantId: 't1', status: 'active' }),
          makeDoc({ tenantId: 't2', role: 'member', status: 'pending' }),
        ]);

      collection.find.mockReturnValue({ toArray });

      const result = await repo.findByUser('user-1');

      expect(collection.find).toHaveBeenCalledWith({ userId: 'user-1' });
      expect(result).toHaveLength(2);
    });
  });

  describe('findByInvitationToken', () => {
    it('returns the raw document when found', async () => {
      const doc = makeDoc({
        invitationToken: 'token-abc',
        status: 'pending',
        invitedEmail: 'invited@example.com',
      });

      collection.findOne.mockResolvedValue(doc);

      const result = await repo.findByInvitationToken('token-abc');

      expect(collection.findOne).toHaveBeenCalledWith({ invitationToken: 'token-abc' });
      expect(result).toBe(doc);
    });
  });

  describe('findPendingByEmail', () => {
    it('queries for pending members by invited email', async () => {
      const toArray = vi.fn().mockResolvedValue([makeDoc({ status: 'pending', invitedEmail: 'a@b.com' })]);

      collection.find.mockReturnValue({ toArray });

      const result = await repo.findPendingByEmail('a@b.com');

      expect(collection.find).toHaveBeenCalledWith({ invitedEmail: 'a@b.com', status: 'pending' });
      expect(result).toHaveLength(1);
    });
  });

  describe('activateInvitation', () => {
    it('activates the pending invitation with the userId', async () => {
      const activated = makeDoc({ userId: 'user-2', status: 'active', invitationToken: null, invitedAt: null });

      collection.findOneAndUpdate.mockResolvedValue(activated);

      const result = await repo.activateInvitation('token-abc', 'user-2');

      expect(collection.findOneAndUpdate).toHaveBeenCalledWith(
        { invitationToken: 'token-abc', status: 'pending' },
        { $set: { userId: 'user-2', status: 'active', invitedAt: null } },
        { returnDocument: 'after' },
      );
      expect(result?.userId).toBe('user-2');
      expect(result?.status).toBe('active');
    });

    it('returns null when invitation not found', async () => {
      collection.findOneAndUpdate.mockResolvedValue(null);

      const result = await repo.activateInvitation('invalid', 'user-2');

      expect(result).toBeNull();
    });
  });

  describe('countActiveByTenant', () => {
    it('returns the count of active members', async () => {
      collection.countDocuments.mockResolvedValue(3);

      const result = await repo.countActiveByTenant('tenant-1');

      expect(collection.countDocuments).toHaveBeenCalledWith({ tenantId: 'tenant-1', status: 'active' });
      expect(result).toBe(3);
    });
  });

  describe('countOwnedTenants', () => {
    it('returns the count of owned tenants', async () => {
      collection.countDocuments.mockResolvedValue(1);

      const result = await repo.countOwnedTenants('user-1');

      expect(collection.countDocuments).toHaveBeenCalledWith({ userId: 'user-1', role: 'owner' });
      expect(result).toBe(1);
    });
  });

  describe('findPendingByTenant', () => {
    it('returns pending members for a tenant', async () => {
      const toArray = vi.fn().mockResolvedValue([makeDoc({ status: 'pending' })]);

      collection.find.mockReturnValue({ toArray });

      const result = await repo.findPendingByTenant('tenant-1');

      expect(collection.find).toHaveBeenCalledWith({ tenantId: 'tenant-1', status: 'pending' });
      expect(result).toHaveLength(1);
    });
  });

  describe('findById', () => {
    it('returns a member document by id', async () => {
      const doc = makeDoc({ id: 'member-42' });

      collection.findOne.mockResolvedValue(doc);

      const result = await repo.findById('member-42');

      expect(collection.findOne).toHaveBeenCalledWith({ id: 'member-42' });
      expect(result).toBe(doc);
    });
  });

  describe('updateStatusById', () => {
    it('updates the status and returns the domain member', async () => {
      const updated = makeDoc({ status: 'declined' });

      collection.findOneAndUpdate.mockResolvedValue(updated);

      const result = await repo.updateStatusById('member-123', 'declined');

      expect(collection.findOneAndUpdate).toHaveBeenCalledWith(
        { id: 'member-123' },
        { $set: { status: 'declined' } },
        { returnDocument: 'after' },
      );
      expect(result?.status).toBe('declined');
    });
  });

  describe('deleteById', () => {
    it('returns true when a document was deleted', async () => {
      collection.deleteOne.mockResolvedValue({ deletedCount: 1 } as DeleteResult);

      const result = await repo.deleteById('member-123');

      expect(result).toBe(true);
    });

    it('returns false when no document was deleted', async () => {
      collection.deleteOne.mockResolvedValue({ deletedCount: 0 } as DeleteResult);

      const result = await repo.deleteById('missing');

      expect(result).toBe(false);
    });
  });

  describe('create', () => {
    it('creates an active member', async () => {
      collection.insertOne.mockResolvedValue({ acknowledged: true } as InsertOneResult);

      const result = await repo.create({
        userId: 'user-1',
        tenantId: 'tenant-1',
        role: 'owner',
        status: 'active',
      });

      expect(collection.insertOne).toHaveBeenCalledTimes(1);

      const insertedDoc = collection.insertOne.mock.calls[0]?.[0] as TenantMemberDocument;

      expect(insertedDoc.userId).toBe('user-1');
      expect(insertedDoc.tenantId).toBe('tenant-1');
      expect(insertedDoc.role).toBe('owner');
      expect(insertedDoc.status).toBe('active');
      expect(insertedDoc.invitedAt).toBeNull();
      expect(insertedDoc.id).toBeDefined();

      expect(result.role).toBe('owner');
    });

    it('creates a pending invitation with invitedAt', async () => {
      collection.insertOne.mockResolvedValue({ acknowledged: true } as InsertOneResult);

      const result = await repo.create({
        userId: null,
        tenantId: 'tenant-1',
        role: 'member',
        status: 'pending',
        invitedEmail: 'invited@example.com',
        invitationToken: 'token-abc',
      });
      const insertedDoc = collection.insertOne.mock.calls[0]?.[0] as TenantMemberDocument;

      expect(insertedDoc.userId).toBeNull();
      expect(insertedDoc.invitedEmail).toBe('invited@example.com');
      expect(insertedDoc.invitationToken).toBe('token-abc');
      expect(insertedDoc.invitedAt).toBeInstanceOf(Date);
      expect(result.status).toBe('pending');
    });
  });

  describe('updateRole', () => {
    it('returns the updated member', async () => {
      const updated = makeDoc({ role: 'admin' });

      collection.findOneAndUpdate.mockResolvedValue(updated);

      const result = await repo.updateRole('tenant-1', 'user-1', 'admin');

      expect(collection.findOneAndUpdate).toHaveBeenCalledWith(
        { userId: 'user-1', tenantId: 'tenant-1' },
        { $set: { role: 'admin' } },
        { returnDocument: 'after' },
      );
      expect(result?.role).toBe('admin');
    });

    it('returns null when not found', async () => {
      collection.findOneAndUpdate.mockResolvedValue(null);

      const result = await repo.updateRole('tenant-1', 'missing', 'admin');

      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('returns true when a document was deleted', async () => {
      collection.deleteOne.mockResolvedValue({ deletedCount: 1 } as DeleteResult);

      const result = await repo.delete('tenant-1', 'user-1');

      expect(result).toBe(true);
    });

    it('returns false when no document was deleted', async () => {
      collection.deleteOne.mockResolvedValue({ deletedCount: 0 } as DeleteResult);

      const result = await repo.delete('tenant-1', 'missing');

      expect(result).toBe(false);
    });
  });
});
