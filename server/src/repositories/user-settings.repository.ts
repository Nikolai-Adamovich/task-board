import type { Collection, ObjectId } from 'mongodb';

// ─── MongoDB Document Shape ──────────────────────────────────────────────────

export interface UserSettingsDocument {
  _id?: ObjectId;
  userId: string;
  zoom: number;
  theme: string;
  language: string;
  pageSize: number;
  updatedAt: Date;
}

// ─── Domain Shape ────────────────────────────────────────────────────────────

export interface UserSettings {
  userId: string;
  zoom: number;
  theme: string;
  language: string;
  pageSize: number;
  updatedAt: string;
}

export interface UpdateUserSettings {
  zoom?: number;
  theme?: string;
  language?: string;
  pageSize?: number;
}

const DEFAULTS = {
  zoom: 100,
  theme: 'light',
  language: 'en',
  pageSize: 20,
};

function toDomain(doc: UserSettingsDocument): UserSettings {
  return {
    userId: doc.userId,
    zoom: doc.zoom,
    theme: doc.theme,
    language: doc.language,
    pageSize: doc.pageSize ?? DEFAULTS.pageSize,
    updatedAt: doc.updatedAt.toISOString(),
  };
}

function defaultsFor(userId: string): UserSettings {
  return { userId, ...DEFAULTS, updatedAt: new Date().toISOString() };
}

// ─── User Settings Repository ────────────────────────────────────────────────

export class UserSettingsRepository {
  constructor(private readonly collection: Collection<UserSettingsDocument>) {}

  /** Global settings for a user; returns defaults when no document exists yet. */
  async findByUserId(userId: string): Promise<UserSettings> {
    const doc = await this.collection.findOne({ userId });

    return doc ? toDomain(doc) : defaultsFor(userId);
  }

  /**
   * Partially update global settings (upsert).
   * `$setOnInsert` must not contain keys that also appear in `$set` —
   * MongoDB rejects that with "Updating the path … would create a conflict".
   */
  async upsert(userId: string, patch: UpdateUserSettings): Promise<UserSettings> {
    const now = new Date();
    const $set: Record<string, unknown> = { updatedAt: now };
    const $setOnInsert: Record<string, unknown> = { userId };

    for (const key of ['zoom', 'theme', 'language', 'pageSize'] as const) {
      if (patch[key] !== undefined) {
        $set[key] = patch[key];
      } else {
        $setOnInsert[key] = DEFAULTS[key];
      }
    }

    await this.collection.updateOne({ userId }, { $set, $setOnInsert }, { upsert: true });

    return this.findByUserId(userId);
  }
}
