import { randomUUID } from 'node:crypto';
import { BaseRepository } from './base.repository.js';
import { TenantStatus } from '@task-board/shared';
import type { Tenant } from '@task-board/shared';

// Required MongoDB indexes:
// - { id: 1 } (unique)
// - { slug: 1 } (unique) — DEC-032 tenant slug lookup + global uniqueness

// ─── MongoDB Document Shape ───────────────────────────────────────────────────

export interface TenantDocument {
  _id?: import('mongodb').ObjectId;
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  deletionScheduledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Mapper ──────────────────────────────────────────────────────────────────

/** Exported for cross-repository aggregates (e.g. tenant-member $lookup joins). */
export function toDomain(doc: TenantDocument): Tenant {
  return {
    id: doc.id,
    name: doc.name,
    slug: doc.slug,
    description: doc.description,
    status: doc.status as Tenant['status'],
    deletionScheduledAt: doc.deletionScheduledAt ? doc.deletionScheduledAt.toISOString() : null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

// ─── Tenant Repository ───────────────────────────────────────────────────────

export class TenantRepository extends BaseRepository<TenantDocument, Tenant> {
  protected toDomain(doc: TenantDocument): Tenant {
    return toDomain(doc);
  }

  async findAll(): Promise<Tenant[]> {
    const docs = await this.collection.find().toArray();

    return docs.map(toDomain);
  }

  /** Find a tenant by its globally unique slug (DEC-032). */
  async findBySlug(slug: string): Promise<Tenant | null> {
    const doc = await this.collection.findOne({ slug });

    return doc ? toDomain(doc) : null;
  }

  /** Check whether a slug is already claimed by any tenant (DEC-032). */
  async slugExists(slug: string): Promise<boolean> {
    const doc = await this.collection.findOne({ slug }, { projection: { _id: 1 } });

    return doc !== null;
  }

  async create(input: { name: string; slug: string; description?: string }): Promise<Tenant> {
    const now = new Date();
    const doc: TenantDocument = {
      id: randomUUID(),
      name: input.name,
      slug: input.slug,
      description: input.description ?? null,
      status: TenantStatus.ACTIVE,
      deletionScheduledAt: null,
      createdAt: now,
      updatedAt: now,
    };

    await this.collection.insertOne(doc);
    return toDomain(doc);
  }

  async update(
    id: string,
    input: Partial<Pick<TenantDocument, 'name' | 'description' | 'status' | 'deletionScheduledAt'>>,
  ): Promise<Tenant | null> {
    const result = await this.collection.findOneAndUpdate(
      { id },
      { $set: { ...input, updatedAt: new Date() } },
      { returnDocument: 'after' },
    );

    return result ? toDomain(result) : null;
  }
}
