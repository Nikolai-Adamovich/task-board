import { describe, it, expect } from 'vitest';
import { CreateTenantSchema, UpdateTenantSchema, TenantSchema } from './tenant.js';

const NOW = '2025-01-01T00:00:00.000Z';

describe('tenant description limit (120 chars)', () => {
  it('accepts a description of exactly 120 characters', () => {
    const result = CreateTenantSchema.parse({ name: 'Acme', description: 'a'.repeat(120) });

    expect(result.description).toHaveLength(120);
  });

  it('rejects a description of 121 characters', () => {
    expect(() => CreateTenantSchema.parse({ name: 'Acme', description: 'a'.repeat(121) })).toThrow(
      'Too big: expected string to have <=120 characters',
    );
  });

  it('enforces the limit on update as well', () => {
    expect(() => UpdateTenantSchema.parse({ description: 'a'.repeat(121) })).toThrow();
    expect(UpdateTenantSchema.parse({ description: 'a'.repeat(120) }).description).toHaveLength(120);
  });

  it('enforces the limit on the entity schema', () => {
    const base = {
      id: '507f1f77bcf86cd799439011',
      name: 'Acme',
      slug: 'acme',
      status: 'ACTIVE',
      deletionScheduledAt: null,
      createdAt: NOW,
      updatedAt: NOW,
    };

    expect(() => TenantSchema.parse({ ...base, description: 'a'.repeat(121) })).toThrow();
    expect(TenantSchema.parse({ ...base, description: 'a'.repeat(120) }).description).toHaveLength(120);
  });
});
