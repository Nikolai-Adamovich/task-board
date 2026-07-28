/**
 * Tests for project schemas: ProjectSchema, CreateProjectSchema, UpdateProjectSchema, ProjectMemberSchema.
 *
 * Projects belong to tenants and contain boards and tasks.
 * These tests verify the shape constraints for project CRUD operations.
 */
import { describe, it, expect } from 'vitest';
import { ProjectSchema, CreateProjectSchema, UpdateProjectSchema, ProjectMemberSchema } from './project.js';

// ─── ProjectSchema ───────────────────────────────────────────────────────────

describe('ProjectSchema', () => {
  const validProject = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    tenantId: '660e8400-e29b-41d4-a716-446655440001',
    name: 'My Project',
    slug: 'my-project',
    description: 'A test project',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  it('should accept a valid project', () => {
    const result = ProjectSchema.safeParse(validProject);

    expect(result.success).toBe(true);
  });

  it('should accept project with null description', () => {
    const result = ProjectSchema.safeParse({ ...validProject, description: null });

    expect(result.success).toBe(true);
  });

  it('should accept project without description (optional)', () => {
    const noDesc = Object.fromEntries(Object.entries(validProject).filter(([key]) => key !== 'description'));
    const result = ProjectSchema.safeParse(noDesc);

    expect(result.success).toBe(true);
  });

  it('should reject description exceeding 500 characters', () => {
    const result = ProjectSchema.safeParse({
      ...validProject,
      description: 'a'.repeat(501),
    });

    expect(result.success).toBe(false);
  });
});

// ─── CreateProjectSchema ─────────────────────────────────────────────────────

describe('CreateProjectSchema', () => {
  it('should accept valid create-project data', () => {
    const result = CreateProjectSchema.safeParse({
      name: 'New Project',
      slug: 'new-project',
    });

    expect(result.success).toBe(true);
  });

  it('should accept create-project with optional description', () => {
    const result = CreateProjectSchema.safeParse({
      name: 'New Project',
      slug: 'new-project',
      description: 'Some description',
    });

    expect(result.success).toBe(true);
  });

  it('should reject missing name', () => {
    const result = CreateProjectSchema.safeParse({ slug: 'new-project' });

    expect(result.success).toBe(false);
  });

  it('should reject missing slug', () => {
    const result = CreateProjectSchema.safeParse({ name: 'New Project' });

    expect(result.success).toBe(false);
  });
});

// ─── UpdateProjectSchema ─────────────────────────────────────────────────────

describe('UpdateProjectSchema', () => {
  it('should accept partial update', () => {
    const result = UpdateProjectSchema.safeParse({ name: 'Updated' });

    expect(result.success).toBe(true);
  });

  it('should accept empty update (all optional)', () => {
    const result = UpdateProjectSchema.safeParse({});

    expect(result.success).toBe(true);
  });
});

// ─── ProjectMemberSchema ─────────────────────────────────────────────────────

describe('ProjectMemberSchema', () => {
  const validMember = {
    userId: '550e8400-e29b-41d4-a716-446655440000',
    projectId: '660e8400-e29b-41d4-a716-446655440001',
    tenantId: '770e8400-e29b-41d4-a716-446655440002',
    role: 'developer' as const,
  };

  it('should accept a valid project member', () => {
    const result = ProjectMemberSchema.safeParse(validMember);

    expect(result.success).toBe(true);
  });

  it('should accept all project roles', () => {
    for (const role of ['admin', 'developer', 'viewer'] as const) {
      const result = ProjectMemberSchema.safeParse({ ...validMember, role });

      expect(result.success).toBe(true);
    }
  });

  it('should reject invalid project role', () => {
    const result = ProjectMemberSchema.safeParse({ ...validMember, role: 'owner' });

    expect(result.success).toBe(false);
  });
});
