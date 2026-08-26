import { describe, it, expect } from 'vitest';
import { UpdateUserGlobalSettingsSchema } from './user-preferences.js';

describe('UpdateUserGlobalSettingsSchema', () => {
  it('accepts a dateFormat update', () => {
    const result = UpdateUserGlobalSettingsSchema.parse({ dateFormat: 'DD/MM/YYYY' });

    expect(result).toEqual({ dateFormat: 'DD/MM/YYYY' });
  });

  it('accepts a timeFormat update', () => {
    const result = UpdateUserGlobalSettingsSchema.parse({ timeFormat: '12h' });

    expect(result).toEqual({ timeFormat: '12h' });
  });

  it('accepts explicit null to reset date/time format', () => {
    const result = UpdateUserGlobalSettingsSchema.parse({ dateFormat: null, timeFormat: null });

    expect(result).toEqual({ dateFormat: null, timeFormat: null });
  });

  it('accepts the Auto page-size sentinel 0 (V7-2)', () => {
    const result = UpdateUserGlobalSettingsSchema.parse({ pageSize: 0 });

    expect(result.pageSize).toBe(0);
  });

  it('rejects a non-zero pageSize below the minimum of 5 (V7-2)', () => {
    expect(() => UpdateUserGlobalSettingsSchema.parse({ pageSize: 3 })).toThrow();
  });

  it('rejects a pageSize above the maximum of 100', () => {
    expect(() => UpdateUserGlobalSettingsSchema.parse({ pageSize: 101 })).toThrow();
  });

  it('accepts combined updates', () => {
    const result = UpdateUserGlobalSettingsSchema.parse({
      pageSize: 50,
      dateFormat: 'YYYY-MM-DD',
      timeFormat: '24h',
    });

    expect(result.dateFormat).toBe('YYYY-MM-DD');
    expect(result.timeFormat).toBe('24h');
  });

  it('rejects an unknown dateFormat value', () => {
    expect(() => UpdateUserGlobalSettingsSchema.parse({ dateFormat: 'dd.mm.yyyy' })).toThrow();
  });

  it('rejects an unknown timeFormat value', () => {
    expect(() => UpdateUserGlobalSettingsSchema.parse({ timeFormat: 'am/pm' })).toThrow();
  });

  it('rejects an empty patch', () => {
    expect(() => UpdateUserGlobalSettingsSchema.parse({})).toThrow('At least one preference field must be provided');
  });
});
