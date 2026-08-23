import { randomUUID } from 'node:crypto';
import type { Collection } from 'mongodb';
import type { UserProjectBoardPreference, UpdateUserProjectBoardPreference } from '@task-board/shared';

// Required MongoDB indexes:
// - { userId: 1, projectId: 1 } (unique)

// ─── MongoDB Document Shape ───────────────────────────────────────────────────

export interface UserPreferencesDocument {
  _id?: import('mongodb').ObjectId;
  id: string;
  userId: string;
  projectId: string;
  defaultBoardId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Mapper ──────────────────────────────────────────────────────────────────

function toDomain(doc: UserPreferencesDocument): UserProjectBoardPreference {
  return {
    id: doc.id,
    userId: doc.userId,
    projectId: doc.projectId,
    defaultBoardId: doc.defaultBoardId,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
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
    const $set: Record<string, unknown> = { updatedAt: now, defaultBoardId: data.defaultBoardId };
    const $setOnInsert: Record<string, unknown> = { id: randomUUID(), userId, projectId };
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
