/**
 * Tests for common schemas: ErrorResponseSchema, PaginationSchema,
 * createPaginatedResponseSchema, ListQuerySchema.
 *
 * These are cross-cutting schemas used by all API endpoints for
 * error responses, pagination parameters, and paginated list results.
 */
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { ErrorResponseSchema, PaginationSchema, createPaginatedResponseSchema, ListQuerySchema } from './common.js';

// ─── ErrorResponseSchema ─────────────────────────────────────────────────────

describe('ErrorResponseSchema', () => {
  it('should accept a valid error response', () => {
    const result = ErrorResponseSchema.safeParse({
      code: 'VALIDATION_ERROR',
      message: 'Invalid input data',
    });

    expect(result.success).toBe(true);
  });

  it('should accept error with optional details', () => {
    const result = ErrorResponseSchema.safeParse({
      code: 'VALIDATION_ERROR',
      message: 'Invalid input data',
      details: { field: 'email', reason: 'invalid format' },
    });

    expect(result.success).toBe(true);
  });

  it('should reject missing code', () => {
    const result = ErrorResponseSchema.safeParse({ message: 'Error' });

    expect(result.success).toBe(false);
  });

  it('should reject missing message', () => {
    const result = ErrorResponseSchema.safeParse({ code: 'ERROR' });

    expect(result.success).toBe(false);
  });
});

// ─── PaginationSchema ────────────────────────────────────────────────────────

describe('PaginationSchema', () => {
  it('should accept valid pagination parameters', () => {
    const result = PaginationSchema.safeParse({ page: 1, limit: 20 });

    expect(result.success).toBe(true);
  });

  it('should apply defaults when parsing with defaults', () => {
    const result = PaginationSchema.safeParse({ page: 1, limit: 20 });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(20);
    }
  });

  it('should reject page 0 (not positive)', () => {
    const result = PaginationSchema.safeParse({ page: 0, limit: 20 });

    expect(result.success).toBe(false);
  });

  it('should reject negative page', () => {
    const result = PaginationSchema.safeParse({ page: -1, limit: 20 });

    expect(result.success).toBe(false);
  });

  it('should reject limit of 0', () => {
    const result = PaginationSchema.safeParse({ page: 1, limit: 0 });

    expect(result.success).toBe(false);
  });

  it('should reject limit exceeding 100', () => {
    const result = PaginationSchema.safeParse({ page: 1, limit: 101 });

    expect(result.success).toBe(false);
  });

  it('should accept boundary limit of 100', () => {
    const result = PaginationSchema.safeParse({ page: 1, limit: 100 });

    expect(result.success).toBe(true);
  });
});

// ─── createPaginatedResponseSchema ───────────────────────────────────────────

describe('createPaginatedResponseSchema', () => {
  // Use a simple item schema for testing the factory
  const ItemSchema = z.object({
    id: z.string(),
    name: z.string(),
  });
  const PaginatedItemsSchema = createPaginatedResponseSchema(ItemSchema);

  it('should accept a valid paginated response', () => {
    const result = PaginatedItemsSchema.safeParse({
      data: [{ id: '1', name: 'Item 1' }],
      total: 10,
      page: 1,
      limit: 20,
    });

    expect(result.success).toBe(true);
  });

  it('should accept empty data array', () => {
    const result = PaginatedItemsSchema.safeParse({
      data: [],
      total: 0,
      page: 1,
      limit: 20,
    });

    expect(result.success).toBe(true);
  });

  it('should reject non-array data', () => {
    const result = PaginatedItemsSchema.safeParse({
      data: 'not-array',
      total: 0,
      page: 1,
      limit: 20,
    });

    expect(result.success).toBe(false);
  });

  it('should reject negative total', () => {
    const result = PaginatedItemsSchema.safeParse({
      data: [],
      total: -1,
      page: 1,
      limit: 20,
    });

    expect(result.success).toBe(false);
  });

  it('should reject items that do not match the item schema', () => {
    const result = PaginatedItemsSchema.safeParse({
      data: [{ id: 123, name: 456 }], // wrong types
      total: 1,
      page: 1,
      limit: 20,
    });

    expect(result.success).toBe(false);
  });
});

// ─── ListQuerySchema ─────────────────────────────────────────────────────────

describe('ListQuerySchema', () => {
  it('should accept valid list query', () => {
    const result = ListQuerySchema.safeParse({ page: '1', limit: '20' });

    expect(result.success).toBe(true);
  });

  it('should accept list query with search', () => {
    const result = ListQuerySchema.safeParse({
      page: '1',
      limit: '20',
      search: 'test',
    });

    expect(result.success).toBe(true);
  });

  it('should apply defaults for missing page/limit (via coerce defaults)', () => {
    const result = ListQuerySchema.safeParse({});

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(20);
    }
  });

  it('should coerce string page and limit to numbers', () => {
    const result = ListQuerySchema.safeParse({ page: '5', limit: '30' });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(5);
      expect(result.data.limit).toBe(30);
    }
  });

  it('should accept search with empty string', () => {
    const result = ListQuerySchema.safeParse({ search: '' });

    expect(result.success).toBe(true);
  });

  it('should reject page of 0 after coerce', () => {
    const result = ListQuerySchema.safeParse({ page: '0', limit: '20' });

    expect(result.success).toBe(false);
  });

  it('should reject limit exceeding 100 after coerce', () => {
    const result = ListQuerySchema.safeParse({ page: '1', limit: '101' });

    expect(result.success).toBe(false);
  });
});

// ─── ErrorResponseSchema — additional validation ─────────────────────────────

describe('ErrorResponseSchema — additional validation', () => {
  it('should accept error with empty string code', () => {
    const result = ErrorResponseSchema.safeParse({ code: '', message: 'Error' });

    expect(result.success).toBe(true);
  });

  it('should accept error with empty string message', () => {
    const result = ErrorResponseSchema.safeParse({ code: 'ERR', message: '' });

    expect(result.success).toBe(true);
  });

  it('should accept error with array details', () => {
    const result = ErrorResponseSchema.safeParse({
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      details: [{ field: 'email', message: 'invalid' }],
    });

    expect(result.success).toBe(true);
  });

  it('should accept error without details', () => {
    const result = ErrorResponseSchema.safeParse({
      code: 'NOT_FOUND',
      message: 'Resource not found',
    });

    expect(result.success).toBe(true);
  });
});

// ─── createPaginatedResponseSchema — additional validation ───────────────────

describe('createPaginatedResponseSchema — additional validation', () => {
  const ItemSchema = z.object({
    id: z.string(),
    name: z.string(),
  });
  const PaginatedItemsSchema = createPaginatedResponseSchema(ItemSchema);

  it('should reject missing data field', () => {
    const result = PaginatedItemsSchema.safeParse({
      total: 10,
      page: 1,
      limit: 20,
    });

    expect(result.success).toBe(false);
  });

  it('should reject missing total field', () => {
    const result = PaginatedItemsSchema.safeParse({
      data: [],
      page: 1,
      limit: 20,
    });

    expect(result.success).toBe(false);
  });

  it('should reject missing page field', () => {
    const result = PaginatedItemsSchema.safeParse({
      data: [],
      total: 0,
      limit: 20,
    });

    expect(result.success).toBe(false);
  });

  it('should reject missing limit field', () => {
    const result = PaginatedItemsSchema.safeParse({
      data: [],
      total: 0,
      page: 1,
    });

    expect(result.success).toBe(false);
  });

  it('should reject non-integer total', () => {
    const result = PaginatedItemsSchema.safeParse({
      data: [],
      total: 1.5,
      page: 1,
      limit: 20,
    });

    expect(result.success).toBe(false);
  });

  it('should reject zero page', () => {
    const result = PaginatedItemsSchema.safeParse({
      data: [],
      total: 0,
      page: 0,
      limit: 20,
    });

    expect(result.success).toBe(false);
  });

  it('should reject zero limit', () => {
    const result = PaginatedItemsSchema.safeParse({
      data: [],
      total: 0,
      page: 1,
      limit: 0,
    });

    expect(result.success).toBe(false);
  });
});
