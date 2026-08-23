import { randomUUID } from 'node:crypto';
import type { Collection } from 'mongodb';
import type { Task, IdentitySnapshot } from '@task-board/shared';

// Required MongoDB indexes:
// - { id: 1 } (unique)
// - { projectId: 1, number: -1 }
// - { projectId: 1, createdAt: -1 }
// - { projectId: 1, updatedAt: -1 }
// - { projectId: 1, statusId: 1, number: -1 }
// - { projectId: 1, sprintId: 1, number: -1 }
// - { projectId: 1, assigneeId: 1, number: -1 }
// - { projectId: 1, reporterId: 1, number: -1 }
// - { projectId: 1, priority: 1, number: -1 }
// - { projectId: 1, typeId: 1, number: -1 }

// ─── MongoDB Document Shape ───────────────────────────────────────────────────

export interface TaskDocument {
  _id?: import('mongodb').ObjectId;
  id: string;
  projectId: string;
  number: number;
  typeId: string;
  title: string;
  description: string | null;
  statusId: string;
  priority: string;
  reporterId: string | null;
  reporterSnapshot: IdentitySnapshot | null;
  assigneeId: string | null;
  assigneeSnapshot: IdentitySnapshot | null;
  sprintId: string | null;
  labelIds: string[];
  createdById: string;
  createdBySnapshot: IdentitySnapshot;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Filter Types ────────────────────────────────────────────────────────────

export interface TaskQueryOptions {
  page?: number;
  limit?: number;
  sort?: { field: string; direction: 'asc' | 'desc' };
  statusId?: string;
  priority?: string;
  typeId?: string;
  assigneeId?: string;
  reporterId?: string;
  sprintId?: string;
  labelId?: string;
  search?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ─── Mapper ──────────────────────────────────────────────────────────────────

function toDomain(doc: TaskDocument): Task {
  return {
    id: doc.id,
    projectId: doc.projectId,
    number: doc.number,
    typeId: doc.typeId,
    title: doc.title,
    description: doc.description,
    statusId: doc.statusId,
    priority: doc.priority as Task['priority'],
    reporterId: doc.reporterId,
    reporterSnapshot: doc.reporterSnapshot,
    assigneeId: doc.assigneeId,
    assigneeSnapshot: doc.assigneeSnapshot,
    sprintId: doc.sprintId,
    labelIds: doc.labelIds,
    createdById: doc.createdById,
    createdBySnapshot: doc.createdBySnapshot,
    version: doc.version,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

// ─── Task Repository ─────────────────────────────────────────────────────────

export class TaskRepository {
  constructor(private readonly collection: Collection<TaskDocument>) {}

  async findById(id: string): Promise<Task | null> {
    const doc = await this.collection.findOne({ id });

    return doc ? toDomain(doc) : null;
  }

  async findByProjectAndNumber(projectId: string, number: number): Promise<Task | null> {
    const doc = await this.collection.findOne({ projectId, number });

    return doc ? toDomain(doc) : null;
  }

  /**
   * Find tasks by project with optional filters, pagination, and sort.
   */
  async findByProject(projectId: string, options: TaskQueryOptions = {}): Promise<PaginatedResult<Task>> {
    const {
      page = 1,
      limit = 20,
      sort,
      statusId,
      priority,
      typeId,
      assigneeId,
      reporterId,
      sprintId,
      labelId,
      search,
    } = options;
    const query: Record<string, unknown> = { projectId };

    if (statusId) query.statusId = statusId;
    if (priority) query.priority = priority;
    if (typeId) query.typeId = typeId;
    if (assigneeId) query.assigneeId = assigneeId;
    if (reporterId) query.reporterId = reporterId;
    if (sprintId) query.sprintId = sprintId;
    if (labelId) query.labelIds = labelId;
    if (search) {
      const regex = { $regex: search, $options: 'i' };

      query.$or = [
        { title: regex },
        { description: regex },
        { 'createdBySnapshot.displayName': regex },
        { 'assigneeSnapshot.displayName': regex },
        { 'reporterSnapshot.displayName': regex },
      ];
    }

    const sortField = sort?.field ?? 'number';
    const sortDir = sort?.direction === 'asc' ? 1 : -1;
    const skip = (page - 1) * limit;
    const [docs, total] = await Promise.all([
      this.collection
        .find(query)
        .sort({ [sortField]: sortDir })
        .skip(skip)
        .limit(limit)
        .toArray(),
      this.collection.countDocuments(query),
    ]);

    return {
      data: docs.map(toDomain),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async create(input: {
    projectId: string;
    number: number;
    typeId: string;
    title: string;
    description?: string;
    statusId: string;
    priority: string;
    reporterId?: string;
    reporterSnapshot?: IdentitySnapshot;
    assigneeId?: string;
    assigneeSnapshot?: IdentitySnapshot;
    sprintId?: string;
    labelIds?: string[];
    createdById: string;
    createdBySnapshot: IdentitySnapshot;
  }): Promise<Task> {
    const now = new Date();
    const doc: TaskDocument = {
      id: randomUUID(),
      projectId: input.projectId,
      number: input.number,
      typeId: input.typeId,
      title: input.title,
      description: input.description ?? null,
      statusId: input.statusId,
      priority: input.priority,
      reporterId: input.reporterId ?? null,
      reporterSnapshot: input.reporterSnapshot ?? null,
      assigneeId: input.assigneeId ?? null,
      assigneeSnapshot: input.assigneeSnapshot ?? null,
      sprintId: input.sprintId ?? null,
      labelIds: input.labelIds ?? [],
      createdById: input.createdById,
      createdBySnapshot: input.createdBySnapshot,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    await this.collection.insertOne(doc);
    return toDomain(doc);
  }

  /**
   * Atomic update with optimistic concurrency check.
   * Uses findOneAndUpdate with version check + $inc.
   * Returns null if version mismatch (concurrent modification).
   */
  async updateWithVersion(
    id: string,
    currentVersion: number,
    update: Partial<
      Pick<
        TaskDocument,
        | 'title'
        | 'description'
        | 'statusId'
        | 'priority'
        | 'reporterId'
        | 'reporterSnapshot'
        | 'assigneeId'
        | 'assigneeSnapshot'
        | 'typeId'
        | 'sprintId'
        | 'labelIds'
      >
    >,
  ): Promise<Task | null> {
    const result = await this.collection.findOneAndUpdate(
      { id, version: currentVersion },
      {
        $set: { ...update, updatedAt: new Date() },
        $inc: { version: 1 },
      },
      { returnDocument: 'after' },
    );

    return result ? toDomain(result) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.collection.deleteOne({ id });

    return result.deletedCount > 0;
  }

  /**
   * Count tasks with a given status in a project.
   */
  async countByStatus(projectId: string, statusId: string): Promise<number> {
    return this.collection.countDocuments({ projectId, statusId });
  }

  /**
   * Bulk update all tasks with a given status to a new status.
   */
  async updateManyByStatus(projectId: string, oldStatusId: string, newStatusId: string): Promise<void> {
    await this.collection.updateMany(
      { projectId, statusId: oldStatusId },
      { $set: { statusId: newStatusId, updatedAt: new Date() } },
    );
  }

  /**
   * Count tasks with a given type in a project.
   */
  async countByType(projectId: string, typeId: string): Promise<number> {
    return this.collection.countDocuments({ projectId, typeId });
  }

  /**
   * Bulk update all tasks with a given type to a new type.
   */
  async updateManyByType(projectId: string, oldTypeId: string, newTypeId: string): Promise<void> {
    await this.collection.updateMany(
      { projectId, typeId: oldTypeId },
      { $set: { typeId: newTypeId, updatedAt: new Date() } },
    );
  }

  /**
   * Remove a label ID from all tasks in a project.
   */
  async removeLabelFromAll(projectId: string, labelId: string): Promise<void> {
    await this.collection.updateMany(
      { projectId, labelIds: labelId },
      { $pull: { labelIds: labelId }, $set: { updatedAt: new Date() } },
    );
  }

  /**
   * Unassign sprint from all tasks with a given sprint.
   */
  async clearSprintFromTasks(projectId: string, sprintId: string): Promise<void> {
    await this.collection.updateMany({ projectId, sprintId }, { $set: { sprintId: null, updatedAt: new Date() } });
  }

  /**
   * Search tasks by text across number, title, description, and snapshots.
   */
  async search(projectId: string, searchTerm: string): Promise<Task[]> {
    const regex = { $regex: searchTerm, $options: 'i' };
    const query = {
      projectId,
      $or: [
        { title: regex },
        { description: regex },
        { 'createdBySnapshot.displayName': regex },
        { 'assigneeSnapshot.displayName': regex },
        { 'reporterSnapshot.displayName': regex },
      ],
    };
    const docs = await this.collection.find(query).sort({ number: -1 }).limit(50).toArray();

    return docs.map(toDomain);
  }

  /**
   * Delete all entities belonging to a project. Used for cascade delete.
   */
  async deleteByProject(projectId: string): Promise<void> {
    await this.collection.deleteMany({ projectId });
  }
}
