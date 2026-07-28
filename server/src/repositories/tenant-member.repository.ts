import type { Collection } from 'mongodb';
import type { TenantMember } from '@task-board/shared';

// ─── MongoDB Document Shape ───────────────────────────────────────────────────

export interface TenantMemberDocument {
  _id?: import('mongodb').ObjectId;
  userId: string;
  tenantId: string;
  role: string;
  createdAt: Date;
}

// ─── Mapper ──────────────────────────────────────────────────────────────────

function toDomain(doc: TenantMemberDocument): TenantMember {
  return {
    userId: doc.userId,
    tenantId: doc.tenantId,
    role: doc.role as TenantMember['role'],
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

  async create(input: { userId: string; tenantId: string; role: string }): Promise<TenantMember> {
    const doc: TenantMemberDocument = {
      userId: input.userId,
      tenantId: input.tenantId,
      role: input.role,
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

  async delete(tenantId: string, userId: string): Promise<boolean> {
    const result = await this.collection.deleteOne({ userId, tenantId });
    return result.deletedCount > 0;
  }
}
