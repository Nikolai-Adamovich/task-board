import type { DateFormatPreference, TimeFormatPreference } from '@task-board/shared';

/**
 * Date/time display format helpers (R3-P8).
 *
 * Translate the persisted user preferences into Angular DatePipe format
 * strings, which templates consume via `{{ value | date: fmt() }}`.
 * Timezone handling is unchanged — values are rendered in local time.
 */

/** Fallback when the user has not set a date format preference (null). */
export const DEFAULT_DATE_FORMAT: DateFormatPreference = 'YYYY-MM-DD';
/** Fallback when the user has not set a time format preference (null). */
export const DEFAULT_TIME_FORMAT: TimeFormatPreference = '24h';

/** Preference → DatePipe date tokens (e.g. 'DD/MM/YYYY' → 'dd/MM/yyyy'). */
export function toDatePipeDateFormat(pref: DateFormatPreference | null): string {
  switch (pref) {
    case 'DD/MM/YYYY':
      return 'dd/MM/yyyy';

    case 'MM/DD/YYYY':
      return 'MM/dd/yyyy';

    case 'YYYY-MM-DD':
      return 'yyyy-MM-dd';

    default:
      return toDatePipeDateFormat(DEFAULT_DATE_FORMAT);
  }
}

/** Preference → DatePipe time tokens ('24h' → 'HH:mm', '12h' → 'h:mm a'). */
export function toDatePipeTimeFormat(pref: TimeFormatPreference | null): string {
  return pref === '12h' ? 'h:mm a' : 'HH:mm';
}

/** Combined preference pair → single DatePipe format string for timestamps. */
export function toDatePipeDateTimeFormat(
  datePref: DateFormatPreference | null,
  timePref: TimeFormatPreference | null,
): string {
  return `${toDatePipeDateFormat(datePref)} ${toDatePipeTimeFormat(timePref)}`;
}
