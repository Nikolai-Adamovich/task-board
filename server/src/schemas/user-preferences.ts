import { z } from 'zod';
import { isValidDateFormat, TIME_FORMAT_PREFERENCES, TASK_TABLE_COLUMN_KEYS } from '@task-board/shared';
import { uuid } from '../validators/common.js';

/**
 * Schema for updating user project preferences (partial update).
 * Both fields are optional so a PATCH only touches what it sends.
 */
export const UpdateUserProjectBoardPreferenceSchema = z
  .object({
    defaultBoardId: uuid().nullable().optional(),
    /** R3-P4: visible task-table columns; validated against the allowed column names. */
    taskTableColumns: z.array(z.enum(TASK_TABLE_COLUMN_KEYS)).nullable().optional(),
  })
  .refine((data) => data.defaultBoardId !== undefined || data.taskTableColumns !== undefined, {
    message: 'At least one preference field must be provided',
  });

/**
 * Schema for updating global (user-level) preferences — partial update (R3-P8).
 * Every field is optional so a PUT only touches what it sends; dateFormat/timeFormat
 * are validated against the allowed display formats.
 */
export const UpdateUserGlobalSettingsSchema = z
  .object({
    zoom: z.number().min(50).max(200).optional(),
    /** Legacy single-theme field kept for backward compatibility with older clients. */
    theme: z.string().min(1).optional(),
    /** Theme mode: 'auto' follows the browser's prefers-color-scheme. */
    themeMode: z.enum(['auto', 'light', 'dark']).optional(),
    /** Theme applied when mode is 'light' (or in 'auto' with a light system scheme). */
    lightTheme: z.string().min(1).nullable().optional(),
    /** Theme applied when mode is 'dark' (or in 'auto' with a dark system scheme). */
    darkTheme: z.string().min(1).nullable().optional(),
    language: z.string().min(2).max(10).optional(),
    /** V7-2: 0 is the "Auto" sentinel sent by the tasks table; non-zero values must be a real page size. */
    pageSize: z
      .number()
      .int()
      .min(0)
      .max(100)
      .refine((value) => value === 0 || value >= 5, {
        message: 'pageSize must be 0 (auto) or between 5 and 100',
      })
      .optional(),
    /** P12 (DEC-056): free-form format string validated against the shared token whitelist. */
    dateFormat: z
      .string()
      .refine(isValidDateFormat, {
        message: 'dateFormat must be a whitelisted token string (YYYY YY MM M DD D MMM MMMM + space / - . ,)',
      })
      .nullable()
      .optional(),
    timeFormat: z.enum(TIME_FORMAT_PREFERENCES).nullable().optional(),
  })
  .refine(
    (data) =>
      data.zoom !== undefined ||
      data.theme !== undefined ||
      data.themeMode !== undefined ||
      data.lightTheme !== undefined ||
      data.darkTheme !== undefined ||
      data.language !== undefined ||
      data.pageSize !== undefined ||
      data.dateFormat !== undefined ||
      data.timeFormat !== undefined,
    { message: 'At least one preference field must be provided' },
  );

export type UpdateUserGlobalSettingsInput = z.infer<typeof UpdateUserGlobalSettingsSchema>;
