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
    it('allows owner to manage_tenant', () => {
      expect(service.can('owner', null, 'manage_tenant')).toBe(true);
    });

    it('denies admin from manage_tenant', () => {
      expect(service.can('admin', null, 'manage_tenant')).toBe(false);
    });

    it('allows owner to create_project', () => {
      expect(service.can('owner', null, 'create_project')).toBe(true);
    });

    it('allows admin to create_project', () => {
      expect(service.can('admin', null, 'create_project')).toBe(true);
    });

    it('denies member from create_project', () => {
      expect(service.can('member', null, 'create_project')).toBe(false);
    });

    it('allows admin to create_sprint', () => {
      expect(service.can('admin', null, 'create_sprint')).toBe(true);
    });

    it('denies member from create_sprint', () => {
      expect(service.can('member', null, 'create_sprint')).toBe(false);
    });

    it('allows admin to crud_boards', () => {
      expect(service.can('admin', null, 'crud_boards')).toBe(true);
    });

    it('denies member from crud_boards', () => {
      expect(service.can('member', null, 'crud_boards')).toBe(false);
    });
  });

  // ── Project-level actions with owner bypass ──────────────────────────────

  describe('project-level actions — owner bypass', () => {
    it('allows owner to create_task without project role', () => {
      expect(service.can('owner', null, 'create_task')).toBe(true);
    });

    it('allows owner to edit_any_task without project role', () => {
      expect(service.can('owner', null, 'edit_any_task')).toBe(true);
    });

    it('allows owner to manage_project_members without project role', () => {
      expect(service.can('owner', null, 'manage_project_members')).toBe(true);
    });
  });

  // ── Project-level actions with admin bypass ──────────────────────────────

  describe('project-level actions — admin bypass', () => {
    it('allows tenant admin to create_task without project role', () => {
      expect(service.can('admin', null, 'create_task')).toBe(true);
    });

    it('allows tenant admin to edit_any_task without project role', () => {
      expect(service.can('admin', null, 'edit_any_task')).toBe(true);
    });
  });

  // ── Project-level actions with project roles ─────────────────────────────

  describe('project-level actions — project roles', () => {
    it('allows project admin to create_task', () => {
      expect(service.can('member', 'admin', 'create_task')).toBe(true);
    });

    it('allows project developer to create_task', () => {
      expect(service.can('member', 'developer', 'create_task')).toBe(true);
    });

    it('denies project viewer from create_task', () => {
      expect(service.can('member', 'viewer', 'create_task')).toBe(false);
    });

    it('allows project developer to edit_own_task', () => {
      expect(service.can('member', 'developer', 'edit_own_task')).toBe(true);
    });

    it('denies project viewer from edit_own_task', () => {
      expect(service.can('member', 'viewer', 'edit_own_task')).toBe(false);
    });

    it('allows project admin to edit_any_task', () => {
      expect(service.can('member', 'admin', 'edit_any_task')).toBe(true);
    });

    it('denies project developer from edit_any_task', () => {
      expect(service.can('member', 'developer', 'edit_any_task')).toBe(false);
    });

    it('allows project developer to move_task', () => {
      expect(service.can('member', 'developer', 'move_task')).toBe(true);
    });

    it('allows project developer to assign_task', () => {
      expect(service.can('member', 'developer', 'assign_task')).toBe(true);
    });

    it('allows viewer to view_project', () => {
      expect(service.can('member', 'viewer', 'view_project')).toBe(true);
    });

    it('denies viewer from manage_project_members', () => {
      expect(service.can('member', 'viewer', 'manage_project_members')).toBe(false);
    });

    it('allows project admin to manage_project_members', () => {
      expect(service.can('member', 'admin', 'manage_project_members')).toBe(true);
    });
  });

  // ── No project membership ────────────────────────────────────────────────

  describe('no project membership', () => {
    it('denies member without project role from project-level actions', () => {
      expect(service.can('member', null, 'create_task')).toBe(false);
      expect(service.can('member', null, 'view_project')).toBe(false);
      expect(service.can('member', null, 'move_task')).toBe(false);
    });

    it('denies member with undefined project role', () => {
      expect(service.can('member', undefined, 'create_task')).toBe(false);
    });
  });

  // ── Viewer cannot write ──────────────────────────────────────────────────

  describe('viewer cannot write', () => {
    it('denies viewer from all write actions', () => {
      const writeActions = [
        'create_task',
        'edit_own_task',
        'move_task',
        'assign_task',
        'manage_project_members',
      ] as const;

      for (const action of writeActions) {
        expect(service.can('member', 'viewer', action)).toBe(false);
      }
    });
  });
});
