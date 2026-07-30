/**
 * Tests for sprint schemas: SprintSchema, CreateSprintSchema, UpdateSprintSchema.
 *
 * Sprints are time-boxed iterations that group tasks within a project.
 * These tests verify date handling, status constraints, and field validation.
 */
import { describe, it, expect } from 'vitest';
import { SprintSchema, CreateSprintSchema, UpdateSprintSchema } from './sprint.js';

// ─── SprintSchema ────────────────────────────────────────────────────────────

describe('SprintSchema', () => {
  const validSprint = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    tenantId: '660e8400-e29b-41d4-a716-446655440001',
    projectId: '770e8400-e29b-41d4-a716-446655440002',
    name: 'Sprint 1',
    startDate: '2026-01-01T00:00:00.000Z',
    endDate: '2026-01-15T00:00:00.000Z',
    goal: 'Complete authentication feature',
    status: 'planned' as const,
    taskIds: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  it('should accept a valid sprint', () => {
    const result = SprintSchema.safeParse(validSprint);

    expect(result.success).toBe(true);
  });

  it('should accept sprint with null goal', () => {
    const result = SprintSchema.safeParse({ ...validSprint, goal: null });

    expect(result.success).toBe(true);
  });

  it('should accept sprint with task IDs', () => {
    const result = SprintSchema.safeParse({
      ...validSprint,
      taskIds: ['550e8400-e29b-41d4-a716-446655440000'],
    });

    expect(result.success).toBe(true);
  });

  it('should accept all sprint statuses', () => {
    for (const status of ['planned', 'active', 'completed'] as const) {
      const result = SprintSchema.safeParse({ ...validSprint, status });

      expect(result.success).toBe(true);
    }
  });

  it('should reject invalid status', () => {
    const result = SprintSchema.safeParse({ ...validSprint, status: 'cancelled' });

    expect(result.success).toBe(false);
  });

  it('should reject empty name', () => {
    const result = SprintSchema.safeParse({ ...validSprint, name: '' });

    expect(result.success).toBe(false);
  });

  it('should reject invalid date format', () => {
    const result = SprintSchema.safeParse({
      ...validSprint,
      startDate: 'not-a-date',
    });

    expect(result.success).toBe(false);
  });
});

// ─── CreateSprintSchema ──────────────────────────────────────────────────────

describe('CreateSprintSchema', () => {
  const validCreate = {
    name: 'Sprint 1',
    startDate: '2026-01-01T00:00:00.000Z',
    endDate: '2026-01-15T00:00:00.000Z',
  };

  it('should accept valid sprint creation data', () => {
    const result = CreateSprintSchema.safeParse(validCreate);

    expect(result.success).toBe(true);
  });

  it('should accept sprint creation with goal', () => {
    const result = CreateSprintSchema.safeParse({
      ...validCreate,
      goal: 'Complete feature X',
    });

    expect(result.success).toBe(true);
  });

  it('should reject missing name', () => {
    const result = CreateSprintSchema.safeParse({
      startDate: '2026-01-01T00:00:00.000Z',
      endDate: '2026-01-15T00:00:00.000Z',
    });

    expect(result.success).toBe(false);
  });

  it('should reject missing startDate', () => {
    const result = CreateSprintSchema.safeParse({
      name: 'Sprint',
      endDate: '2026-01-15T00:00:00.000Z',
    });

    expect(result.success).toBe(false);
  });

  it('should reject name exceeding 100 characters', () => {
    const result = CreateSprintSchema.safeParse({
      ...validCreate,
      name: 'a'.repeat(101),
    });

    expect(result.success).toBe(false);
  });
});

// ─── UpdateSprintSchema ──────────────────────────────────────────────────────

describe('UpdateSprintSchema', () => {
  it('should accept partial update with name', () => {
    const result = UpdateSprintSchema.safeParse({ name: 'Updated Sprint' });

    expect(result.success).toBe(true);
  });

  it('should accept partial update with status', () => {
    const result = UpdateSprintSchema.safeParse({ status: 'active' });

    expect(result.success).toBe(true);
  });

  it('should accept empty update (all optional)', () => {
    const result = UpdateSprintSchema.safeParse({});

    expect(result.success).toBe(true);
  });

  it('should reject goal exceeding 500 characters', () => {
    const result = UpdateSprintSchema.safeParse({ goal: 'a'.repeat(501) });

    expect(result.success).toBe(false);
  });
});

// ─── SprintSchema — additional validation ────────────────────────────────────

describe('SprintSchema — additional field validation', () => {
  const validSprint = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    tenantId: '660e8400-e29b-41d4-a716-446655440001',
    projectId: '770e8400-e29b-41d4-a716-446655440002',
    name: 'Sprint 1',
    startDate: '2026-01-01T00:00:00.000Z',
    endDate: '2026-01-15T00:00:00.000Z',
    goal: 'Complete authentication feature',
    status: 'planned' as const,
    taskIds: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  it('should reject invalid id UUID', () => {
    const result = SprintSchema.safeParse({ ...validSprint, id: 'not-a-uuid' });

    expect(result.success).toBe(false);
  });

  it('should reject invalid tenantId UUID', () => {
    const result = SprintSchema.safeParse({ ...validSprint, tenantId: 'bad' });

    expect(result.success).toBe(false);
  });

  it('should reject invalid projectId UUID', () => {
    const result = SprintSchema.safeParse({ ...validSprint, projectId: 'bad' });

    expect(result.success).toBe(false);
  });

  it('should reject name exceeding 100 characters', () => {
    const result = SprintSchema.safeParse({ ...validSprint, name: 'a'.repeat(101) });

    expect(result.success).toBe(false);
  });

  it('should reject invalid endDate datetime format', () => {
    const result = SprintSchema.safeParse({ ...validSprint, endDate: 'not-a-date' });

    expect(result.success).toBe(false);
  });

  it('should reject invalid UUID in taskIds array', () => {
    const result = SprintSchema.safeParse({ ...validSprint, taskIds: ['not-a-uuid'] });

    expect(result.success).toBe(false);
  });

  it('should reject missing required fields', () => {
    const result = SprintSchema.safeParse({});

    expect(result.success).toBe(false);
  });
});

// ─── CreateSprintSchema — additional validation ──────────────────────────────

describe('CreateSprintSchema — additional field validation', () => {
  const validCreate = {
    name: 'Sprint 1',
    startDate: '2026-01-01T00:00:00.000Z',
    endDate: '2026-01-15T00:00:00.000Z',
  };

  it('should reject invalid startDate format', () => {
    const result = CreateSprintSchema.safeParse({
      ...validCreate,
      startDate: 'not-a-date',
    });

    expect(result.success).toBe(false);
  });

  it('should reject invalid endDate format', () => {
    const result = CreateSprintSchema.safeParse({
      ...validCreate,
      endDate: 'bad-date',
    });

    expect(result.success).toBe(false);
  });

  it('should reject missing endDate', () => {
    const result = CreateSprintSchema.safeParse({
      name: 'Sprint',
      startDate: '2026-01-01T00:00:00.000Z',
    });

    expect(result.success).toBe(false);
  });

  it('should reject goal exceeding 500 characters', () => {
    const result = CreateSprintSchema.safeParse({
      ...validCreate,
      goal: 'a'.repeat(501),
    });

    expect(result.success).toBe(false);
  });
});

// ─── UpdateSprintSchema — additional validation ──────────────────────────────

describe('UpdateSprintSchema — additional field validation', () => {
  it('should reject name exceeding 100 characters', () => {
    const result = UpdateSprintSchema.safeParse({ name: 'a'.repeat(101) });

    expect(result.success).toBe(false);
  });

  it('should reject empty name', () => {
    const result = UpdateSprintSchema.safeParse({ name: '' });

    expect(result.success).toBe(false);
  });

  it('should reject invalid startDate format', () => {
    const result = UpdateSprintSchema.safeParse({ startDate: 'not-a-date' });

    expect(result.success).toBe(false);
  });

  it('should reject invalid endDate format', () => {
    const result = UpdateSprintSchema.safeParse({ endDate: 'bad-date' });

    expect(result.success).toBe(false);
  });

  it('should reject invalid status value', () => {
    const result = UpdateSprintSchema.safeParse({ status: 'cancelled' });

    expect(result.success).toBe(false);
  });
});
