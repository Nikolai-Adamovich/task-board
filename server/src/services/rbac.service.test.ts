import { describe, it, expect, beforeEach } from 'vitest';
import { RbacService } from './rbac.service.js';

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('RbacService', () => {
  let service: RbacService;

  beforeEach(() => {
    service = new RbacService();
  });

  // ── Tenant-level actions ─────────────────────────────────────────────────

  describe('tenant-level actions', () => {
    it('allows OWNER to manage_tenant', () => {
      expect(service.can('OWNER', null, 'manage_tenant')).toBe(true);
    });

    it('allows ADMIN to manage_tenant', () => {
      expect(service.can('ADMIN', null, 'manage_tenant')).toBe(true);
    });

    it('denies MEMBER from manage_tenant', () => {
      expect(service.can('MEMBER', null, 'manage_tenant')).toBe(false);
    });

    it('allows OWNER to create_project', () => {
      expect(service.can('OWNER', null, 'create_project')).toBe(true);
    });

    it('allows ADMIN to create_project', () => {
      expect(service.can('ADMIN', null, 'create_project')).toBe(true);
    });

    it('denies MEMBER from create_project', () => {
      expect(service.can('MEMBER', null, 'create_project')).toBe(false);
    });
  });

  // ── Project-level actions with owner bypass ──────────────────────────────

  describe('project-level actions — owner bypass', () => {
    it('allows OWNER to create_task without project role', () => {
      expect(service.can('OWNER', null, 'create_task')).toBe(true);
    });

    it('allows OWNER to delete_task without project role', () => {
      expect(service.can('OWNER', null, 'delete_task')).toBe(true);
    });

    it('allows OWNER to manage_project_members without project role', () => {
      expect(service.can('OWNER', null, 'manage_project_members')).toBe(true);
    });

    it('allows OWNER to view_audit_events without project role', () => {
      expect(service.can('OWNER', null, 'view_audit_events')).toBe(true);
    });
  });

  // ── Project-level actions with admin bypass ──────────────────────────────

  describe('project-level actions — admin bypass', () => {
    it('allows ADMIN to create_task without project role', () => {
      expect(service.can('ADMIN', null, 'create_task')).toBe(true);
    });

    it('allows ADMIN to delete_task without project role', () => {
      expect(service.can('ADMIN', null, 'delete_task')).toBe(true);
    });

    it('allows ADMIN to manage_project without project role', () => {
      expect(service.can('ADMIN', null, 'manage_project')).toBe(true);
    });
  });

  // ── Project-level actions with project roles ─────────────────────────────

  describe('project-level actions — project roles', () => {
    it('allows PROJECT_ADMIN to create_task', () => {
      expect(service.can('MEMBER', 'PROJECT_ADMIN', 'create_task')).toBe(true);
    });

    it('allows EDITOR to create_task', () => {
      expect(service.can('MEMBER', 'EDITOR', 'create_task')).toBe(true);
    });

    it('denies VIEWER from create_task', () => {
      expect(service.can('MEMBER', 'VIEWER', 'create_task')).toBe(false);
    });

    it('allows EDITOR to edit_task', () => {
      expect(service.can('MEMBER', 'EDITOR', 'edit_task')).toBe(true);
    });

    it('denies VIEWER from edit_task', () => {
      expect(service.can('MEMBER', 'VIEWER', 'edit_task')).toBe(false);
    });

    it('allows PROJECT_ADMIN to delete_task', () => {
      expect(service.can('MEMBER', 'PROJECT_ADMIN', 'delete_task')).toBe(true);
    });

    it('denies EDITOR from delete_task', () => {
      expect(service.can('MEMBER', 'EDITOR', 'delete_task')).toBe(false);
    });

    it('allows VIEWER to view_task', () => {
      expect(service.can('MEMBER', 'VIEWER', 'view_task')).toBe(true);
    });

    it('allows EDITOR to view_task', () => {
      expect(service.can('MEMBER', 'EDITOR', 'view_task')).toBe(true);
    });

    it('allows PROJECT_ADMIN to manage_project_members', () => {
      expect(service.can('MEMBER', 'PROJECT_ADMIN', 'manage_project_members')).toBe(true);
    });

    it('denies EDITOR from manage_project_members', () => {
      expect(service.can('MEMBER', 'EDITOR', 'manage_project_members')).toBe(false);
    });

    it('denies VIEWER from manage_project_members', () => {
      expect(service.can('MEMBER', 'VIEWER', 'manage_project_members')).toBe(false);
    });

    it('allows PROJECT_ADMIN to manage_project', () => {
      expect(service.can('MEMBER', 'PROJECT_ADMIN', 'manage_project')).toBe(true);
    });

    it('denies EDITOR from manage_project', () => {
      expect(service.can('MEMBER', 'EDITOR', 'manage_project')).toBe(false);
    });

    it('allows PROJECT_ADMIN to create_sprint', () => {
      expect(service.can('MEMBER', 'PROJECT_ADMIN', 'create_sprint')).toBe(true);
    });

    it('denies EDITOR from create_sprint', () => {
      expect(service.can('MEMBER', 'EDITOR', 'create_sprint')).toBe(false);
    });

    it('allows PROJECT_ADMIN to manage_boards', () => {
      expect(service.can('MEMBER', 'PROJECT_ADMIN', 'manage_boards')).toBe(true);
    });

    it('denies EDITOR from manage_boards', () => {
      expect(service.can('MEMBER', 'EDITOR', 'manage_boards')).toBe(false);
    });

    it('allows EDITOR to create_comment', () => {
      expect(service.can('MEMBER', 'EDITOR', 'create_comment')).toBe(true);
    });

    it('denies VIEWER from create_comment', () => {
      expect(service.can('MEMBER', 'VIEWER', 'create_comment')).toBe(false);
    });

    it('allows VIEWER to view_comment', () => {
      expect(service.can('MEMBER', 'VIEWER', 'view_comment')).toBe(true);
    });

    it('allows EDITOR to manage_task_relationships', () => {
      expect(service.can('MEMBER', 'EDITOR', 'manage_task_relationships')).toBe(true);
    });

    it('denies VIEWER from manage_task_relationships', () => {
      expect(service.can('MEMBER', 'VIEWER', 'manage_task_relationships')).toBe(false);
    });

    it('allows VIEWER to manage_filters', () => {
      expect(service.can('MEMBER', 'VIEWER', 'manage_filters')).toBe(true);
    });

    it('allows PROJECT_ADMIN to view_audit_events', () => {
      expect(service.can('MEMBER', 'PROJECT_ADMIN', 'view_audit_events')).toBe(true);
    });

    it('denies EDITOR from view_audit_events', () => {
      expect(service.can('MEMBER', 'EDITOR', 'view_audit_events')).toBe(false);
    });

    it('denies VIEWER from view_audit_events', () => {
      expect(service.can('MEMBER', 'VIEWER', 'view_audit_events')).toBe(false);
    });
  });

  // ── No project membership ────────────────────────────────────────────────

  describe('no project membership', () => {
    it('denies MEMBER without project role from project-level actions', () => {
      expect(service.can('MEMBER', null, 'create_task')).toBe(false);
      expect(service.can('MEMBER', null, 'view_task')).toBe(false);
      expect(service.can('MEMBER', null, 'manage_project')).toBe(false);
    });

    it('denies MEMBER with undefined project role', () => {
      expect(service.can('MEMBER', undefined, 'create_task')).toBe(false);
    });
  });

  // ── Viewer cannot write ──────────────────────────────────────────────────

  describe('viewer cannot write', () => {
    it('denies VIEWER from all write actions', () => {
      const writeActions = [
        'create_task',
        'edit_task',
        'delete_task',
        'manage_project',
        'manage_project_members',
        'create_sprint',
        'change_sprint_status',
        'edit_project_config',
        'manage_statuses',
        'manage_boards',
        'create_comment',
        'edit_comment',
        'delete_comment',
        'view_audit_events',
      ] as const;

      for (const action of writeActions) {
        expect(service.can('MEMBER', 'VIEWER', action)).toBe(false);
      }
    });
  });

  // ── getEffectiveRole ─────────────────────────────────────────────────────

  describe('getEffectiveRole', () => {
    it('returns OWNER for tenant owner', () => {
      expect(service.getEffectiveRole('OWNER')).toBe('OWNER');
    });

    it('returns ADMIN for tenant admin', () => {
      expect(service.getEffectiveRole('ADMIN')).toBe('ADMIN');
    });

    it('returns project role for tenant member', () => {
      expect(service.getEffectiveRole('MEMBER', 'PROJECT_ADMIN')).toBe('PROJECT_ADMIN');
    });

    it('returns MEMBER when tenant member has no project role', () => {
      expect(service.getEffectiveRole('MEMBER')).toBe('MEMBER');
    });

    it('returns MEMBER when tenant member has null project role', () => {
      expect(service.getEffectiveRole('MEMBER', null)).toBe('MEMBER');
    });
  });
});
