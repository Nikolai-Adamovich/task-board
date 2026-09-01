import { randomUUID } from 'node:crypto';
import type { Collection } from 'mongodb';
import type { BoardConfig } from '@task-board/shared';

// Required MongoDB indexes:
// - { projectId: 1 } (unique) — the board's natural identifier (single-board model)

// ─── MongoDB Document Shape ───────────────────────────────────────────────────

export interface BoardColumnDocument {
  id: string;
  statusIds: string[];
  position: number;
}

export interface BoardDocument {
  _id?: import('mongodb').ObjectId;
  /** Owning project ID — unique; there is no separate board id */
  projectId: string;
  columns: BoardColumnDocument[];
  createdAt: Date;
  updatedAt: Date;
}

// ─── Mapper ──────────────────────────────────────────────────────────────────

function toDomain(doc: BoardDocument): BoardConfig {
  return {
    projectId: doc.projectId,
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

  /** The project's single board (null when missing — should never happen post-seed). */
  async findByProject(projectId: string): Promise<BoardConfig | null> {
    const doc = await this.collection.findOne({ projectId });

    return doc ? toDomain(doc) : null;
  }

  /** Create the project's board (called once from the project seed). */
  async create(projectId: string, columns: { statusIds: string[]; position: number }[]): Promise<BoardConfig> {
    const now = new Date();
    const doc: BoardDocument = {
      projectId,
      columns: columns.map((col) => ({
        id: randomUUID(),
        statusIds: col.statusIds,
        position: col.position,
      })),
      createdAt: now,
      updatedAt: now,
    };

    await this.collection.insertOne(doc);
    return toDomain(doc);
  }

  /** Replace the board's columns (workflow edit). */
  async updateColumns(
    projectId: string,
    columns: { id?: string; statusIds: string[]; position: number }[],
  ): Promise<BoardConfig | null> {
    const result = await this.collection.findOneAndUpdate(
      { projectId },
      {
        $set: {
          columns: columns.map((col) => ({
            id: col.id ?? randomUUID(),
            statusIds: col.statusIds,
            position: col.position,
          })),
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' },
    );

    return result ? toDomain(result) : null;
  }

  /**
   * Replace a status ID in the board's columns.
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
   * Delete the board(s) belonging to a project. Used for cascade delete —
   * the board dies with its project, never independently.
   */
  async deleteByProject(projectId: string): Promise<void> {
    await this.collection.deleteMany({ projectId });
  }
}
