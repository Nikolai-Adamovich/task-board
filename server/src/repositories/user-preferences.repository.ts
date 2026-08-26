import { randomUUID } from 'node:crypto';
import type { Collection } from 'mongodb';
import type {
  TaskTableColumnKey,
  UpdateUserProjectBoardPreference,
  UserProjectBoardPreference,
} from '@task-board/shared';

// Required MongoDB indexes:
// - { userId: 1, projectId: 1 } (unique)

// ─── MongoDB Document Shape ───────────────────────────────────────────────────

export interface UserPreferencesDocument {
  _id?: import('mongodb').ObjectId;
  id: string;
  userId: string;
  projectId: string;
  defaultBoardId: string | null;
  /** R3-P4: visible task-table columns; null/absent = default set. */
  taskTableColumns?: TaskTableColumnKey[] | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Mapper ──────────────────────────────────────────────────────────────────

function toDomain(doc: UserPreferencesDocument): UserProjectBoardPreference {
  return {
    id: doc.id,
    userId: doc.userId,
    projectId: doc.projectId,
    defaultBoardId: doc.defaultBoardId ?? null,
    taskTableColumns: doc.taskTableColumns ?? null,
    // Tolerate legacy docs persisted before createdAt/updatedAt were set on insert (V7-3).
    createdAt: (doc.createdAt ?? new Date(0)).toISOString(),
    updatedAt: (doc.updatedAt ?? new Date(0)).toISOString(),
  };
}

// ─── User Preferences Repository ─────────────────────────────────────────────

export class UserPreferencesRepository {
  constructor(private readonly collection: Collection<UserPreferencesDocument>) {}

  async findByUserAndProject(userId: string, projectId: string): Promise<UserProjectBoardPreference | null> {
    const doc = await this.collection.findOne({ userId, projectId });

    return doc ? toDomain(doc) : null;
  }

  async upsert(
    userId: string,
    projectId: string,
    data: UpdateUserProjectBoardPreference,
  ): Promise<UserProjectBoardPreference> {
    const now = new Date();
    // Partial update: only $set the fields the request actually carried so a
    // PATCH of one preference never wipes the other (R3-P4).
    const $set: Record<string, unknown> = { updatedAt: now };

    if (data.defaultBoardId !== undefined) {
      $set['defaultBoardId'] = data.defaultBoardId;
    }
    if (data.taskTableColumns !== undefined) {
      $set['taskTableColumns'] = data.taskTableColumns;
    }

    const $setOnInsert: Record<string, unknown> = { id: randomUUID(), userId, projectId, createdAt: now };
    const result = await this.collection.findOneAndUpdate(
      { userId, projectId },
      { $set, $setOnInsert },
      { upsert: true, returnDocument: 'after' },
    );

    if (!result) {
      throw new Error('Upsert returned null');
    }

    return toDomain(result);
  }
}
