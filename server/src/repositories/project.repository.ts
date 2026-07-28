import { randomUUID } from 'node:crypto';
import type { Collection } from 'mongodb';
import type { Project } from '@task-board/shared';

// ─── MongoDB Document Shape ───────────────────────────────────────────────────

export interface ProjectDocument {
  _id?: import('mongodb').ObjectId;
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Mapper ──────────────────────────────────────────────────────────────────

function toDomain(doc: ProjectDocument): Project {
  return {
    id: doc.id,
    tenantId: doc.tenantId,
    name: doc.name,
    slug: doc.slug,
    description: doc.description ?? undefined,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

// ─── Project Repository ──────────────────────────────────────────────────────

export class ProjectRepository {
  constructor(private readonly collection: Collection<ProjectDocument>) {}

  async findById(tenantId: string, id: string): Promise<Project | null> {
    const doc = await this.collection.findOne({ id, tenantId });

    return doc ? toDomain(doc) : null;
  }

  async findByTenant(tenantId: string): Promise<Project[]> {
    const docs = await this.collection.find({ tenantId }).toArray();

    return docs.map(toDomain);
  }

  async findBySlug(tenantId: string, slug: string): Promise<Project | null> {
    const doc = await this.collection.findOne({ tenantId, slug });

    return doc ? toDomain(doc) : null;
  }

  async create(tenantId: string, input: { name: string; slug: string; description?: string }): Promise<Project> {
    const now = new Date();
    const doc: ProjectDocument = {
      id: randomUUID(),
      tenantId,
      name: input.name,
      slug: input.slug,
      description: input.description ?? null,
      createdAt: now,
      updatedAt: now,
    };

    await this.collection.insertOne(doc);
    return toDomain(doc);
  }

  async update(
    tenantId: string,
    id: string,
    input: Partial<Pick<ProjectDocument, 'name' | 'slug' | 'description'>>,
  ): Promise<Project | null> {
    const result = await this.collection.findOneAndUpdate(
      { id, tenantId },
      { $set: { ...input, updatedAt: new Date() } },
      { returnDocument: 'after' },
    );

    return result ? toDomain(result) : null;
  }

  async delete(tenantId: string, id: string): Promise<boolean> {
    const result = await this.collection.deleteOne({ id, tenantId });

    return result.deletedCount > 0;
  }
}
