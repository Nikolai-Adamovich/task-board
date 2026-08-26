/**
 * Unit tests for the date/time format helpers (R3-P8).
 *
 * Covers both formats of each preference plus the null fallbacks and the
 * combined date+time token used by tables / detail meta rendering.
 */
import { toDatePipeDateFormat, toDatePipeDateTimeFormat, toDatePipeTimeFormat } from './date-format';

describe('date-format helpers', () => {
  describe('toDatePipeDateFormat', () => {
    it('maps DD/MM/YYYY to dd/MM/yyyy', () => {
      expect(toDatePipeDateFormat('DD/MM/YYYY')).toBe('dd/MM/yyyy');
    });

    it('maps MM/DD/YYYY to MM/dd/yyyy', () => {
      expect(toDatePipeDateFormat('MM/DD/YYYY')).toBe('MM/dd/yyyy');
    });

    it('maps YYYY-MM-DD to yyyy-MM-dd', () => {
      expect(toDatePipeDateFormat('YYYY-MM-DD')).toBe('yyyy-MM-dd');
    });

    it('falls back to ISO when the preference is null (not set)', () => {
      expect(toDatePipeDateFormat(null)).toBe('yyyy-MM-dd');
    });
  });

  describe('toDatePipeTimeFormat', () => {
    it('maps 24h to HH:mm', () => {
      expect(toDatePipeTimeFormat('24h')).toBe('HH:mm');
    });

    it('maps 12h to h:mm a', () => {
      expect(toDatePipeTimeFormat('12h')).toBe('h:mm a');
    });

    it('falls back to 24h when the preference is null (not set)', () => {
      expect(toDatePipeTimeFormat(null)).toBe('HH:mm');
    });
  });

  describe('toDatePipeDateTimeFormat', () => {
    it('combines both preferences into one DatePipe token', () => {
      expect(toDatePipeDateTimeFormat('DD/MM/YYYY', '24h')).toBe('dd/MM/yyyy HH:mm');
    });

    it('supports the 12h variant', () => {
      expect(toDatePipeDateTimeFormat('MM/DD/YYYY', '12h')).toBe('MM/dd/yyyy h:mm a');
    });

    it('uses defaults for unset preferences', () => {
      expect(toDatePipeDateTimeFormat(null, null)).toBe('yyyy-MM-dd HH:mm');
    });
  });
});
