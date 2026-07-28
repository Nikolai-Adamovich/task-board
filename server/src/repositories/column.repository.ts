import { randomUUID } from 'node:crypto';
import type { Collection } from 'mongodb';
import type { Column } from '@task-board/shared';

// ─── MongoDB Document Shape ───────────────────────────────────────────────────

export interface ColumnDocument {
  _id?: import('mongodb').ObjectId;
  id: string;
  boardId: string;
  tenantId: string;
  name: string;
  position: number;
  isDefault: boolean;
  createdAt: Date;
}

// ─── Mapper ──────────────────────────────────────────────────────────────────

function toDomain(doc: ColumnDocument): Column {
  return {
    id: doc.id,
    boardId: doc.boardId,
    tenantId: doc.tenantId,
    name: doc.name,
    position: doc.position,
    isDefault: doc.isDefault,
    createdAt: doc.createdAt.toISOString(),
  };
}

// ─── Column Repository ───────────────────────────────────────────────────────

export class ColumnRepository {
  constructor(private readonly collection: Collection<ColumnDocument>) {}

  async findById(tenantId: string, id: string): Promise<Column | null> {
    const doc = await this.collection.findOne({ id, tenantId });

    return doc ? toDomain(doc) : null;
  }

  async findByBoard(tenantId: string, boardId: string): Promise<Column[]> {
    const docs = await this.collection.find({ tenantId, boardId }).sort({ position: 1 }).toArray();

    return docs.map(toDomain);
  }

  async create(
    tenantId: string,
    input: {
      boardId: string;
      name: string;
      position: number;
      isDefault?: boolean;
    },
  ): Promise<Column> {
    const doc: ColumnDocument = {
      id: randomUUID(),
      boardId: input.boardId,
      tenantId,
      name: input.name,
      position: input.position,
      isDefault: input.isDefault ?? false,
      createdAt: new Date(),
    };

    await this.collection.insertOne(doc);
    return toDomain(doc);
  }

  async update(
    tenantId: string,
    id: string,
    input: Partial<Pick<ColumnDocument, 'name' | 'position'>>,
  ): Promise<Column | null> {
    const result = await this.collection.findOneAndUpdate(
      { id, tenantId },
      { $set: input },
      { returnDocument: 'after' },
    );

    return result ? toDomain(result) : null;
  }

  async delete(tenantId: string, id: string): Promise<boolean> {
    const result = await this.collection.deleteOne({ id, tenantId });

    return result.deletedCount > 0;
  }

  /**
   * Reorder columns within a board.
   * Updates each column's position to match the order in `columnIds`.
   */
  async reorder(tenantId: string, boardId: string, columnIds: string[]): Promise<void> {
    const bulkOps = columnIds.map((id, index) => ({
      updateOne: {
        filter: { id, boardId, tenantId },
        update: { $set: { position: index } },
      },
    }));

    await this.collection.bulkWrite(bulkOps);
  }
}
