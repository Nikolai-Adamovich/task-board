/**
 * Tests for tenant schemas: TenantSchema, CreateTenantSchema, UpdateTenantSchema, TenantMemberSchema.
 *
 * Tenants are the top-level organizational unit in the multi-tenant system.
 * Validating these schemas ensures correct data shapes for CRUD operations.
 */
import { describe, it, expect } from 'vitest';
import {
  TenantSchema,
  CreateTenantSchema,
  UpdateTenantSchema,
  TenantMemberSchema,
  InviteMemberSchema,
  TenantWithRoleSchema,
} from './tenant.js';

// ─── TenantSchema ────────────────────────────────────────────────────────────

describe('TenantSchema', () => {
  const validTenant = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Acme Corp',
    slug: 'acme-corp',
    subscription: 'free' as const,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  it('should accept a valid tenant', () => {
    const result = TenantSchema.safeParse(validTenant);

    expect(result.success).toBe(true);
  });

  it('should reject empty name', () => {
    const result = TenantSchema.safeParse({ ...validTenant, name: '' });

    expect(result.success).toBe(false);
  });

  it('should reject invalid slug (starts with hyphen)', () => {
    const result = TenantSchema.safeParse({ ...validTenant, slug: '-bad-slug' });

    expect(result.success).toBe(false);
  });

  it('should reject slug with uppercase letters', () => {
    const result = TenantSchema.safeParse({ ...validTenant, slug: 'Bad-Slug' });

    expect(result.success).toBe(false);
  });

  it('should reject slug ending with hyphen', () => {
    const result = TenantSchema.safeParse({ ...validTenant, slug: 'bad-slug-' });

    expect(result.success).toBe(false);
  });

  it('should accept single-character slug name (boundary: 2 min)', () => {
    // Minimum slug length is 2
    const result = TenantSchema.safeParse({ ...validTenant, slug: 'ab' });

    expect(result.success).toBe(true);
  });

  it('should reject single-character slug', () => {
    const result = TenantSchema.safeParse({ ...validTenant, slug: 'a' });

    expect(result.success).toBe(false);
  });

  it('should accept tenant with description as null', () => {
    const result = TenantSchema.safeParse({ ...validTenant, description: null });

    expect(result.success).toBe(true);
  });

  it('should accept tenant with description as string', () => {
    const result = TenantSchema.safeParse({ ...validTenant, description: 'A brief description' });

    expect(result.success).toBe(true);
  });

  it('should accept tenant without description (backward compat)', () => {
    const result = TenantSchema.safeParse(validTenant);

    expect(result.success).toBe(true);
  });

  it('should reject description exceeding 500 characters', () => {
    const result = TenantSchema.safeParse({ ...validTenant, description: 'a'.repeat(501) });

    expect(result.success).toBe(false);
  });
});

// ─── CreateTenantSchema ──────────────────────────────────────────────────────

describe('CreateTenantSchema', () => {
  it('should accept valid create-tenant data', () => {
    const result = CreateTenantSchema.safeParse({
      name: 'New Org',
      slug: 'new-org',
    });

    expect(result.success).toBe(true);
  });

  it('should reject empty name', () => {
    const result = CreateTenantSchema.safeParse({
      name: '',
      slug: 'new-org',
    });

    expect(result.success).toBe(false);
  });

  it('should reject name exceeding 100 characters', () => {
    const result = CreateTenantSchema.safeParse({
      name: 'a'.repeat(101),
      slug: 'new-org',
    });

    expect(result.success).toBe(false);
  });

  it('should reject slug exceeding 80 characters', () => {
    const result = CreateTenantSchema.safeParse({
      name: 'Org',
      slug: 'a'.repeat(81),
    });

    expect(result.success).toBe(false);
  });

  it('should reject slug with invalid characters', () => {
    const result = CreateTenantSchema.safeParse({
      name: 'Org',
      slug: 'has spaces',
    });

    expect(result.success).toBe(false);
  });

  it('should accept create-tenant data with description', () => {
    const result = CreateTenantSchema.safeParse({
      name: 'New Org',
      slug: 'new-org',
      description: 'A new organization',
    });

    expect(result.success).toBe(true);
  });

  it('should accept create-tenant data without description', () => {
    const result = CreateTenantSchema.safeParse({
      name: 'New Org',
      slug: 'new-org',
    });

    expect(result.success).toBe(true);
  });
});

// ─── UpdateTenantSchema ──────────────────────────────────────────────────────

describe('UpdateTenantSchema', () => {
  it('should accept partial update with name only', () => {
    const result = UpdateTenantSchema.safeParse({ name: 'Updated Name' });

    expect(result.success).toBe(true);
  });

  it('should accept partial update with slug only', () => {
    const result = UpdateTenantSchema.safeParse({ slug: 'updated-slug' });

    expect(result.success).toBe(true);
  });

  it('should accept empty update (all optional)', () => {
    const result = UpdateTenantSchema.safeParse({});

    expect(result.success).toBe(true);
  });

  it('should accept partial update with description only', () => {
    const result = UpdateTenantSchema.safeParse({ description: 'Updated description' });

    expect(result.success).toBe(true);
  });
});

// ─── TenantMemberSchema ──────────────────────────────────────────────────────

describe('TenantMemberSchema', () => {
  const validMember = {
    userId: '550e8400-e29b-41d4-a716-446655440000',
    tenantId: '660e8400-e29b-41d4-a716-446655440001',
    role: 'owner' as const,
    status: 'active' as const,
    invitedEmail: null,
    invitationToken: null,
    invitedAt: null,
  };

  it('should accept a valid tenant member', () => {
    const result = TenantMemberSchema.safeParse(validMember);

    expect(result.success).toBe(true);
  });

  it('should accept all tenant roles', () => {
    for (const role of ['owner', 'admin', 'member'] as const) {
      const result = TenantMemberSchema.safeParse({ ...validMember, role });

      expect(result.success).toBe(true);
    }
  });

  it('should accept all member statuses including access_revoked', () => {
    for (const status of ['active', 'pending', 'declined', 'access_revoked'] as const) {
      const result = TenantMemberSchema.safeParse({ ...validMember, status });

      expect(result.success).toBe(true);
    }
  });

  it('should reject invalid role', () => {
    const result = TenantMemberSchema.safeParse({ ...validMember, role: 'superadmin' });

    expect(result.success).toBe(false);
  });

  it('should reject invalid status', () => {
    const result = TenantMemberSchema.safeParse({ ...validMember, status: 'banned' });

    expect(result.success).toBe(false);
  });

  it('should reject invalid userId UUID', () => {
    const result = TenantMemberSchema.safeParse({ ...validMember, userId: 'bad' });

    expect(result.success).toBe(false);
  });

  it('should accept null userId (pending invitation)', () => {
    const result = TenantMemberSchema.safeParse({ ...validMember, userId: null, status: 'pending' });

    expect(result.success).toBe(true);
  });

  it('should accept non-null invitedEmail for pending member', () => {
    const result = TenantMemberSchema.safeParse({
      ...validMember,
      status: 'pending',
      invitedEmail: 'invited@example.com',
      invitationToken: 'some-token',
      invitedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(result.success).toBe(true);
  });

  it('should accept null invitedEmail for active member', () => {
    const result = TenantMemberSchema.safeParse({ ...validMember, invitedEmail: null });

    expect(result.success).toBe(true);
  });

  it('should accept null invitationToken for active member', () => {
    const result = TenantMemberSchema.safeParse({ ...validMember, invitationToken: null });

    expect(result.success).toBe(true);
  });

  it('should accept null invitedAt for active member', () => {
    const result = TenantMemberSchema.safeParse({ ...validMember, invitedAt: null });

    expect(result.success).toBe(true);
  });

  it('should reject invalid tenantId UUID', () => {
    const result = TenantMemberSchema.safeParse({ ...validMember, tenantId: 'not-a-uuid' });

    expect(result.success).toBe(false);
  });
});

// ─── InviteMemberSchema ──────────────────────────────────────────────────────

describe('InviteMemberSchema', () => {
  it('should accept valid invite-member data', () => {
    const result = InviteMemberSchema.safeParse({
      email: 'newmember@example.com',
      role: 'member',
    });

    expect(result.success).toBe(true);
  });

  it('should accept all tenant roles', () => {
    for (const role of ['owner', 'admin', 'member'] as const) {
      const result = InviteMemberSchema.safeParse({ email: 'user@example.com', role });

      expect(result.success).toBe(true);
    }
  });

  it('should reject invalid email', () => {
    const result = InviteMemberSchema.safeParse({
      email: 'not-an-email',
      role: 'member',
    });

    expect(result.success).toBe(false);
  });

  it('should reject empty email', () => {
    const result = InviteMemberSchema.safeParse({
      email: '',
      role: 'member',
    });

    expect(result.success).toBe(false);
  });

  it('should reject invalid role', () => {
    const result = InviteMemberSchema.safeParse({
      email: 'user@example.com',
      role: 'superadmin',
    });

    expect(result.success).toBe(false);
  });

  it('should reject missing email', () => {
    const result = InviteMemberSchema.safeParse({ role: 'member' });

    expect(result.success).toBe(false);
  });

  it('should reject missing role', () => {
    const result = InviteMemberSchema.safeParse({ email: 'user@example.com' });

    expect(result.success).toBe(false);
  });

  it('should reject completely empty object', () => {
    const result = InviteMemberSchema.safeParse({});

    expect(result.success).toBe(false);
  });
});

// ─── TenantWithRoleSchema ────────────────────────────────────────────────────

// ─── TenantSchema additional tests ───────────────────────────────────────────

// (TenantSchema additional validation from earlier)

// ─── CreateTenantSchema — subscription default ───────────────────────────────

describe('CreateTenantSchema — subscription', () => {
  it('should default subscription to free when not provided', () => {
    const result = CreateTenantSchema.safeParse({ name: 'Org', slug: 'new-org' });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.subscription).toBe('free');
    }
  });

  it('should accept subscription: free', () => {
    const result = CreateTenantSchema.safeParse({
      name: 'Org',
      slug: 'new-org',
      subscription: 'free',
    });

    expect(result.success).toBe(true);
  });

  it('should accept subscription: premium', () => {
    const result = CreateTenantSchema.safeParse({
      name: 'Org',
      slug: 'new-org',
      subscription: 'premium',
    });

    expect(result.success).toBe(true);
  });

  it('should reject invalid subscription tier', () => {
    const result = CreateTenantSchema.safeParse({
      name: 'Org',
      slug: 'new-org',
      subscription: 'enterprise',
    });

    expect(result.success).toBe(false);
  });
});

describe('TenantWithRoleSchema', () => {
  const validTenantWithRole = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Acme Corp',
    slug: 'acme-corp',
    subscription: 'free' as const,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    role: 'owner' as const,
  };

  it('should accept a valid tenant with role', () => {
    const result = TenantWithRoleSchema.safeParse(validTenantWithRole);

    expect(result.success).toBe(true);
  });

  it('should accept all tenant roles', () => {
    for (const role of ['owner', 'admin', 'member'] as const) {
      const result = TenantWithRoleSchema.safeParse({ ...validTenantWithRole, role });

      expect(result.success).toBe(true);
    }
  });

  it('should reject missing role', () => {
    const result = TenantWithRoleSchema.safeParse({
      id: validTenantWithRole.id,
      name: validTenantWithRole.name,
      slug: validTenantWithRole.slug,
      subscription: validTenantWithRole.subscription,
      createdAt: validTenantWithRole.createdAt,
      updatedAt: validTenantWithRole.updatedAt,
    });

    expect(result.success).toBe(false);
  });

  it('should reject invalid role', () => {
    const result = TenantWithRoleSchema.safeParse({ ...validTenantWithRole, role: 'superadmin' });

    expect(result.success).toBe(false);
  });
});
