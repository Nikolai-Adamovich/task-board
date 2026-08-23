import { randomUUID } from 'node:crypto';
import type { Collection } from 'mongodb';
import type { Sprint, SprintStatus } from '@task-board/shared';

// Required MongoDB indexes:
// - { id: 1 } (unique)
// - { projectId: 1, status: 1 }
// - { projectId: 1, startDate: 1 }

// ─── MongoDB Document Shape ───────────────────────────────────────────────────

export interface SprintDocument {
  _id?: import('mongodb').ObjectId;
  id: string;
  projectId: string;
  name: string;
  status: string;
  startDate: Date | null;
  endDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Mapper ──────────────────────────────────────────────────────────────────

function toDomain(doc: SprintDocument): Sprint {
  return {
    id: doc.id,
    projectId: doc.projectId,
    name: doc.name,
    status: doc.status as SprintStatus,
    startDate: doc.startDate ? doc.startDate.toISOString() : null,
    endDate: doc.endDate ? doc.endDate.toISOString() : null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

// ─── Sprint Repository ───────────────────────────────────────────────────────

export class SprintRepository {
  constructor(private readonly collection: Collection<SprintDocument>) {}

  async findById(id: string): Promise<Sprint | null> {
    const doc = await this.collection.findOne({ id });

    return doc ? toDomain(doc) : null;
  }

  async findByProject(projectId: string): Promise<Sprint[]> {
    const docs = await this.collection.find({ projectId }).sort({ createdAt: -1 }).toArray();

    return docs.map(toDomain);
  }

  async create(projectId: string, input: { name: string; startDate?: string; endDate?: string }): Promise<Sprint> {
    const now = new Date();
    const doc: SprintDocument = {
      id: randomUUID(),
      projectId,
      name: input.name,
      status: 'FUTURE',
      startDate: input.startDate ? new Date(input.startDate) : null,
      endDate: input.endDate ? new Date(input.endDate) : null,
      createdAt: now,
      updatedAt: now,
    };

    await this.collection.insertOne(doc);
    return toDomain(doc);
  }

  async update(
    id: string,
    input: {
      name?: string;
      status?: string;
      startDate?: string | Date | null;
      endDate?: string | Date | null;
    },
  ): Promise<Sprint | null> {
    const updateFields: Record<string, unknown> = { updatedAt: new Date() };

    if (input.name !== undefined) updateFields.name = input.name;
    if (input.status !== undefined) updateFields.status = input.status;
    if (input.startDate !== undefined) updateFields.startDate = input.startDate ? new Date(input.startDate) : null;
    if (input.endDate !== undefined) updateFields.endDate = input.endDate ? new Date(input.endDate) : null;

    const result = await this.collection.findOneAndUpdate({ id }, { $set: updateFields }, { returnDocument: 'after' });

    return result ? toDomain(result) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.collection.deleteOne({ id });

    return result.deletedCount > 0;
  }

  /**
   * Delete all entities belonging to a project. Used for cascade delete.
   */
  async deleteByProject(projectId: string): Promise<void> {
    await this.collection.deleteMany({ projectId });
  }
}
