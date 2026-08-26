import type { Collection, ObjectId } from 'mongodb';
import type { DateFormatPreference, TimeFormatPreference } from '@task-board/shared';

// ─── MongoDB Document Shape ──────────────────────────────────────────────────

export interface UserSettingsDocument {
  _id?: ObjectId;
  userId: string;
  zoom: number;
  theme: string;
  language: string;
  pageSize: number;
  /** R3-P8: preferred date display format (null = not set). */
  dateFormat: DateFormatPreference | null;
  /** R3-P8: preferred time display format (null = not set). */
  timeFormat: TimeFormatPreference | null;
  updatedAt: Date;
}

// ─── Domain Shape ────────────────────────────────────────────────────────────

export interface UserSettings {
  userId: string;
  zoom: number;
  theme: string;
  language: string;
  pageSize: number;
  /** R3-P8: preferred date display format (null = not set). */
  dateFormat: DateFormatPreference | null;
  /** R3-P8: preferred time display format (null = not set). */
  timeFormat: TimeFormatPreference | null;
  updatedAt: string;
}

export interface UpdateUserSettings {
  zoom?: number;
  theme?: string;
  language?: string;
  pageSize?: number;
  dateFormat?: DateFormatPreference | null;
  timeFormat?: TimeFormatPreference | null;
}

const DEFAULTS = {
  zoom: 100,
  theme: 'light',
  language: 'en',
  pageSize: 20,
  dateFormat: null,
  timeFormat: null,
};

function toDomain(doc: UserSettingsDocument): UserSettings {
  return {
    userId: doc.userId,
    zoom: doc.zoom,
    theme: doc.theme,
    language: doc.language,
    pageSize: doc.pageSize ?? DEFAULTS.pageSize,
    dateFormat: doc.dateFormat ?? DEFAULTS.dateFormat,
    timeFormat: doc.timeFormat ?? DEFAULTS.timeFormat,
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

    for (const key of ['zoom', 'theme', 'language', 'pageSize', 'dateFormat', 'timeFormat'] as const) {
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
