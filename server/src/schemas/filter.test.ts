import { describe, it, expect } from 'vitest';
import { CreateFilterSchema, UpdateFilterSchema } from './filter.js';

const base = { name: 'My View', filters: {}, sort: { field: 'createdAt', direction: 'desc' } };

describe('filter schemas — date-range criteria (Q12)', () => {
  it('accepts all four ISO date-range fields on create', () => {
    const result = CreateFilterSchema.parse({
      ...base,
      filters: {
        createdFrom: '2026-01-01',
        createdTo: '2026-01-31',
        updatedFrom: '2026-02-01',
        updatedTo: '2026-02-28',
      },
    });

    expect(result.filters).toEqual({
      createdFrom: '2026-01-01',
      createdTo: '2026-01-31',
      updatedFrom: '2026-02-01',
      updatedTo: '2026-02-28',
    });
  });

  it('accepts a partial date range mixed with other criteria', () => {
    const result = CreateFilterSchema.parse({
      ...base,
      filters: { priority: ['HIGH'], createdFrom: '2026-01-01' },
    });

    expect(result.filters.createdFrom).toBe('2026-01-01');
    expect(result.filters.priority).toEqual(['HIGH']);
  });

  it('accepts date fields on update', () => {
    const result = UpdateFilterSchema.parse({ filters: { updatedTo: '2026-03-31' } });

    expect(result.filters?.updatedTo).toBe('2026-03-31');
  });

  it('accepts criteria without any date fields (backwards compatible)', () => {
    const result = CreateFilterSchema.parse(base);

    expect(result.filters).toEqual({});
  });

  it('rejects a non-ISO date value', () => {
    expect(() => CreateFilterSchema.parse({ ...base, filters: { createdFrom: '01/02/2026' } })).toThrow();
    expect(() => UpdateFilterSchema.parse({ filters: { updatedTo: 'not-a-date' } })).toThrow();
  });
});
