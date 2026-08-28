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
    role: 'OWNER',
    status: 'ACTIVE',
    invitation: null,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}

function makeInvitation() {
  return {
    status: 'PENDING',
    tokenHash: 'abc123hash',
    invitedBy: 'user-owner',
    invitedOn: new Date('2025-01-01T00:00:00Z'),
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
        id: 'member-123',
        userId: 'user-1',
        tenantId: 'tenant-1',
        role: 'OWNER',
        status: 'ACTIVE',
        expiresAt: null,
        invitation: null,
        displayName: null,
        email: null,
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
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
        .mockResolvedValue([makeDoc({ userId: 'user-1' }), makeDoc({ userId: 'user-2', role: 'MEMBER' })]);

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
          makeDoc({ tenantId: 't1', status: 'ACTIVE' }),
          makeDoc({ tenantId: 't2', role: 'MEMBER', status: 'ACTIVE' }),
        ]);

      collection.find.mockReturnValue({ toArray });

      const result = await repo.findByUser('user-1');

      expect(collection.find).toHaveBeenCalledWith({ userId: 'user-1' });
      expect(result).toHaveLength(2);
    });
  });

  describe('findByInvitationToken', () => {
    it('finds by tokenHash and pending status', async () => {
      const doc = makeDoc({
        invitation: makeInvitation(),
        status: 'ACTIVE',
      });

      collection.findOne.mockResolvedValue(doc);

      const result = await repo.findByInvitationToken('abc123hash');

      expect(collection.findOne).toHaveBeenCalledWith({
        'invitation.tokenHash': 'abc123hash',
        'invitation.status': 'PENDING',
      });
      expect(result).toBe(doc);
    });
  });

  describe('findPendingByEmail', () => {
    it('queries for pending invitations by invited email', async () => {
      const toArray = vi.fn().mockResolvedValue([makeDoc({ invitation: makeInvitation() })]);

      collection.find.mockReturnValue({ toArray });

      const result = await repo.findPendingByEmail('invited@example.com');

      expect(collection.find).toHaveBeenCalledWith({
        'invitation.invitedEmail': 'invited@example.com',
        'invitation.status': 'PENDING',
      });
      expect(result).toHaveLength(1);
    });
  });

  describe('countActiveByTenant', () => {
    it('returns the count of active members', async () => {
      collection.countDocuments.mockResolvedValue(3);

      const result = await repo.countActiveByTenant('tenant-1');

      expect(collection.countDocuments).toHaveBeenCalledWith({ tenantId: 'tenant-1', status: 'ACTIVE' });
      expect(result).toBe(3);
    });
  });

  describe('countOwnedTenants', () => {
    it('returns the count of owned tenants', async () => {
      collection.countDocuments.mockResolvedValue(1);

      const result = await repo.countOwnedTenants('user-1');

      expect(collection.countDocuments).toHaveBeenCalledWith({ userId: 'user-1', role: 'OWNER' });
      expect(result).toBe(1);
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

  describe('create', () => {
    it('creates an active member without invitation', async () => {
      collection.insertOne.mockResolvedValue({ acknowledged: true } as InsertOneResult);

      const result = await repo.create({
        userId: 'user-1',
        tenantId: 'tenant-1',
        role: 'OWNER',
        status: 'ACTIVE',
      });

      expect(collection.insertOne).toHaveBeenCalledTimes(1);

      const insertedDoc = collection.insertOne.mock.calls[0]?.[0] as TenantMemberDocument;

      expect(insertedDoc.userId).toBe('user-1');
      expect(insertedDoc.tenantId).toBe('tenant-1');
      expect(insertedDoc.role).toBe('OWNER');
      expect(insertedDoc.status).toBe('ACTIVE');
      expect(insertedDoc.invitation).toBeNull();
      expect(insertedDoc.id).toBeDefined();

      expect(result.role).toBe('OWNER');
      expect(result.invitation).toBeNull();
    });

    it('creates a member with embedded invitation', async () => {
      collection.insertOne.mockResolvedValue({ acknowledged: true } as InsertOneResult);

      const result = await repo.create({
        userId: 'user-2',
        tenantId: 'tenant-1',
        role: 'MEMBER',
        status: 'ACTIVE',
        invitation: makeInvitation(),
      });
      const insertedDoc = collection.insertOne.mock.calls[0]?.[0] as TenantMemberDocument;

      expect(insertedDoc.invitation).not.toBeNull();
      expect(insertedDoc.invitation?.status).toBe('PENDING');
      expect(insertedDoc.invitation?.tokenHash).toBe('abc123hash');
      expect(result.invitation).not.toBeNull();
    });
  });

  describe('update', () => {
    it('updates status and clears invitation', async () => {
      const updated = makeDoc({ status: 'ACTIVE', invitation: null });

      collection.findOneAndUpdate.mockResolvedValue(updated);

      const result = await repo.update('member-123', {
        status: 'ACTIVE',
        invitation: null,
      });

      expect(collection.findOneAndUpdate).toHaveBeenCalledWith(
        { id: 'member-123' },
        { $set: { status: 'ACTIVE', invitation: null, updatedAt: expect.any(Date) } },
        { returnDocument: 'after' },
      );
      expect(result?.status).toBe('ACTIVE');
      expect(result?.invitation).toBeNull();
    });

    it('returns null when member not found', async () => {
      collection.findOneAndUpdate.mockResolvedValue(null);

      const result = await repo.update('missing', { status: 'ACTIVE' });

      expect(result).toBeNull();
    });
  });

  describe('updateRole', () => {
    it('returns the updated member', async () => {
      const updated = makeDoc({ role: 'ADMIN' });

      collection.findOneAndUpdate.mockResolvedValue(updated);

      const result = await repo.updateRole('tenant-1', 'user-1', 'ADMIN');

      expect(collection.findOneAndUpdate).toHaveBeenCalledWith(
        { userId: 'user-1', tenantId: 'tenant-1' },
        { $set: { role: 'ADMIN', updatedAt: expect.any(Date) } },
        { returnDocument: 'after' },
      );
      expect(result?.role).toBe('ADMIN');
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
});
