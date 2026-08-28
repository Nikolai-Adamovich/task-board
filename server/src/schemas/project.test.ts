import { describe, it, expect } from 'vitest';
import { CreateProjectSchema, UpdateProjectSchema, ProjectSchema } from './project.js';

const NOW = '2025-01-01T00:00:00.000Z';

describe('project description limit (120 chars)', () => {
  it('accepts a description of exactly 120 characters', () => {
    const result = CreateProjectSchema.parse({ key: 'PROJ', name: 'Proj', description: 'a'.repeat(120) });

    expect(result.description).toHaveLength(120);
  });

  it('rejects a description of 121 characters', () => {
    expect(() => CreateProjectSchema.parse({ key: 'PROJ', name: 'Proj', description: 'a'.repeat(121) })).toThrow(
      'Too big: expected string to have <=120 characters',
    );
  });

  it('enforces the limit on update as well', () => {
    expect(() => UpdateProjectSchema.parse({ description: 'a'.repeat(121) })).toThrow();
    expect(UpdateProjectSchema.parse({ description: 'a'.repeat(120) }).description).toHaveLength(120);
  });

  it('enforces the limit on the entity schema', () => {
    const base = {
      id: '507f1f77bcf86cd799439011',
      tenantId: '507f1f77bcf86cd799439012',
      key: 'PROJ',
      name: 'Proj',
      status: 'ACTIVE',
      defaultStatusId: 's1',
      defaultBoardId: 'b1',
      archiveReason: null,
      deletionScheduledAt: null,
      createdAt: NOW,
      updatedAt: NOW,
    };

    expect(() => ProjectSchema.parse({ ...base, description: 'a'.repeat(121) })).toThrow();
    expect(ProjectSchema.parse({ ...base, description: 'a'.repeat(120) }).description).toHaveLength(120);
  });
});
