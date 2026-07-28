/**
 * Tests for board and column schemas: BoardSchema, CreateBoardSchema, UpdateBoardSchema,
 * ColumnSchema, CreateColumnSchema.
 *
 * Boards contain columns which hold tasks. These schemas validate
 * the data shapes for board and column CRUD operations.
 */
import { describe, it, expect } from 'vitest';
import { BoardSchema, CreateBoardSchema, UpdateBoardSchema, ColumnSchema, CreateColumnSchema } from './board.js';

// ─── BoardSchema ─────────────────────────────────────────────────────────────

describe('BoardSchema', () => {
  const validBoard = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    tenantId: '660e8400-e29b-41d4-a716-446655440001',
    projectId: '770e8400-e29b-41d4-a716-446655440002',
    name: 'Sprint Board',
    description: 'Main project board',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  it('should accept a valid board', () => {
    const result = BoardSchema.safeParse(validBoard);

    expect(result.success).toBe(true);
  });

  it('should accept board with null description', () => {
    const result = BoardSchema.safeParse({ ...validBoard, description: null });

    expect(result.success).toBe(true);
  });

  it('should reject empty name', () => {
    const result = BoardSchema.safeParse({ ...validBoard, name: '' });

    expect(result.success).toBe(false);
  });

  it('should reject name exceeding 100 characters', () => {
    const result = BoardSchema.safeParse({ ...validBoard, name: 'a'.repeat(101) });

    expect(result.success).toBe(false);
  });
});

// ─── CreateBoardSchema ───────────────────────────────────────────────────────

describe('CreateBoardSchema', () => {
  it('should accept valid board creation data', () => {
    const result = CreateBoardSchema.safeParse({
      name: 'New Board',
    });

    expect(result.success).toBe(true);
  });

  it('should accept board with custom column names', () => {
    const result = CreateBoardSchema.safeParse({
      name: 'Custom Board',
      columnNames: ['To Do', 'In Progress', 'Done'],
    });

    expect(result.success).toBe(true);
  });

  it('should reject empty column name in array', () => {
    const result = CreateBoardSchema.safeParse({
      name: 'Board',
      columnNames: ['To Do', ''],
    });

    expect(result.success).toBe(false);
  });

  it('should reject column name exceeding 50 characters', () => {
    const result = CreateBoardSchema.safeParse({
      name: 'Board',
      columnNames: ['a'.repeat(51)],
    });

    expect(result.success).toBe(false);
  });
});

// ─── UpdateBoardSchema ───────────────────────────────────────────────────────

describe('UpdateBoardSchema', () => {
  it('should accept partial update', () => {
    const result = UpdateBoardSchema.safeParse({ name: 'Updated Board' });

    expect(result.success).toBe(true);
  });

  it('should accept empty update', () => {
    const result = UpdateBoardSchema.safeParse({});

    expect(result.success).toBe(true);
  });
});

// ─── ColumnSchema ────────────────────────────────────────────────────────────

describe('ColumnSchema', () => {
  const validColumn = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    boardId: '660e8400-e29b-41d4-a716-446655440001',
    tenantId: '770e8400-e29b-41d4-a716-446655440002',
    name: 'To Do',
    position: 0,
    isDefault: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  it('should accept a valid column', () => {
    const result = ColumnSchema.safeParse(validColumn);

    expect(result.success).toBe(true);
  });

  it('should reject negative position', () => {
    const result = ColumnSchema.safeParse({ ...validColumn, position: -1 });

    expect(result.success).toBe(false);
  });

  it('should accept position 0', () => {
    const result = ColumnSchema.safeParse({ ...validColumn, position: 0 });

    expect(result.success).toBe(true);
  });

  it('should reject non-integer position', () => {
    const result = ColumnSchema.safeParse({ ...validColumn, position: 1.5 });

    expect(result.success).toBe(false);
  });

  it('should reject empty column name', () => {
    const result = ColumnSchema.safeParse({ ...validColumn, name: '' });

    expect(result.success).toBe(false);
  });
});

// ─── CreateColumnSchema ──────────────────────────────────────────────────────

describe('CreateColumnSchema', () => {
  it('should accept valid column creation', () => {
    const result = CreateColumnSchema.safeParse({ name: 'New Column' });

    expect(result.success).toBe(true);
  });

  it('should accept column with explicit position', () => {
    const result = CreateColumnSchema.safeParse({ name: 'Column', position: 2 });

    expect(result.success).toBe(true);
  });

  it('should reject position at optional boundary (negative)', () => {
    const result = CreateColumnSchema.safeParse({ name: 'Column', position: -1 });

    expect(result.success).toBe(false);
  });
});
