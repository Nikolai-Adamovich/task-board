// ─── Time-related constants (single source of truth for server + UI) ─────────

/** Access-token (JWT) time-to-live, in seconds (24 hours). */
export const JWT_TTL_SECONDS = 24 * 60 * 60;

/** Password-reset token time-to-live, in minutes (1 hour). */
export const PASSWORD_RESET_TTL_MINUTES = 60;

/** Invitation time-to-live, in milliseconds (7 days). */
export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Grace period between scheduling a deletion and its permanent execution, in milliseconds (30 days). */
export const DELETION_GRACE_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;
