import { randomUUID } from 'node:crypto';
import type { Collection } from 'mongodb';
import { MemberStatus, InvitationStatus, TenantRole } from '@task-board/shared';
import type { TenantMember, Invitation } from '@task-board/shared';

// Required MongoDB indexes:
// - { tenantId: 1, userId: 1 } (unique)
// - { id: 1 } (unique)
// - { tenantId: 1 }

// ─── MongoDB Document Shape ───────────────────────────────────────────────────

export interface InvitationDocument {
  status: string;
  tokenHash: string;
  invitedBy: string;
  invitedOn: Date;
}

export interface TenantMemberDocument {
  _id?: import('mongodb').ObjectId;
  id: string;
  tenantId: string;
  userId: string;
  role: string;
  status: string;
  invitation: InvitationDocument | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Mapper ──────────────────────────────────────────────────────────────────

function toDomain(doc: TenantMemberDocument): TenantMember {
  return {
    id: doc.id,
    tenantId: doc.tenantId,
    userId: doc.userId,
    role: doc.role as TenantMember['role'],
    status: doc.status as TenantMember['status'],
    invitation: doc.invitation
      ? {
          status: doc.invitation.status as Invitation['status'],
          tokenHash: doc.invitation.tokenHash,
          invitedBy: doc.invitation.invitedBy,
          invitedOn: doc.invitation.invitedOn.toISOString(),
        }
      : null,
    displayName: null,
    email: null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
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

  async findById(id: string): Promise<TenantMemberDocument | null> {
    return this.collection.findOne({ id });
  }

  async countActiveByTenant(tenantId: string): Promise<number> {
    return this.collection.countDocuments({ tenantId, status: MemberStatus.ACTIVE });
  }

  async countOwnedTenants(userId: string): Promise<number> {
    return this.collection.countDocuments({ userId, role: TenantRole.OWNER });
  }

  async findByInvitedEmail(email: string): Promise<TenantMemberDocument[]> {
    return this.collection.find({ 'invitation.invitedEmail': email }).toArray();
  }

  async findPendingByEmail(email: string): Promise<TenantMemberDocument[]> {
    return this.collection
      .find({
        'invitation.invitedEmail': email,
        'invitation.status': InvitationStatus.PENDING,
      })
      .toArray();
  }

  async findByInvitationToken(tokenHash: string): Promise<TenantMemberDocument | null> {
    return this.collection.findOne({
      'invitation.tokenHash': tokenHash,
      'invitation.status': InvitationStatus.PENDING,
    });
  }

  async create(input: {
    tenantId: string;
    userId: string;
    role: string;
    status: string;
    invitation?: InvitationDocument | null;
  }): Promise<TenantMember> {
    const now = new Date();
    const doc: TenantMemberDocument = {
      id: randomUUID(),
      tenantId: input.tenantId,
      userId: input.userId,
      role: input.role,
      status: input.status,
      invitation: input.invitation ?? null,
      createdAt: now,
      updatedAt: now,
    };

    await this.collection.insertOne(doc);
    return toDomain(doc);
  }

  async update(
    id: string,
    input: Partial<Pick<TenantMemberDocument, 'role' | 'status' | 'invitation'>>,
  ): Promise<TenantMember | null> {
    const result = await this.collection.findOneAndUpdate(
      { id },
      { $set: { ...input, updatedAt: new Date() } },
      { returnDocument: 'after' },
    );

    return result ? toDomain(result) : null;
  }

  async updateRole(tenantId: string, userId: string, role: string): Promise<TenantMember | null> {
    const result = await this.collection.findOneAndUpdate(
      { userId, tenantId },
      { $set: { role, updatedAt: new Date() } },
      { returnDocument: 'after' },
    );

    return result ? toDomain(result) : null;
  }

  async delete(tenantId: string, userId: string): Promise<boolean> {
    const result = await this.collection.deleteOne({ userId, tenantId });

    return result.deletedCount > 0;
  }

  async deleteById(id: string): Promise<boolean> {
    const result = await this.collection.deleteOne({ id });

    return result.deletedCount > 0;
  }
}
