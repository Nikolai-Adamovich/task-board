/**
 * Date/time display format preferences (R3-P8).
 *
 * Single source of truth for the user's preferred date and time rendering,
 * shared by the server (Zod validation of the persisted global preference)
 * and the UI (settings selects, date formatting helpers).
 *
 * Values are stored as-is on the global user-preferences document; null means
 * "not set" and callers fall back to their default rendering.
 */
export const DATE_FORMAT_PREFERENCES = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'] as const;

export type DateFormatPreference = (typeof DATE_FORMAT_PREFERENCES)[number];

export const TIME_FORMAT_PREFERENCES = ['24h', '12h'] as const;

export type TimeFormatPreference = (typeof TIME_FORMAT_PREFERENCES)[number];
