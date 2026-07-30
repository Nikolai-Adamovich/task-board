/**
 * Tests for shared constants: roles, columns, HTTP methods, API paths.
 *
 * Constants are the single source of truth for enum-like values used
 * across the monorepo. These tests verify correct values and exports.
 */
import { describe, it, expect } from 'vitest';
import { TenantRole, ProjectRole, TaskPriority, SprintStatus, MemberStatus, SubscriptionTier } from './roles.js';
import { DefaultColumnNames } from './columns.js';
import { HttpMethod } from './http.js';
import { API_BASE_PATH, ApiPaths } from './paths.js';

// ─── TenantRole ──────────────────────────────────────────────────────────────

describe('TenantRole', () => {
  it('should have exactly three tenant roles', () => {
    const values = Object.values(TenantRole);

    expect(values).toHaveLength(3);
  });

  it('should define owner role', () => {
    expect(TenantRole.Owner).toBe('owner');
  });

  it('should define admin role', () => {
    expect(TenantRole.Admin).toBe('admin');
  });

  it('should define member role', () => {
    expect(TenantRole.Member).toBe('member');
  });

  it('should have all expected role values', () => {
    expect(Object.values(TenantRole).sort()).toEqual(['admin', 'member', 'owner']);
  });
});

// ─── ProjectRole ─────────────────────────────────────────────────────────────

describe('ProjectRole', () => {
  it('should have exactly three project roles', () => {
    const values = Object.values(ProjectRole);

    expect(values).toHaveLength(3);
  });

  it('should define admin role', () => {
    expect(ProjectRole.Admin).toBe('admin');
  });

  it('should define developer role', () => {
    expect(ProjectRole.Developer).toBe('developer');
  });

  it('should define viewer role', () => {
    expect(ProjectRole.Viewer).toBe('viewer');
  });

  it('should have all expected role values', () => {
    expect(Object.values(ProjectRole).sort()).toEqual(['admin', 'developer', 'viewer']);
  });
});

// ─── TaskPriority ────────────────────────────────────────────────────────────

describe('TaskPriority', () => {
  it('should have exactly four priority levels', () => {
    const values = Object.values(TaskPriority);

    expect(values).toHaveLength(4);
  });

  it('should define low priority', () => {
    expect(TaskPriority.Low).toBe('low');
  });

  it('should define medium priority', () => {
    expect(TaskPriority.Medium).toBe('medium');
  });

  it('should define high priority', () => {
    expect(TaskPriority.High).toBe('high');
  });

  it('should define critical priority', () => {
    expect(TaskPriority.Critical).toBe('critical');
  });

  it('should have all expected priority values', () => {
    expect(Object.values(TaskPriority).sort()).toEqual(['critical', 'high', 'low', 'medium']);
  });
});

// ─── SprintStatus ────────────────────────────────────────────────────────────

describe('SprintStatus', () => {
  it('should have exactly three sprint statuses', () => {
    const values = Object.values(SprintStatus);

    expect(values).toHaveLength(3);
  });

  it('should define planned status', () => {
    expect(SprintStatus.Planned).toBe('planned');
  });

  it('should define active status', () => {
    expect(SprintStatus.Active).toBe('active');
  });

  it('should define completed status', () => {
    expect(SprintStatus.Completed).toBe('completed');
  });

  it('should have all expected status values', () => {
    expect(Object.values(SprintStatus).sort()).toEqual(['active', 'completed', 'planned']);
  });
});

// ─── MemberStatus ────────────────────────────────────────────────────────────

describe('MemberStatus', () => {
  it('should have exactly four member statuses', () => {
    const values = Object.values(MemberStatus);

    expect(values).toHaveLength(4);
  });

  it('should define active status', () => {
    expect(MemberStatus.Active).toBe('active');
  });

  it('should define pending status', () => {
    expect(MemberStatus.Pending).toBe('pending');
  });

  it('should define declined status', () => {
    expect(MemberStatus.Declined).toBe('declined');
  });

  it('should define access_revoked status', () => {
    expect(MemberStatus.AccessRevoked).toBe('access_revoked');
  });

  it('should have all expected status values', () => {
    expect(Object.values(MemberStatus).sort()).toEqual(['access_revoked', 'active', 'declined', 'pending']);
  });
});

// ─── SubscriptionTier ────────────────────────────────────────────────────────

describe('SubscriptionTier', () => {
  it('should have exactly two subscription tiers', () => {
    const values = Object.values(SubscriptionTier);

    expect(values).toHaveLength(2);
  });

  it('should define free tier', () => {
    expect(SubscriptionTier.Free).toBe('free');
  });

  it('should define premium tier', () => {
    expect(SubscriptionTier.Premium).toBe('premium');
  });

  it('should have all expected tier values', () => {
    expect(Object.values(SubscriptionTier).sort()).toEqual(['free', 'premium']);
  });
});

// ─── DefaultColumnNames ──────────────────────────────────────────────────────

describe('DefaultColumnNames', () => {
  it('should have exactly five default columns', () => {
    expect(DefaultColumnNames).toHaveLength(5);
  });

  it('should be ["Backlog", "To Do", "In Progress", "Review", "Done"]', () => {
    expect([...DefaultColumnNames]).toEqual(['Backlog', 'To Do', 'In Progress', 'Review', 'Done']);
  });

  it('should have Backlog as the first column', () => {
    expect(DefaultColumnNames[0]).toBe('Backlog');
  });

  it('should have Done as the last column', () => {
    expect(DefaultColumnNames[4]).toBe('Done');
  });
});

// ─── HttpMethod ──────────────────────────────────────────────────────────────

describe('HttpMethod', () => {
  it('should have exactly four HTTP methods', () => {
    expect(HttpMethod).toHaveLength(4);
  });

  it('should contain GET, POST, PATCH, DELETE', () => {
    expect([...HttpMethod].sort()).toEqual(['DELETE', 'GET', 'PATCH', 'POST']);
  });

  it('should include GET', () => {
    expect(HttpMethod).toContain('GET');
  });

  it('should include POST', () => {
    expect(HttpMethod).toContain('POST');
  });

  it('should include PATCH', () => {
    expect(HttpMethod).toContain('PATCH');
  });

  it('should include DELETE', () => {
    expect(HttpMethod).toContain('DELETE');
  });
});

// ─── API_BASE_PATH ───────────────────────────────────────────────────────────

describe('API_BASE_PATH', () => {
  it('should be /api/v1', () => {
    expect(API_BASE_PATH).toBe('/api/v1');
  });
});

// ─── ApiPaths ────────────────────────────────────────────────────────────────

describe('ApiPaths', () => {
  it('should define auth paths', () => {
    expect(ApiPaths.auth.register).toBe('/auth/register');
    expect(ApiPaths.auth.login).toBe('/auth/login');
    expect(ApiPaths.auth.me).toBe('/auth/me');
  });

  it('should define tenant paths', () => {
    expect(ApiPaths.tenants.base).toBe('/tenants');
    expect(ApiPaths.tenants.byId).toBe('/tenants/:id');
    expect(ApiPaths.tenants.members).toBe('/tenants/:id/members');
    expect(ApiPaths.tenants.memberById).toBe('/tenants/:id/members/:userId');
  });

  it('should define project paths', () => {
    expect(ApiPaths.projects.base).toBe('/projects');
    expect(ApiPaths.projects.byId).toBe('/projects/:id');
    expect(ApiPaths.projects.members).toBe('/projects/:id/members');
    expect(ApiPaths.projects.memberById).toBe('/projects/:id/members/:userId');
  });

  it('should define board paths', () => {
    expect(ApiPaths.boards.base).toBe('/boards');
    expect(ApiPaths.boards.byId).toBe('/boards/:id');
    expect(ApiPaths.boards.columns).toBe('/boards/:id/columns');
    expect(ApiPaths.boards.columnById).toBe('/boards/:id/columns/:columnId');
  });

  it('should define task paths', () => {
    expect(ApiPaths.tasks.base).toBe('/tasks');
    expect(ApiPaths.tasks.byId).toBe('/tasks/:id');
    expect(ApiPaths.tasks.move).toBe('/tasks/:id/move');
    expect(ApiPaths.tasks.assign).toBe('/tasks/:id/assign');
  });

  it('should define sprint paths', () => {
    expect(ApiPaths.sprints.base).toBe('/sprints');
    expect(ApiPaths.sprints.byId).toBe('/sprints/:id');
  });

  it('should define user paths', () => {
    expect(ApiPaths.users.base).toBe('/users');
    expect(ApiPaths.users.byId).toBe('/users/:id');
  });
});
