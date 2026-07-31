import { TenantRole, ProjectRole } from '@task-board/shared';

// ─── Permission Actions ──────────────────────────────────────────────────────

export type PermissionAction =
  | 'manage_tenant'
  | 'create_project'
  | 'delete_project'
  | 'crud_boards'
  | 'crud_columns'
  | 'create_task'
  | 'edit_own_task'
  | 'edit_any_task'
  | 'move_task'
  | 'assign_task'
  | 'create_sprint'
  | 'manage_sprint'
  | 'view_project'
  | 'manage_project_members';

// ─── Permission Matrix ───────────────────────────────────────────────────────

/**
 * Permission matrix for tenant-only actions.
 * Maps action → allowed tenant roles.
 */
const tenantPermissions: Record<string, TenantRole[]> = {
  manage_tenant: [TenantRole.Owner],
  create_project: [TenantRole.Owner, TenantRole.Admin],
  delete_project: [TenantRole.Owner, TenantRole.Admin],
  create_sprint: [TenantRole.Owner, TenantRole.Admin],
  manage_sprint: [TenantRole.Owner, TenantRole.Admin],
  crud_boards: [TenantRole.Owner, TenantRole.Admin],
  crud_columns: [TenantRole.Owner, TenantRole.Admin],
};
/**
 * Permission matrix for project-level actions.
 * Maps action → allowed project roles.
 * Tenant owners and tenant admins bypass project-level restrictions.
 */
const projectPermissions: Record<string, ProjectRole[]> = {
  view_project: [ProjectRole.Admin, ProjectRole.Developer, ProjectRole.Viewer],
  manage_project_members: [ProjectRole.Admin],
  create_task: [ProjectRole.Admin, ProjectRole.Developer],
  edit_own_task: [ProjectRole.Admin, ProjectRole.Developer],
  edit_any_task: [ProjectRole.Admin],
  move_task: [ProjectRole.Admin, ProjectRole.Developer],
  assign_task: [ProjectRole.Admin, ProjectRole.Developer],
};

// ─── RBAC Service ────────────────────────────────────────────────────────────

/**
 * Evaluates permission based on tenant role and optional project role.
 *
 * Rules:
 * - Tenant owners bypass all project-level restrictions.
 * - Viewers cannot write (any write action is denied at project level).
 * - Members can only act on projects where they are members.
 */
export class RbacService {
  /**
   * Check if the given role combination permits the specified action.
   *
   * @param tenantRole - The user's role within the tenant
   * @param projectRole - The user's role within the project (optional; null if not a project member)
   * @param action - The permission action to check
   * @returns true if the action is permitted, false otherwise
   */
  can(
    tenantRole: TenantRole | string,
    projectRole: ProjectRole | string | null | undefined,
    action: PermissionAction,
  ): boolean {
    // ── Tenant-level-only actions ──────────────────────────────────────────
    if (action in tenantPermissions) {
      return this.checkTenantAction(tenantRole, action);
    }

    // ── Project-level actions ──────────────────────────────────────────────
    // Tenant owners bypass all project-level restrictions
    if (tenantRole === TenantRole.Owner) {
      return true;
    }

    // Tenant admins bypass project-level restrictions
    if (tenantRole === TenantRole.Admin) {
      return true;
    }

    // No project membership → no access to project-level actions
    if (!projectRole) {
      return false;
    }

    // Check project-level permission
    return this.checkProjectAction(projectRole, action);
  }

  /**
   * Check if a tenant-level role is allowed for a tenant-level action.
   */
  private checkTenantAction(tenantRole: string, action: string): boolean {
    const allowedRoles = tenantPermissions[action];

    if (!allowedRoles) {
      return false;
    }

    return allowedRoles.includes(tenantRole as TenantRole);
  }

  /**
   * Check if a project-level role is allowed for a project-level action.
   */
  private checkProjectAction(projectRole: string, action: string): boolean {
    const allowedRoles = projectPermissions[action];

    if (!allowedRoles) {
      return false;
    }

    return allowedRoles.includes(projectRole as ProjectRole);
  }
}
