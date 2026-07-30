import { randomUUID } from 'node:crypto';
import type { Collection } from 'mongodb';
import type { Tenant } from '@task-board/shared';

// Required MongoDB indexes:
// - { slug: 1 } (unique)
// - { id: 1 } (unique)

// ─── MongoDB Document Shape ───────────────────────────────────────────────────

export interface TenantDocument {
  _id?: import('mongodb').ObjectId;
  id: string;
  name: string;
  slug: string;
  subscription: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Mapper ──────────────────────────────────────────────────────────────────

function toDomain(doc: TenantDocument): Tenant {
  return {
    id: doc.id,
    name: doc.name,
    slug: doc.slug,
    subscription: doc.subscription as Tenant['subscription'],
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

// ─── Tenant Repository ───────────────────────────────────────────────────────

export class TenantRepository {
  constructor(private readonly collection: Collection<TenantDocument>) {}

  async findById(id: string): Promise<Tenant | null> {
    const doc = await this.collection.findOne({ id });

    return doc ? toDomain(doc) : null;
  }

  async findBySlug(slug: string): Promise<Tenant | null> {
    const doc = await this.collection.findOne({ slug });

    return doc ? toDomain(doc) : null;
  }

  async findAll(): Promise<Tenant[]> {
    const docs = await this.collection.find().toArray();

    return docs.map(toDomain);
  }

  async create(input: { name: string; slug: string; subscription?: string }): Promise<Tenant> {
    const now = new Date();
    const doc: TenantDocument = {
      id: randomUUID(),
      name: input.name,
      slug: input.slug,
      subscription: input.subscription ?? 'free',
      createdAt: now,
      updatedAt: now,
    };

    await this.collection.insertOne(doc);
    return toDomain(doc);
  }

  async update(id: string, input: Partial<Pick<TenantDocument, 'name' | 'slug'>>): Promise<Tenant | null> {
    const result = await this.collection.findOneAndUpdate(
      { id },
      { $set: { ...input, updatedAt: new Date() } },
      { returnDocument: 'after' },
    );

    return result ? toDomain(result) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.collection.deleteOne({ id });

    return result.deletedCount > 0;
  }
}
