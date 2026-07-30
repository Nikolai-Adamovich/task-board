/**
 * Tests for task schemas: TaskSchema, CreateTaskSchema, UpdateTaskSchema,
 * MoveTaskSchema, AssignTaskSchema.
 *
 * Tasks are the core work items. These tests verify constraint enforcement
 * for all task-related operations (CRUD, move, assign).
 */
import { describe, it, expect } from 'vitest';
import {
  TaskSchema,
  CreateTaskSchema,
  UpdateTaskSchema,
  MoveTaskSchema,
  AssignTaskSchema,
  MyTaskSchema,
} from './task.js';

// ─── TaskSchema ──────────────────────────────────────────────────────────────

describe('TaskSchema', () => {
  const validTask = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    tenantId: '660e8400-e29b-41d4-a716-446655440001',
    projectId: '770e8400-e29b-41d4-a716-446655440002',
    boardId: '880e8400-e29b-41d4-a716-446655440003',
    columnId: '990e8400-e29b-41d4-a716-446655440004',
    sprintId: null,
    title: 'Implement login page',
    description: 'Build the login form with email/password',
    assigneeIds: [],
    priority: 'medium' as const,
    position: 0,
    createdBy: 'aa0e8400-e29b-41d4-a716-446655440005',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  it('should accept a valid task', () => {
    const result = TaskSchema.safeParse(validTask);

    expect(result.success).toBe(true);
  });

  it('should accept task with null sprintId (backlog)', () => {
    const result = TaskSchema.safeParse({ ...validTask, sprintId: null });

    expect(result.success).toBe(true);
  });

  it('should accept task with valid sprintId', () => {
    const result = TaskSchema.safeParse({
      ...validTask,
      sprintId: 'bb0e8400-e29b-41d4-a716-446655440006',
    });

    expect(result.success).toBe(true);
  });

  it('should accept all priority levels', () => {
    for (const priority of ['low', 'medium', 'high', 'critical'] as const) {
      const result = TaskSchema.safeParse({ ...validTask, priority });

      expect(result.success).toBe(true);
    }
  });

  it('should reject invalid priority', () => {
    const result = TaskSchema.safeParse({ ...validTask, priority: 'urgent' });

    expect(result.success).toBe(false);
  });

  it('should reject empty title', () => {
    const result = TaskSchema.safeParse({ ...validTask, title: '' });

    expect(result.success).toBe(false);
  });

  it('should reject title exceeding 200 characters', () => {
    const result = TaskSchema.safeParse({ ...validTask, title: 'a'.repeat(201) });

    expect(result.success).toBe(false);
  });

  it('should reject negative position', () => {
    const result = TaskSchema.safeParse({ ...validTask, position: -1 });

    expect(result.success).toBe(false);
  });
});

// ─── CreateTaskSchema ────────────────────────────────────────────────────────

describe('CreateTaskSchema', () => {
  const validCreate = {
    title: 'New Task',
    projectId: '550e8400-e29b-41d4-a716-446655440000',
    boardId: '660e8400-e29b-41d4-a716-446655440001',
    columnId: '770e8400-e29b-41d4-a716-446655440002',
  };

  it('should accept valid task creation data with defaults', () => {
    const result = CreateTaskSchema.safeParse(validCreate);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.priority).toBe('medium');
      expect(result.data.assigneeIds).toEqual([]);
    }
  });

  it('should accept task creation with all fields', () => {
    const result = CreateTaskSchema.safeParse({
      ...validCreate,
      description: 'Detailed description',
      sprintId: '880e8400-e29b-41d4-a716-446655440003',
      priority: 'high',
      assigneeIds: ['990e8400-e29b-41d4-a716-446655440004'],
    });

    expect(result.success).toBe(true);
  });

  it('should reject missing title', () => {
    const result = CreateTaskSchema.safeParse({
      projectId: '550e8400-e29b-41d4-a716-446655440000',
      boardId: '660e8400-e29b-41d4-a716-446655440001',
      columnId: '770e8400-e29b-41d4-a716-446655440002',
    });

    expect(result.success).toBe(false);
  });

  it('should reject invalid projectId UUID', () => {
    const result = CreateTaskSchema.safeParse({
      ...validCreate,
      projectId: 'not-a-uuid',
    });

    expect(result.success).toBe(false);
  });
});

// ─── UpdateTaskSchema ────────────────────────────────────────────────────────

describe('UpdateTaskSchema', () => {
  it('should accept partial update with title only', () => {
    const result = UpdateTaskSchema.safeParse({ title: 'Updated Title' });

    expect(result.success).toBe(true);
  });

  it('should accept partial update with priority', () => {
    const result = UpdateTaskSchema.safeParse({ priority: 'critical' });

    expect(result.success).toBe(true);
  });

  it('should accept empty update (all optional)', () => {
    const result = UpdateTaskSchema.safeParse({});

    expect(result.success).toBe(true);
  });
});

// ─── MoveTaskSchema ──────────────────────────────────────────────────────────

describe('MoveTaskSchema', () => {
  it('should accept valid move task data', () => {
    const result = MoveTaskSchema.safeParse({
      taskId: '550e8400-e29b-41d4-a716-446655440000',
      targetColumnId: '660e8400-e29b-41d4-a716-446655440001',
    });

    expect(result.success).toBe(true);
  });

  it('should accept move with optional targetSprintId', () => {
    const result = MoveTaskSchema.safeParse({
      taskId: '550e8400-e29b-41d4-a716-446655440000',
      targetColumnId: '660e8400-e29b-41d4-a716-446655440001',
      targetSprintId: '770e8400-e29b-41d4-a716-446655440002',
    });

    expect(result.success).toBe(true);
  });

  it('should reject invalid taskId UUID', () => {
    const result = MoveTaskSchema.safeParse({
      taskId: 'bad',
      targetColumnId: '660e8400-e29b-41d4-a716-446655440001',
    });

    expect(result.success).toBe(false);
  });
});

// ─── AssignTaskSchema ────────────────────────────────────────────────────────

describe('AssignTaskSchema', () => {
  it('should accept valid assign data', () => {
    const result = AssignTaskSchema.safeParse({
      taskId: '550e8400-e29b-41d4-a716-446655440000',
      assigneeIds: ['660e8400-e29b-41d4-a716-446655440001'],
    });

    expect(result.success).toBe(true);
  });

  it('should accept empty assigneeIds (unassign all)', () => {
    const result = AssignTaskSchema.safeParse({
      taskId: '550e8400-e29b-41d4-a716-446655440000',
      assigneeIds: [],
    });

    expect(result.success).toBe(true);
  });

  it('should reject invalid assignee UUID', () => {
    const result = AssignTaskSchema.safeParse({
      taskId: '550e8400-e29b-41d4-a716-446655440000',
      assigneeIds: ['not-a-uuid'],
    });

    expect(result.success).toBe(false);
  });
});

// ─── MyTaskSchema ────────────────────────────────────────────────────────────

describe('MyTaskSchema', () => {
  const validMyTask = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    tenantId: '660e8400-e29b-41d4-a716-446655440001',
    tenantName: 'Acme Corp',
    projectId: '770e8400-e29b-41d4-a716-446655440002',
    projectName: 'Project Alpha',
    boardId: '880e8400-e29b-41d4-a716-446655440003',
    columnId: '990e8400-e29b-41d4-a716-446655440004',
    columnTitle: 'In Progress',
    title: 'Implement login page',
    description: 'Build the login form',
    priority: 'medium' as const,
    sprintId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  it('should accept a valid my-task', () => {
    const result = MyTaskSchema.safeParse(validMyTask);

    expect(result.success).toBe(true);
  });

  it('should accept my-task with null description', () => {
    const result = MyTaskSchema.safeParse({ ...validMyTask, description: null });

    expect(result.success).toBe(true);
  });

  it('should accept my-task with null sprintId (backlog)', () => {
    const result = MyTaskSchema.safeParse({ ...validMyTask, sprintId: null });

    expect(result.success).toBe(true);
  });

  it('should accept my-task with valid sprintId', () => {
    const result = MyTaskSchema.safeParse({
      ...validMyTask,
      sprintId: 'aa0e8400-e29b-41d4-a716-446655440005',
    });

    expect(result.success).toBe(true);
  });

  it('should accept all priority levels', () => {
    for (const priority of ['low', 'medium', 'high', 'critical'] as const) {
      const result = MyTaskSchema.safeParse({ ...validMyTask, priority });

      expect(result.success).toBe(true);
    }
  });

  it('should reject invalid priority', () => {
    const result = MyTaskSchema.safeParse({ ...validMyTask, priority: 'urgent' });

    expect(result.success).toBe(false);
  });

  it('should reject invalid id UUID', () => {
    const result = MyTaskSchema.safeParse({ ...validMyTask, id: 'not-a-uuid' });

    expect(result.success).toBe(false);
  });

  it('should reject invalid tenantId UUID', () => {
    const result = MyTaskSchema.safeParse({ ...validMyTask, tenantId: 'bad' });

    expect(result.success).toBe(false);
  });

  it('should reject missing required fields', () => {
    const result = MyTaskSchema.safeParse({});

    expect(result.success).toBe(false);
  });
});
