import { BaseRepository } from './base.repository.js';
import { randomUUID } from 'node:crypto';
import type { Document } from 'mongodb';
import type { Task, IdentitySnapshot } from '@task-board/shared';
import { escapeRegExp } from '../utils/regex.js';

// Required MongoDB indexes:
// - { id: 1 } (unique)
// - { projectId: 1, number: -1 }
// - { projectId: 1, createdAt: -1 }
// - { projectId: 1, updatedAt: -1 }
// - { projectId: 1, statusId: 1, number: -1 }
// - { projectId: 1, sprintId: 1, number: -1 }
// - { projectId: 1, assigneeId: 1, number: 1 }   (aligned tiebreaker — one index serves both directions)
// - { projectId: 1, reporterId: 1, number: 1 }   (aligned tiebreaker)
// - { projectId: 1, priority: 1, number: 1 }     (aligned tiebreaker)
// - { projectId: 1, typeId: 1, number: 1 }       (aligned tiebreaker)
// - { assigneeId: 1, updatedAt: -1 } (cross-project /tasks/my — audit #3)
// - { projectId: 1, statusName: 1, number: -1 } (TOP-2 semantic sort)
// - { projectId: 1, sprintName: 1, number: -1 } (TOP-2 semantic sort)

/** Sort fields that require resolving relation names / snapshots / priority rank before sorting. */
/**
 * TOP-2: `statusId`/`sprintId` sorts moved OFF the aggregation pipeline — the
 * denormalized `statusName`/`sprintName` fields are plain indexed document
 * keys now (see SEMANTIC_TO_DOC_KEY). Only `labelIds` still needs the
 * $lookup pipeline (alphabetically-first label of a task's label set is not
 * denormalized — its fan-out cost was judged too high for the benefit).
 */
const SEMANTIC_SORT_FIELDS = new Set(['labelIds']);
/** Plain-field sorts whose indexes carry an ALIGNED `number` tiebreaker (see findByProject). */
const ALIGNED_TIEBREAKER_FIELDS = new Set(['priority', 'assigneeId', 'reporterId', 'typeId']);
/** API sort field → denormalized document key (plain-indexed sorts). */
const SEMANTIC_TO_DOC_KEY: Record<string, string> = {
  statusId: 'statusName',
  sprintId: 'sprintName',
};

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
  /** TOP-2: denormalized status name — sort-only, synced by status mutations */
  statusName: string | null;
  /** TOP-2: denormalized sprint name — sort-only, synced by sprint mutations */
  sprintName: string | null;
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

/** Fields of a task document that may be set by an update. */
export type TaskUpdatePayload = Partial<
  Pick<
    TaskDocument,
    | 'title'
    | 'description'
    | 'statusId'
    | 'statusName'
    | 'sprintName'
    | 'priority'
    | 'reporterId'
    | 'reporterSnapshot'
    | 'assigneeId'
    | 'assigneeSnapshot'
    | 'typeId'
    | 'sprintId'
    | 'labelIds'
  >
>;

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
  /** Q13/F-01: inclusive ISO date (`YYYY-MM-DD`) range filters */
  createdFrom?: string;
  createdTo?: string;
  updatedFrom?: string;
  updatedTo?: string;
  /**
   * F5 (perf audit #2): omit `description` from the returned documents.
   * List consumers that never render the description (task table, widgets)
   * use this to cut ~40% of the response payload. Server-side description
   * search/filtering is unaffected.
   */
  excludeDescription?: boolean;
  /**
   * Board view: lightweight card projection — the returned documents carry
   * only the fields the board UI reads (id/number/title/typeId/statusId/
   * priority/assignee + snapshot, version for optimistic DnD). Exclusion
   * projection: applied after matching, so filters are unaffected.
   */
  view?: 'board';
}

/**
 * Fields excluded from board-view responses — nothing a board card renders or
 * a board interaction needs (see BoardTask in @task-board/shared). Kept as an
 * exclusion list so newly added Task fields stay visible by default.
 */
const BOARD_VIEW_EXCLUDED_FIELDS = [
  'description',
  'reporterId',
  'reporterSnapshot',
  'statusName',
  'sprintName',
  'sprintId',
  'labelIds',
  'createdById',
  'createdBySnapshot',
  'createdAt',
  'updatedAt',
] as const;

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
    statusName: doc.statusName ?? null,
    sprintName: doc.sprintName ?? null,
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
    // Board-view projections omit the timestamps (never read by a card) —
    // they are spread conditionally so projected documents map without
    // crashing; board consumers receive the dedicated BoardTask DTO instead
    // of this Task mapping, so the absent keys are unreachable there.
    ...(doc.createdAt ? { createdAt: doc.createdAt.toISOString() } : {}),
    ...(doc.updatedAt ? { updatedAt: doc.updatedAt.toISOString() } : {}),
  } as Task;
}

// ─── Task Repository ─────────────────────────────────────────────────────────

export class TaskRepository extends BaseRepository<TaskDocument, Task> {
  protected toDomain(doc: TaskDocument): Task {
    return toDomain(doc);
  }

  /**
   * Tasks assigned to a user across all projects, newest update first.
   *
   * Audit #3: the only consumer is the tenant-home "My Tasks" widget, which
   * renders `id`, `number`, `title`, `priority` and resolves the project via
   * `projectId`. An inclusion projection keeps the payload minimal (description
   * and snapshots are the bulk of a full task document); the server-side sort
   * by `updatedAt` is unchanged. Requires the `{ assigneeId: 1, updatedAt: -1 }`
   * index (see migrations) — without it this query is a COLLSCAN.
   */
  async findAssignedTo(userId: string, limit = 50): Promise<Task[]> {
    const docs = await this.collection
      // createdAt/updatedAt are required by toDomain (toISOString) — and
      // updatedAt is the sort key anyway.
      .find(
        { assigneeId: userId },
        {
          projection: {
            id: 1,
            projectId: 1,
            number: 1,
            title: 1,
            priority: 1,
            createdAt: 1,
            updatedAt: 1,
          },
        },
      )
      .sort({ updatedAt: -1 })
      .limit(limit)
      .toArray();

    return docs.map(toDomain);
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
      createdFrom,
      createdTo,
      updatedFrom,
      updatedTo,
      excludeDescription,
      view,
    } = options;
    const query: Record<string, unknown> = { projectId };

    if (statusId) query.statusId = statusId;
    if (priority) query.priority = priority;
    if (typeId) query.typeId = typeId;
    if (assigneeId) query.assigneeId = assigneeId;
    if (reporterId) query.reporterId = reporterId;
    if (sprintId) query.sprintId = sprintId;
    if (labelId) query.labelIds = labelId;

    // Q13/F-01: inclusive date-range filters (ISO dates → Date boundaries).
    // `{ projectId, createdAt: -1 }` / `{ projectId, updatedAt: -1 }` indexes cover these.
    if (createdFrom || createdTo) {
      query.createdAt = {
        ...(createdFrom ? { $gte: new Date(`${createdFrom}T00:00:00.000Z`) } : {}),
        ...(createdTo ? { $lte: new Date(`${createdTo}T23:59:59.999Z`) } : {}),
      };
    }

    if (updatedFrom || updatedTo) {
      query.updatedAt = {
        ...(updatedFrom ? { $gte: new Date(`${updatedFrom}T00:00:00.000Z`) } : {}),
        ...(updatedTo ? { $lte: new Date(`${updatedTo}T23:59:59.999Z`) } : {}),
      };
    }
    if (search) {
      // Escape user input — raw input is compiled as a regex (ReDoS / 500 on invalid patterns)
      const regex = { $regex: escapeRegExp(search), $options: 'i' };

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

    // Semantic sorts resolve relation names / priority rank instead of raw ids.
    if (sort && SEMANTIC_SORT_FIELDS.has(sort.field)) {
      const pipeline = this.buildSemanticSortPipeline(query, sort.field, sortDir, skip, limit);

      if (view === 'board') {
        pipeline.push({ $unset: [...BOARD_VIEW_EXCLUDED_FIELDS] } as unknown as Document);
      } else if (excludeDescription) {
        pipeline.push({ $unset: 'description' });
      }

      const [docs, total] = await Promise.all([
        this.collection.aggregate<TaskDocument>(pipeline).toArray(),
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

    let findOptions: { projection: Record<string, 0> } | undefined;

    if (view === 'board') {
      findOptions = { projection: Object.fromEntries(BOARD_VIEW_EXCLUDED_FIELDS.map((field) => [field, 0])) };
    } else if (excludeDescription) {
      findOptions = { projection: { description: 0 } };
    }

    // TOP-2: statusId/sprintId sorts map to their denormalized name fields —
    // plain indexed sorts, no aggregation pipeline.
    const docSortKey = SEMANTIC_TO_DOC_KEY[sortField] ?? sortField;
    // Plain-field sort indexes use an ALIGNED tiebreaker (`number: sortDir`):
    // `number` is unique within a project, so the tiebreaker direction does not
    // change which documents come first — only the order WITHIN groups of equal
    // field values — and one `{projectId, field, number: 1}` index then serves
    // BOTH sort directions via reverse traversal (4 indexes instead of 8).
    // All other sorts keep the legacy `number: -1` tiebreaker, which their
    // existing `… number: -1` indexes are built to match; flipping those would
    // break index-supported sorting for createdAt/updatedAt/title/statusName.
    const sortSpec: Record<string, 1 | -1> = ALIGNED_TIEBREAKER_FIELDS.has(sortField)
      ? { [docSortKey]: sortDir, number: sortDir }
      : { [docSortKey]: sortDir, number: -1 };
    const [docs, total] = await Promise.all([
      this.collection.find(query, findOptions).sort(sortSpec).skip(skip).limit(limit).toArray(),
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

  /**
   * Aggregation pipeline for sorts that cannot be expressed as a plain field sort:
   * - `statusId` / `sprintId` → sort by the related status/sprint **name**
   * - `labelIds` → sort by the alphabetically-first label name (tasks without labels last)
   * - `priority` → sort by severity rank (LOW < MEDIUM < HIGH < CRITICAL)
   */
  private buildSemanticSortPipeline(
    query: Record<string, unknown>,
    field: string,
    dir: 1 | -1,
    skip: number,
    limit: number,
  ): Document[] {
    const NO_VALUE = '\uffff'; // sorts after any real name
    let addSortKey: Document;

    if (field === 'priority') {
      const rank: Record<string, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };

      addSortKey = {
        $addFields: {
          __sort: {
            $switch: {
              branches: Object.entries(rank).map(([priority, value]) => ({
                case: { $eq: ['$priority', priority] },
                then: value,
              })),
              default: Object.keys(rank).length,
            },
          },
        },
      };
    } else if (field === 'labelIds') {
      addSortKey = {
        $addFields: {
          __sort: {
            $cond: [{ $gt: [{ $size: '$__refs' }, 0] }, { $min: '$__refs.name' }, NO_VALUE],
          },
        },
      };
    } else if (field === 'assigneeId' || field === 'reporterId') {
      // Denormalized display-name snapshot is embedded in the task document — no lookup needed.
      const snapshotField = field === 'assigneeId' ? 'assigneeSnapshot.displayName' : 'reporterSnapshot.displayName';

      addSortKey = {
        $addFields: { __sort: { $ifNull: [`$${snapshotField}`, NO_VALUE] } },
      };
    } else {
      // statusId | sprintId — single reference, sort by its name
      addSortKey = {
        $addFields: { __sort: { $ifNull: [{ $first: '$__refs.name' }, NO_VALUE] } },
      };
    }

    let lookup: Document[] = [];

    if (field === 'labelIds') {
      lookup = [{ $lookup: { from: 'labels', localField: 'labelIds', foreignField: 'id', as: '__refs' } }];
    } else if (field === 'statusId' || field === 'sprintId') {
      lookup = [
        {
          $lookup: {
            from: field === 'statusId' ? 'statuses' : 'sprints',
            localField: field,
            foreignField: 'id',
            as: '__refs',
          },
        },
      ];
    }

    return [
      { $match: query },
      ...lookup,
      addSortKey,
      { $sort: { __sort: dir, number: -1 } },
      { $skip: skip },
      { $limit: limit },
    ];
  }

  async create(input: {
    projectId: string;
    number: number;
    typeId: string;
    title: string;
    description?: string;
    statusId: string;
    statusName?: string | null;
    sprintName?: string | null;
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
      statusName: input.statusName ?? null,
      sprintName: input.sprintName ?? null,
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
  async updateWithVersion(id: string, currentVersion: number, update: TaskUpdatePayload): Promise<Task | null> {
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

  /**
   * Count tasks with a given status in a project.
   */
  async countByStatus(projectId: string, statusId: string): Promise<number> {
    return this.collection.countDocuments({ projectId, statusId });
  }

  /**
   * S-05: per-status task counts in ONE `$match` + `$group` aggregation
   * (used by the project-overview status summary — replaces one
   * `countDocuments` per status).
   */
  async countByStatusGrouped(projectId: string): Promise<{ statusId: string; count: number }[]> {
    const rows = await this.collection
      .aggregate<{ _id: string; count: number }>([
        { $match: { projectId } },
        { $group: { _id: '$statusId', count: { $sum: 1 } } },
      ])
      .toArray();

    return rows.map((row) => ({ statusId: row._id, count: row.count }));
  }

  /**
   * Bulk update all tasks with a given status to a new status
   * (status delete/replacement — carries the replacement's denormalized name).
   */
  async updateManyByStatus(
    projectId: string,
    oldStatusId: string,
    newStatusId: string,
    newStatusName?: string | null,
  ): Promise<void> {
    await this.collection.updateMany(
      { projectId, statusId: oldStatusId },
      { $set: { statusId: newStatusId, statusName: newStatusName ?? null, updatedAt: new Date() } },
    );
  }

  /**
   * TOP-3 №1: bulk optimistic-concurrency update in ONE `bulkWrite`.
   *
   * Every task gets an individual filter `{ id, version }` — an operation
   * applies only when the task's version still matches, and `$inc` bumps it,
   * exactly like the per-task `updateWithVersion`. `ordered: false` keeps the
   * per-task independence of the former sequential loop (a conflict on one
   * task never blocks the others).
   *
   * Returns the tasks that were ACTUALLY updated (version = entry.version+1);
   * entries missing from the result are version conflicts. One round-trip for
   * the writes + one for the result mapping — independent of batch size.
   */
  async bulkUpdateWithVersion(entries: { id: string; version: number }[], update: TaskUpdatePayload): Promise<Task[]> {
    if (entries.length === 0) return [];

    const now = new Date();
    const ops = entries.map((entry) => ({
      updateOne: {
        filter: { id: entry.id, version: entry.version },
        update: { $set: { ...update, updatedAt: now }, $inc: { version: 1 } },
      },
    }));

    await this.collection.bulkWrite(ops, { ordered: false });

    const updatedDocs = await this.collection
      .find({ $or: entries.map((entry) => ({ id: entry.id, version: entry.version + 1 })) })
      .toArray();

    return updatedDocs.map(toDomain);
  }

  /** TOP-2: propagate a status rename to all tasks holding the status. */
  async setStatusNameForTasks(projectId: string, statusId: string, statusName: string): Promise<void> {
    await this.collection.updateMany({ projectId, statusId }, { $set: { statusName, updatedAt: new Date() } });
  }

  /** TOP-2: propagate a sprint rename to all tasks holding the sprint. */
  async setSprintNameForTasks(projectId: string, sprintId: string, sprintName: string): Promise<void> {
    await this.collection.updateMany({ projectId, sprintId }, { $set: { sprintName, updatedAt: new Date() } });
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
    await this.collection.updateMany(
      { projectId, sprintId },
      { $set: { sprintId: null, sprintName: null, updatedAt: new Date() } },
    );
  }

  /**
   * Delete all entities belonging to a project. Used for cascade delete.
   */
  /**
   * Lightweight id-only lookup for a project's tasks — used by the project
   * cascade to delete comments (keyed by `taskId`, not `projectId`) BEFORE
   * the tasks themselves are removed.
   */
  async findIdsByProject(projectId: string): Promise<string[]> {
    const docs = await this.collection.find({ projectId }, { projection: { id: 1, _id: 0 } }).toArray();

    return docs.map((doc) => doc.id);
  }

  async deleteByProject(projectId: string): Promise<void> {
    await this.collection.deleteMany({ projectId });
  }
}
