import { randomUUID } from 'node:crypto';
import type { Collection } from 'mongodb';
import type { TaskType } from '@task-board/shared';

// Required MongoDB indexes:
// - { id: 1 } (unique)
// - { projectId: 1, key: 1 } (unique)

// ─── MongoDB Document Shape ───────────────────────────────────────────────────

export interface TaskTypeDocument {
  _id?: import('mongodb').ObjectId;
  id: string;
  projectId: string;
  key: string;
  name: string;
  icon: string | null;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Mapper ──────────────────────────────────────────────────────────────────

function toDomain(doc: TaskTypeDocument): TaskType {
  return {
    id: doc.id,
    projectId: doc.projectId,
    key: doc.key,
    name: doc.name,
    icon: doc.icon,
    position: doc.position,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

// ─── TaskType Repository ─────────────────────────────────────────────────────

export class TaskTypeRepository {
  constructor(private readonly collection: Collection<TaskTypeDocument>) {}

  async findById(id: string): Promise<TaskType | null> {
    const doc = await this.collection.findOne({ id });

    return doc ? toDomain(doc) : null;
  }

  async findByProject(projectId: string): Promise<TaskType[]> {
    const docs = await this.collection.find({ projectId }).sort({ position: 1 }).toArray();

    return docs.map(toDomain);
  }

  async findByProjectAndKey(projectId: string, key: string): Promise<TaskType | null> {
    const doc = await this.collection.findOne({ projectId, key });

    return doc ? toDomain(doc) : null;
  }

  async create(
    projectId: string,
    input: { key: string; name: string; icon?: string | null; position: number },
  ): Promise<TaskType> {
    const now = new Date();
    const doc: TaskTypeDocument = {
      id: randomUUID(),
      projectId,
      key: input.key,
      name: input.name,
      icon: input.icon ?? null,
      position: input.position,
      createdAt: now,
      updatedAt: now,
    };

    await this.collection.insertOne(doc);
    return toDomain(doc);
  }

  async createMany(
    projectId: string,
    items: { key: string; name: string; icon?: string | null; position: number }[],
  ): Promise<TaskType[]> {
    const now = new Date();
    const docs: TaskTypeDocument[] = items.map((item) => ({
      id: randomUUID(),
      projectId,
      key: item.key,
      name: item.name,
      icon: item.icon ?? null,
      position: item.position,
      createdAt: now,
      updatedAt: now,
    }));

    if (docs.length > 0) {
      await this.collection.insertMany(docs);
    }

    return docs.map(toDomain);
  }

  async update(
    id: string,
    input: Partial<Pick<TaskTypeDocument, 'name' | 'icon' | 'position'>>,
  ): Promise<TaskType | null> {
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

  /**
   * Delete all entities belonging to a project. Used for cascade delete.
   */
  async deleteByProject(projectId: string): Promise<void> {
    await this.collection.deleteMany({ projectId });
  }
}
