import { Service, signal, computed, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ProjectClient } from '@services/project-client';
import type { Project, ProjectMember } from '@task-board/shared';
import type { ProjectRole } from '@task-board/shared';

/**
 * Signal-based project context store.
 * Tracks the currently active project, the user's role within it,
 * and related project metadata (members, etc.).
 */
@Service()
export class ProjectStore {
  private readonly projectClient = inject(ProjectClient);
  readonly activeProject = signal<Project | null>(null);
  readonly projectRole = signal<ProjectRole | null>(null);
  readonly members = signal<ProjectMember[]>([]);
  readonly loading = signal(false);
  /** Whether a project is currently loaded */
  readonly hasProject = computed(() => this.activeProject() !== null);

  /** Load the project context by ID (project + user's project role). */
  async loadProject(projectId: string): Promise<Project> {
    this.loading.set(true);
    try {
      const project = await firstValueFrom(this.projectClient.getById(projectId));

      this.activeProject.set(project);
      // Load members to resolve role (if available)
      this.loadMembers(project.id);
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
      // Load members to resolve role (if available)
      this.loadMembers(project.id);
      return project;
    } finally {
      this.loading.set(false);
    }
  }

  /** Load project members and resolve the current user's role */
  async loadMembers(projectId: string): Promise<void> {
    try {
      const members = await firstValueFrom(this.projectClient.listMembers(projectId));

      this.members.set(members);
    } catch {
      // Members are non-critical for project context
    }
  }

  /** Set the user's project-level role */
  setProjectRole(role: ProjectRole | null): void {
    this.projectRole.set(role);
  }

  /** Clear project context (e.g. when switching projects) */
  clearProject(): void {
    this.activeProject.set(null);
    this.projectRole.set(null);
    this.members.set([]);
  }
}
