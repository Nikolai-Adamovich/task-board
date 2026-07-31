import { randomUUID } from 'node:crypto';
import type { Collection } from 'mongodb';
import { MemberStatus, TenantRole } from '@task-board/shared';
import type { TenantMember } from '@task-board/shared';

// Required MongoDB indexes:
// - { userId: 1, tenantId: 1 } (unique, partial filter: { userId: { $ne: null } })
// - { invitationToken: 1 } (unique, sparse)
// - { invitedEmail: 1, tenantId: 1 } (unique, sparse)
// - { tenantId: 1 }
// - { id: 1 } (unique)

// ─── MongoDB Document Shape ───────────────────────────────────────────────────

export interface TenantMemberDocument {
  _id?: import('mongodb').ObjectId;
  id: string;
  userId: string | null;
  tenantId: string;
  role: string;
  status: string;
  invitedEmail: string | null;
  invitationToken: string | null;
  invitedAt: Date | null;
  createdAt: Date;
}

// ─── Mapper ──────────────────────────────────────────────────────────────────

function toDomain(doc: TenantMemberDocument): TenantMember {
  return {
    userId: doc.userId,
    tenantId: doc.tenantId,
    role: doc.role as TenantMember['role'],
    status: doc.status as TenantMember['status'],
    invitedEmail: doc.invitedEmail,
    invitationToken: doc.invitationToken,
    invitedAt: doc.invitedAt ? doc.invitedAt.toISOString() : null,
  };
}

// ─── Tenant Member Repository ────────────────────────────────────────────────

export class TenantMemberRepository {
  constructor(private readonly collection: Collection<TenantMemberDocument>) {}

  async findByUserAndTenant(userId: string, tenantId: string): Promise<TenantMember | null> {
    const doc = await this.collection.findOne({ userId, tenantId });

    return doc ? toDomain(doc) : null;
  }

  async findByTenant(tenantId: string): Promise<TenantMember[]> {
    const docs = await this.collection.find({ tenantId }).toArray();

    return docs.map(toDomain);
  }

  async findByUser(userId: string): Promise<TenantMember[]> {
    const docs = await this.collection.find({ userId }).toArray();

    return docs.map(toDomain);
  }

  async findByInvitationToken(token: string): Promise<TenantMemberDocument | null> {
    return this.collection.findOne({ invitationToken: token });
  }

  async findPendingByEmail(email: string): Promise<TenantMemberDocument[]> {
    return this.collection.find({ invitedEmail: email, status: MemberStatus.Pending }).toArray();
  }

  async activateInvitation(token: string, userId: string): Promise<TenantMember | null> {
    const result = await this.collection.findOneAndUpdate(
      { invitationToken: token, status: MemberStatus.Pending },
      { $set: { userId, status: MemberStatus.Active, invitedAt: null } },
      { returnDocument: 'after' },
    );

    return result ? toDomain(result) : null;
  }

  async findByInvitedEmailAndTenant(email: string, tenantId: string): Promise<TenantMemberDocument | null> {
    return this.collection.findOne({ invitedEmail: email, tenantId, status: MemberStatus.Pending });
  }

  async countActiveByTenant(tenantId: string): Promise<number> {
    return this.collection.countDocuments({ tenantId, status: MemberStatus.Active });
  }

  async countOwnedTenants(userId: string): Promise<number> {
    return this.collection.countDocuments({ userId, role: TenantRole.Owner });
  }

  async findPendingByTenant(tenantId: string): Promise<TenantMemberDocument[]> {
    return this.collection.find({ tenantId, status: MemberStatus.Pending }).toArray();
  }

  async findById(id: string): Promise<TenantMemberDocument | null> {
    return this.collection.findOne({ id });
  }

  async updateStatusById(id: string, status: string): Promise<TenantMember | null> {
    const result = await this.collection.findOneAndUpdate({ id }, { $set: { status } }, { returnDocument: 'after' });

    return result ? toDomain(result) : null;
  }

  async deleteById(id: string): Promise<boolean> {
    const result = await this.collection.deleteOne({ id });

    return result.deletedCount > 0;
  }

  async findByEmail(email: string): Promise<TenantMemberDocument[]> {
    return this.collection
      .find({
        $or: [{ invitedEmail: email }, { userId: email }],
      })
      .toArray();
  }

  async findByInvitedEmail(email: string): Promise<TenantMemberDocument[]> {
    return this.collection.find({ invitedEmail: email }).toArray();
  }

  async create(input: {
    userId: string | null;
    tenantId: string;
    role: string;
    status: string;
    invitedEmail?: string | null;
    invitationToken?: string | null;
  }): Promise<TenantMember> {
    const doc: TenantMemberDocument = {
      id: randomUUID(),
      userId: input.userId,
      tenantId: input.tenantId,
      role: input.role,
      status: input.status ?? MemberStatus.Active,
      invitedEmail: input.invitedEmail ?? null,
      invitationToken: input.invitationToken ?? null,
      invitedAt: input.status === MemberStatus.Pending ? new Date() : null,
      createdAt: new Date(),
    };

    await this.collection.insertOne(doc);
    return toDomain(doc);
  }

  async updateRole(tenantId: string, userId: string, role: string): Promise<TenantMember | null> {
    const result = await this.collection.findOneAndUpdate(
      { userId, tenantId },
      { $set: { role } },
      { returnDocument: 'after' },
    );

    return result ? toDomain(result) : null;
  }

  async updateStatus(tenantId: string, userId: string, status: string): Promise<TenantMember | null> {
    const result = await this.collection.findOneAndUpdate(
      { userId, tenantId },
      { $set: { status } },
      { returnDocument: 'after' },
    );

    return result ? toDomain(result) : null;
  }

  async delete(tenantId: string, userId: string): Promise<boolean> {
    const result = await this.collection.deleteOne({ userId, tenantId });

    return result.deletedCount > 0;
  }
}
