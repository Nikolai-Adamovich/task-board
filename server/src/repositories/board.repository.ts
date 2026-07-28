import { randomUUID } from 'node:crypto';
import type { Collection } from 'mongodb';
import type { Board } from '@task-board/shared';

// ─── MongoDB Document Shape ───────────────────────────────────────────────────

export interface BoardDocument {
  _id?: import('mongodb').ObjectId;
  id: string;
  tenantId: string;
  projectId: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Mapper ──────────────────────────────────────────────────────────────────

function toDomain(doc: BoardDocument): Board {
  return {
    id: doc.id,
    tenantId: doc.tenantId,
    projectId: doc.projectId,
    name: doc.name,
    description: doc.description ?? undefined,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

// ─── Board Repository ────────────────────────────────────────────────────────

export class BoardRepository {
  constructor(private readonly collection: Collection<BoardDocument>) {}

  async findById(tenantId: string, id: string): Promise<Board | null> {
    const doc = await this.collection.findOne({ id, tenantId });
    return doc ? toDomain(doc) : null;
  }

  async findByProject(tenantId: string, projectId: string): Promise<Board[]> {
    const docs = await this.collection.find({ tenantId, projectId }).toArray();
    return docs.map(toDomain);
  }

  async create(tenantId: string, input: { projectId: string; name: string; description?: string }): Promise<Board> {
    const now = new Date();
    const doc: BoardDocument = {
      id: randomUUID(),
      tenantId,
      projectId: input.projectId,
      name: input.name,
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
    input: Partial<Pick<BoardDocument, 'name' | 'description'>>,
  ): Promise<Board | null> {
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
