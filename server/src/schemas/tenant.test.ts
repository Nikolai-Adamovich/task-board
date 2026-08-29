import { describe, it, expect } from 'vitest';
import type { z } from 'zod';
import type { MyInvitation } from '@task-board/shared';
import { CreateTenantSchema, UpdateTenantSchema, TenantSchema, MyInvitationSchema } from './tenant.js';

/** Compile-time mutual-exclusion equality check (no runtime behavior). */
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

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

describe('MyInvitation schema/type parity (N-03)', () => {
  const NOW = '2025-01-01T00:00:00.000Z';

  it('shared MyInvitation is exactly z.infer<typeof MyInvitationSchema> (compile-time)', () => {
    // Compile error here means the shared interface and the schema drifted apart.
    const assert: Equal<MyInvitation, z.infer<typeof MyInvitationSchema>> = true;

    expect(assert).toBe(true);
  });

  it('parses a valid enriched invitation', () => {
    const parsed = MyInvitationSchema.parse({
      id: '507f1f77bcf86cd799439011',
      tenantId: '507f1f77bcf86cd799439012',
      userId: '507f1f77bcf86cd799439013',
      role: 'MEMBER',
      status: 'ACCESS_REVOKED',
      expiresAt: null,
      invitation: {
        status: 'PENDING',
        tokenHash: 'abc123',
        invitedBy: '507f1f77bcf86cd799439014',
        invitedOn: NOW,
      },
      displayName: null,
      email: null,
      tenantName: 'Acme',
      createdAt: NOW,
      updatedAt: NOW,
    });

    expect(parsed.tenantName).toBe('Acme');
    expect(parsed.invitation?.status).toBe('PENDING');
  });

  it('rejects an invalid role coming out of the database', () => {
    expect(() =>
      MyInvitationSchema.parse({
        id: '507f1f77bcf86cd799439011',
        tenantId: '507f1f77bcf86cd799439012',
        userId: '507f1f77bcf86cd799439013',
        role: 'SUPERUSER',
        status: 'ACCESS_REVOKED',
        expiresAt: null,
        invitation: null,
        displayName: null,
        email: null,
        tenantName: 'Acme',
        createdAt: NOW,
        updatedAt: NOW,
      }),
    ).toThrow();
  });
});
