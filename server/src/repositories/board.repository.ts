import { randomUUID } from 'node:crypto';
import type { Collection } from 'mongodb';
import type { Board } from '@task-board/shared';

// Required MongoDB indexes:
// - { id: 1 } (unique)
// - { projectId: 1 }

// ─── MongoDB Document Shape ───────────────────────────────────────────────────

export interface BoardColumnDocument {
  id: string;
  statusIds: string[];
  position: number;
}

export interface BoardDocument {
  _id?: import('mongodb').ObjectId;
  id: string;
  projectId: string;
  name: string;
  type: string;
  columns: BoardColumnDocument[];
  createdAt: Date;
  updatedAt: Date;
}

// ─── Mapper ──────────────────────────────────────────────────────────────────

function toDomain(doc: BoardDocument): Board {
  return {
    id: doc.id,
    projectId: doc.projectId,
    name: doc.name,
    type: doc.type as Board['type'],
    columns: doc.columns.map((col) => ({
      id: col.id,
      statusIds: col.statusIds,
      position: col.position,
    })),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

// ─── Board Repository ────────────────────────────────────────────────────────

export class BoardRepository {
  constructor(private readonly collection: Collection<BoardDocument>) {}

  async findById(id: string): Promise<Board | null> {
    const doc = await this.collection.findOne({ id });

    return doc ? toDomain(doc) : null;
  }

  async findByProject(projectId: string): Promise<Board[]> {
    const docs = await this.collection.find({ projectId }).toArray();

    return docs.map(toDomain);
  }

  async create(
    projectId: string,
    input: {
      name: string;
      type: string;
      columns: { id: string; statusIds: string[]; position: number }[];
    },
  ): Promise<Board> {
    const now = new Date();
    const doc: BoardDocument = {
      id: randomUUID(),
      projectId,
      name: input.name,
      type: input.type,
      columns: input.columns,
      createdAt: now,
      updatedAt: now,
    };

    await this.collection.insertOne(doc);
    return toDomain(doc);
  }

  async update(id: string, input: Partial<Pick<BoardDocument, 'name' | 'columns'>>): Promise<Board | null> {
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
   * Replace a status ID in all columns across all boards in a project.
   * Used when deleting a status with a replacement.
   */
  async replaceStatusInColumns(projectId: string, oldStatusId: string, newStatusId: string): Promise<void> {
    await this.collection.updateMany(
      { projectId, 'columns.statusIds': oldStatusId },
      { $set: { 'columns.$[col].statusIds.$[sid]': newStatusId, updatedAt: new Date() } },
      { arrayFilters: [{ 'col.statusIds': oldStatusId }, { sid: oldStatusId }] },
    );
  }

  /**
   * Delete all entities belonging to a project. Used for cascade delete.
   */
  async deleteByProject(projectId: string): Promise<void> {
    await this.collection.deleteMany({ projectId });
  }
}
