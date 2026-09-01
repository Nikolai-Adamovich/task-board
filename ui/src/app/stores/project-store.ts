import { Service, signal, computed, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ProjectClient } from '@services/project-client';
import { AuthStore } from '@stores/auth-store';
import { ProjectRole, TenantRole } from '@task-board/shared';
import type { Project, ProjectMember } from '@task-board/shared';

/**
 * Signal-based project context store.
 * Tracks the currently active project, the user's role within it,
 * and related project metadata (members, etc.).
 */
@Service()
export class ProjectStore {
  private readonly projectClient = inject(ProjectClient);
  private readonly authStore = inject(AuthStore);
  readonly activeProject = signal<Project | null>(null);
  readonly members = signal<ProjectMember[]>([]);
  readonly loading = signal(false);
  /** Whether a project is currently loaded */
  readonly hasProject = computed(() => this.activeProject() !== null);
  /**
   * Effective project role of the current user, derived reactively.
   *
   * Tenant OWNER/ADMIN bypass project membership (mirrors the server's RBAC
   * bypass formerly applied by projectGuard). For tenant MEMBERs the role
   * resolves from the members list — which loads in the background (see
   * loadProjectByKey), so this computed flips from null to the real role when
   * members arrive. All consumers read it through computeds, so the late
   * resolution is safe.
   */
  readonly projectRole = computed<ProjectRole | null>(() => {
    if (!this.activeProject()) return null;

    const tenantRole = this.authStore.tenantRole();

    if (tenantRole === TenantRole.OWNER || tenantRole === TenantRole.ADMIN) {
      return ProjectRole.PROJECT_ADMIN;
    }

    const userId = this.authStore.currentUser()?.id;

    if (!userId) return null;

    return this.members().find((member) => member.userId === userId)?.role ?? null;
  });

  /** Load the project context by ID (project + user's project role). */
  async loadProject(projectId: string): Promise<Project> {
    this.loading.set(true);
    try {
      const project = await firstValueFrom(this.projectClient.getById(projectId));

      this.activeProject.set(project);
      // Load members to resolve role (if available) — awaited so consumers
      // (e.g. projectGuard) can resolve the user's project role synchronously.
      await this.loadMembers(project.id);
      return project;
    } finally {
      this.loading.set(false);
    }
  }

  /** Load the project context by key within a tenant. */
  async loadProjectByKey(tenantId: string, key: string): Promise<Project> {
    this.loading.set(true);
    try {
      const project = await firstValueFrom(this.projectClient.getByKey(tenantId, key));

      this.activeProject.set(project);
      // Members are NOT awaited: the navigation decision (projectGuard) never
      // depends on them, so they load in the background and the reactive
      // `projectRole` computed updates when they arrive. This removes one
      // sequential HTTP round-trip from the deep-link critical path.
      void this.loadMembers(project.id);
      return project;
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Load project members in the background (non-critical for navigation).
   * Errors are swallowed — consumers degrade gracefully without members.
   */
  async loadMembers(projectId: string): Promise<void> {
    try {
      const members = await firstValueFrom(this.projectClient.listMembers(projectId));

      // Stale-response guard: the user may have navigated to another project
      // while this request was in flight — never overwrite the new context.
      if (this.activeProject()?.id !== projectId) return;

      this.members.set(members);
    } catch {
      // Members are non-critical for project context
    }
  }

  /** Clear project context (e.g. when switching projects) */
  clearProject(): void {
    this.activeProject.set(null);
    this.members.set([]);
  }
}
