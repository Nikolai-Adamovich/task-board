import type { Collection, ObjectId } from 'mongodb';
import type { DateFormatPreference, ThemeMode, TimeFormatPreference } from '@task-board/shared';

// ─── MongoDB Document Shape ──────────────────────────────────────────────────

export interface UserSettingsDocument {
  _id?: ObjectId;
  userId: string;
  zoom: number;
  /** Legacy single-theme field kept for backward compatibility with older clients. */
  theme: string;
  /** Theme mode (default 'auto'): 'auto' follows the browser's prefers-color-scheme. */
  themeMode?: ThemeMode;
  /** Theme applied when mode is 'light' (or in 'auto' with a light system scheme). */
  lightTheme?: string | null;
  /** Theme applied when mode is 'dark' (or in 'auto' with a dark system scheme). */
  darkTheme?: string | null;
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
  /** Legacy single-theme field kept for backward compatibility with older clients. */
  theme: string;
  /** Theme mode (default 'auto'): 'auto' follows the browser's prefers-color-scheme. */
  themeMode: ThemeMode;
  /** Theme applied when mode is 'light' (or in 'auto' with a light system scheme). */
  lightTheme: string | null;
  /** Theme applied when mode is 'dark' (or in 'auto' with a dark system scheme). */
  darkTheme: string | null;
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
  themeMode?: ThemeMode;
  lightTheme?: string | null;
  darkTheme?: string | null;
  language?: string;
  pageSize?: number;
  dateFormat?: DateFormatPreference | null;
  timeFormat?: TimeFormatPreference | null;
}

const DEFAULTS = {
  zoom: 100,
  theme: 'light',
  themeMode: 'auto' as ThemeMode,
  lightTheme: null,
  darkTheme: null,
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
    themeMode: doc.themeMode ?? DEFAULTS.themeMode,
    lightTheme: doc.lightTheme ?? DEFAULTS.lightTheme,
    darkTheme: doc.darkTheme ?? DEFAULTS.darkTheme,
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

    for (const key of [
      'zoom',
      'theme',
      'themeMode',
      'lightTheme',
      'darkTheme',
      'language',
      'pageSize',
      'dateFormat',
      'timeFormat',
    ] as const) {
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
