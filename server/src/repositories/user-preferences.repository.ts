import type { Collection } from 'mongodb';
import { Theme } from '@task-board/shared';
import type { UserPreferences, UpdateUserPreferences } from '@task-board/shared';

// Required MongoDB indexes:
// - { userId: 1 } (unique)

// ─── MongoDB Document Shape ───────────────────────────────────────────────────

export interface UserPreferencesDocument {
  _id?: import('mongodb').ObjectId;
  userId: string;
  zoom: number;
  theme: Theme;
  language: string;
  updatedAt: Date;
}

// ─── Mapper ──────────────────────────────────────────────────────────────────

function toDomain(doc: UserPreferencesDocument): UserPreferences {
  return {
    userId: doc.userId,
    zoom: doc.zoom,
    theme: doc.theme,
    language: doc.language,
    updatedAt: doc.updatedAt.toISOString(),
  };
}

// ─── User Preferences Repository ─────────────────────────────────────────────

export class UserPreferencesRepository {
  constructor(private readonly collection: Collection<UserPreferencesDocument>) {}

  async findByUserId(userId: string): Promise<UserPreferences | null> {
    const doc = await this.collection.findOne({ userId });

    return doc ? toDomain(doc) : null;
  }

  async upsert(userId: string, data: UpdateUserPreferences): Promise<UserPreferences> {
    const now = new Date();
    const $set: Record<string, unknown> = { updatedAt: now };

    if (data.zoom !== undefined) $set.zoom = data.zoom;
    if (data.theme !== undefined) $set.theme = data.theme;
    if (data.language !== undefined) $set.language = data.language;

    const $setOnInsert: Record<string, unknown> = { userId };

    if (data.zoom === undefined) $setOnInsert.zoom = 100;
    if (data.theme === undefined) $setOnInsert.theme = Theme.Light;
    if (data.language === undefined) $setOnInsert.language = 'en';

    const result = await this.collection.findOneAndUpdate(
      { userId },
      { $set, $setOnInsert },
      { upsert: true, returnDocument: 'after' },
    );

    if (!result) {
      throw new Error('Upsert returned null — this should never happen');
    }

    return toDomain(result);
  }
}
