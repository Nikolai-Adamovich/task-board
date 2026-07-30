import { randomUUID } from 'node:crypto';
import type { Collection } from 'mongodb';
import type { Task } from '@task-board/shared';

// ─── MongoDB Document Shape ───────────────────────────────────────────────────

export interface TaskDocument {
  _id?: import('mongodb').ObjectId;
  id: string;
  tenantId: string;
  projectId: string;
  boardId: string;
  columnId: string;
  sprintId: string | null;
  title: string;
  description: string | null;
  assigneeIds: string[];
  priority: string;
  position: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Filter Types ────────────────────────────────────────────────────────────

export interface TaskFilters {
  projectId?: string;
  boardId?: string;
  columnId?: string;
  sprintId?: string;
  assigneeId?: string;
}

// ─── Mapper ──────────────────────────────────────────────────────────────────

function toDomain(doc: TaskDocument): Task {
  return {
    id: doc.id,
    tenantId: doc.tenantId,
    projectId: doc.projectId,
    boardId: doc.boardId,
    columnId: doc.columnId,
    sprintId: doc.sprintId,
    title: doc.title,
    description: doc.description ?? undefined,
    assigneeIds: doc.assigneeIds,
    priority: doc.priority as Task['priority'],
    position: doc.position,
    createdBy: doc.createdBy,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

// ─── Task Repository ─────────────────────────────────────────────────────────

export class TaskRepository {
  constructor(private readonly collection: Collection<TaskDocument>) {}

  async findById(tenantId: string, id: string): Promise<Task | null> {
    const doc = await this.collection.findOne({ id, tenantId });

    return doc ? toDomain(doc) : null;
  }

  async findByBoardAndColumn(tenantId: string, boardId: string, columnId: string): Promise<Task[]> {
    const docs = await this.collection.find({ tenantId, boardId, columnId }).sort({ position: 1 }).toArray();

    return docs.map(toDomain);
  }

  async findBySprint(tenantId: string, sprintId: string): Promise<Task[]> {
    const docs = await this.collection.find({ tenantId, sprintId }).sort({ position: 1 }).toArray();

    return docs.map(toDomain);
  }

  async findByProject(tenantId: string, projectId: string): Promise<Task[]> {
    const docs = await this.collection.find({ tenantId, projectId }).sort({ position: 1 }).toArray();

    return docs.map(toDomain);
  }

  async findByFilters(tenantId: string, filters: TaskFilters): Promise<Task[]> {
    const query: Record<string, unknown> = { tenantId };

    if (filters.projectId) query.projectId = filters.projectId;
    if (filters.boardId) query.boardId = filters.boardId;
    if (filters.columnId) query.columnId = filters.columnId;
    if (filters.sprintId) query.sprintId = filters.sprintId;
    if (filters.assigneeId) query.assigneeIds = filters.assigneeId;

    const docs = await this.collection.find(query).sort({ position: 1 }).toArray();

    return docs.map(toDomain);
  }

  async create(
    tenantId: string,
    input: {
      projectId: string;
      boardId: string;
      columnId: string;
      sprintId?: string;
      title: string;
      description?: string;
      assigneeIds?: string[];
      priority?: string;
      position: number;
      createdBy: string;
    },
  ): Promise<Task> {
    const now = new Date();
    const doc: TaskDocument = {
      id: randomUUID(),
      tenantId,
      projectId: input.projectId,
      boardId: input.boardId,
      columnId: input.columnId,
      sprintId: input.sprintId ?? null,
      title: input.title,
      description: input.description ?? null,
      assigneeIds: input.assigneeIds ?? [],
      priority: input.priority ?? 'medium',
      position: input.position,
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
    };

    await this.collection.insertOne(doc);
    return toDomain(doc);
  }

  async update(
    tenantId: string,
    id: string,
    input: Partial<
      Pick<TaskDocument, 'title' | 'description' | 'priority' | 'assigneeIds' | 'columnId' | 'sprintId' | 'position'>
    >,
  ): Promise<Task | null> {
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

  /**
   * Find all tasks where the given user is assigned, scoped to the provided tenant IDs.
   * Used for the cross-tenant "my tasks" feature.
   */
  async findByAssignee(userId: string, tenantIds: string[]): Promise<TaskDocument[]> {
    return this.collection
      .find({ assigneeIds: userId, tenantId: { $in: tenantIds } })
      .sort({ updatedAt: -1 })
      .toArray();
  }

  /**
   * Get the max position in a column for auto-assigning position.
   */
  async getMaxPosition(tenantId: string, boardId: string, columnId: string): Promise<number> {
    const docs = await this.collection.find({ tenantId, boardId, columnId }).sort({ position: -1 }).limit(1).toArray();

    return docs.length > 0 ? docs[0].position : -1;
  }
}
