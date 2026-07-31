import { z } from 'zod';

/**
 * User preferences schema.
 * Stores per-user UI settings such as zoom level, theme, and language.
 */
export const UserPreferencesSchema = z.object({
  userId: z.uuid(),
  zoom: z.number().int().min(25).max(500).default(100),
  theme: z.enum(['light', 'dark']).default('light'),
  language: z.string().min(2).max(10).default('en'),
  updatedAt: z.iso.datetime(),
});

/** Inferred UserPreferences type */
export type UserPreferences = z.infer<typeof UserPreferencesSchema>;

/**
 * Schema for updating user preferences.
 * All fields are optional (partial update).
 */
export const UpdateUserPreferencesSchema = z.object({
  zoom: z.number().int().min(25).max(500).optional(),
  theme: z.enum(['light', 'dark']).optional(),
  language: z.string().min(2).max(10).optional(),
});

/** Inferred UpdateUserPreferences type */
export type UpdateUserPreferences = z.infer<typeof UpdateUserPreferencesSchema>;
