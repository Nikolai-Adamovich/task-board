/**
 * Single source of truth for task priority levels.
 *
 * `priorityLevel` is the POSITION of the priority in the current (global,
 * immutable-by-app) configuration — not an immutable identity. Adding a new
 * level here automatically extends the `TaskPriorityLevel` type, the Zod
 * validation (derived schema in the server) and every UI selector that renders
 * its options from this config.
 *
 * Historical note: before 2026-09 tasks stored a string enum
 * (`LOW`/`MEDIUM`/`HIGH`/`CRITICAL`) — alphabetical order did not match
 * severity; see product-analysis/100 §4.21/§4.22.
 */
export const TASK_PRIORITY_CONFIG = [
  { level: 0, i18nKey: 'priority.low' },
  { level: 1, i18nKey: 'priority.medium' },
  { level: 2, i18nKey: 'priority.high' },
  { level: 3, i18nKey: 'priority.critical' },
] as const;

/** Level union derived from the config — never hardcoded as `0 | 1 | 2 | 3`. */
export type TaskPriorityLevel = (typeof TASK_PRIORITY_CONFIG)[number]['level'];

/** Runtime list of valid levels (derived) — for membership checks and maps. */
export const TASK_PRIORITY_LEVELS: readonly TaskPriorityLevel[] = TASK_PRIORITY_CONFIG.map((c) => c.level);

/** Default level for newly created tasks (medium — the second config entry). */
export const DEFAULT_TASK_PRIORITY_LEVEL: TaskPriorityLevel = TASK_PRIORITY_CONFIG[1].level;
