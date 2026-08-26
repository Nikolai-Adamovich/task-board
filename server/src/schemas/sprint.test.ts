import { describe, it, expect } from 'vitest';
import { CreateSprintSchema, UpdateSprintSchema } from './sprint.js';

describe('CreateSprintSchema', () => {
  it('accepts date-only values unchanged (V7-7)', () => {
    const result = CreateSprintSchema.parse({ name: 'Sprint 1', startDate: '2026-08-01', endDate: '2026-08-15' });

    expect(result).toEqual({ name: 'Sprint 1', startDate: '2026-08-01', endDate: '2026-08-15' });
  });

  it('normalizes full ISO datetimes to date-only (V7-7)', () => {
    const result = CreateSprintSchema.parse({
      name: 'Sprint 1',
      startDate: '2026-08-26T00:00:00.000Z',
      endDate: '2026-09-09T23:59:59.999Z',
    });

    expect(result.startDate).toBe('2026-08-26');
    expect(result.endDate).toBe('2026-09-09');
  });

  it('accepts a name-only payload (dates optional)', () => {
    const result = CreateSprintSchema.parse({ name: 'Backlog sprint' });

    expect(result).toEqual({ name: 'Backlog sprint' });
  });

  it('rejects an invalid date string', () => {
    expect(() => CreateSprintSchema.parse({ name: 'Sprint 1', startDate: 'not-a-date' })).toThrow();
  });

  it('rejects endDate before startDate across mixed formats', () => {
    expect(() =>
      CreateSprintSchema.parse({ name: 'Sprint 1', startDate: '2026-09-10T00:00:00.000Z', endDate: '2026-09-09' }),
    ).toThrow('endDate must be >= startDate');
  });

  it('accepts equal start/end dates after normalization', () => {
    const result = CreateSprintSchema.parse({
      name: 'Sprint 1',
      startDate: '2026-08-26T10:30:00.000Z',
      endDate: '2026-08-26',
    });

    expect(result.startDate).toBe('2026-08-26');
    expect(result.endDate).toBe('2026-08-26');
  });
});

describe('UpdateSprintSchema', () => {
  it('normalizes full ISO datetimes to date-only (V7-7)', () => {
    const result = UpdateSprintSchema.parse({ startDate: '2026-08-26T00:00:00.000Z' });

    expect(result.startDate).toBe('2026-08-26');
  });

  it('accepts explicit null to clear dates', () => {
    const result = UpdateSprintSchema.parse({ startDate: null, endDate: null });

    expect(result).toEqual({ startDate: null, endDate: null });
  });

  it('rejects endDate before startDate after normalization', () => {
    expect(() => UpdateSprintSchema.parse({ startDate: '2026-08-26', endDate: '2026-08-25T12:00:00.000Z' })).toThrow(
      'endDate must be >= startDate',
    );
  });
});
