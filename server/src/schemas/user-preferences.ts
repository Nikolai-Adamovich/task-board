import { z } from 'zod';
import { DEFAULT_THEME_ID } from '@task-board/shared';

/**
 * User preferences schema.
 * Stores per-user UI settings such as zoom level, theme, and language.
 */
export const UserPreferencesSchema = z.object({
  userId: z.uuid(),
  zoom: z.number().int().min(25).max(500).default(100),
  theme: z.string().min(1).default(DEFAULT_THEME_ID),
  language: z.string().min(2).max(10).default('en'),
  updatedAt: z.iso.datetime(),
});

/**
 * Schema for updating user preferences.
 * All fields are optional (partial update).
 */
export const UpdateUserPreferencesSchema = z.object({
  zoom: z.number().int().min(25).max(500).optional(),
  theme: z.string().min(1).optional(),
  language: z.string().min(2).max(10).optional(),
});
