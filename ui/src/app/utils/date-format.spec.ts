/**
 * Unit tests for the date/time format helpers (R3-P8, P12/DEC-056).
 *
 * Covers the legacy presets, free-form whitelisted token strings, the null
 * fallbacks and the combined date+time token used by tables / detail meta
 * rendering.
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

    it('maps user tokens YYYY YY DD D to DatePipe tokens (P12)', () => {
      expect(toDatePipeDateFormat('DD MMM YY')).toBe('dd MMM yy');
      expect(toDatePipeDateFormat('D/M/YYYY')).toBe('d/M/yyyy');
    });

    it('passes month tokens and separators through unchanged (P12)', () => {
      expect(toDatePipeDateFormat('MMMM D, YYYY')).toBe('MMMM d, yyyy');
      expect(toDatePipeDateFormat('D.M.YYYY')).toBe('d.M.yyyy');
    });

    it('falls back to ISO when the preference is null (not set)', () => {
      expect(toDatePipeDateFormat(null)).toBe('yyyy-MM-dd');
    });

    it('falls back to ISO for empty or invalid preferences (P12)', () => {
      expect(toDatePipeDateFormat('')).toBe('yyyy-MM-dd');
      expect(toDatePipeDateFormat('QQ YYYY')).toBe('yyyy-MM-dd');
      expect(toDatePipeDateFormat('YYYY; DROP')).toBe('yyyy-MM-dd');
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

    it('supports a custom date format (P12)', () => {
      expect(toDatePipeDateTimeFormat('DD MMM YY', '24h')).toBe('dd MMM yy HH:mm');
    });

    it('uses defaults for unset preferences', () => {
      expect(toDatePipeDateTimeFormat(null, null)).toBe('yyyy-MM-dd HH:mm');
    });
  });
});
