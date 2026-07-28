/**
 * Tests for the pagination query validator.
 *
 * The paginationQuery() validator coerces string query parameters
 * into numbers and applies sensible defaults for list endpoints.
 */
import { describe, it, expect } from 'vitest';
import { paginationQuery } from './pagination.js';

describe('paginationQuery validator', () => {
  const paginationSchema = paginationQuery();

  it('should accept valid numeric page and limit', () => {
    const result = paginationSchema.safeParse({ page: 1, limit: 20 });

    expect(result.success).toBe(true);
  });

  it('should coerce string page and limit to numbers', () => {
    const result = paginationSchema.safeParse({ page: '3', limit: '50' });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(3);
      expect(result.data.limit).toBe(50);
    }
  });

  it('should apply defaults when page and limit are missing', () => {
    const result = paginationSchema.safeParse({});

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(20);
    }
  });

  it('should reject page 0 (not positive)', () => {
    const result = paginationSchema.safeParse({ page: 0, limit: 20 });

    expect(result.success).toBe(false);
  });

  it('should reject negative page', () => {
    const result = paginationSchema.safeParse({ page: -1, limit: 20 });

    expect(result.success).toBe(false);
  });

  it('should reject limit of 0', () => {
    const result = paginationSchema.safeParse({ page: 1, limit: 0 });

    expect(result.success).toBe(false);
  });

  it('should reject limit exceeding 100', () => {
    const result = paginationSchema.safeParse({ page: 1, limit: 101 });

    expect(result.success).toBe(false);
  });

  it('should accept boundary limit of 1', () => {
    const result = paginationSchema.safeParse({ page: 1, limit: 1 });

    expect(result.success).toBe(true);
  });

  it('should accept boundary limit of 100', () => {
    const result = paginationSchema.safeParse({ page: 1, limit: 100 });

    expect(result.success).toBe(true);
  });
});
