import { Component, computed, effect, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmSidebarImports } from '@spartan-ng/helm/sidebar';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCalendar,
  lucideFolder,
  lucideHistory,
  lucideLayoutDashboard,
  lucidePanelLeft,
  lucideSettings,
  lucideUsers,
  lucideHome,
  lucideListTodo,
  lucideUserCog,
} from '@ng-icons/lucide';
import { TenantRole, ProjectRole } from '@task-board/shared';
import { AuthStore } from '@stores/auth-store';
import { TenantStore } from '@stores/tenant-store';
import { ProjectStore } from '@stores/project-store';
import { PreferencesStore } from '@stores/preferences-store';
import { TenantSwitcher } from '../tenant-switcher/tenant-switcher';

@Component({
  selector: 'ui-sidebar',
  imports: [RouterLink, RouterLinkActive, HlmSidebarImports, HlmButtonImports, NgIcon, TenantSwitcher, TranslocoPipe],
  providers: [
    provideIcons({
      lucidePanelLeft,
      lucideFolder,
      lucideCalendar,
      lucideSettings,
      lucideUsers,
      lucideLayoutDashboard,
      lucideHistory,
      lucideHome,
      lucideListTodo,
      lucideUserCog,
    }),
  ],
  templateUrl: './sidebar.html',
})
export class Sidebar {
  protected readonly tenantStore = inject(TenantStore);
  private readonly authStore = inject(AuthStore);
  private readonly projectStore = inject(ProjectStore);
  private readonly router = inject(Router);
  private readonly preferencesStore = inject(PreferencesStore);
  /** Reactive signal of the current URL for project context detection */
  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );
  /** Extract projectKey from the current URL (null when not in project context) */
  protected readonly currentProjectKey = computed(() => {
    const match = this.currentUrl().match(/\/projects\/([^/?#]+)/);

    return match?.[1] ?? null;
  });
  /** The default board ID for the current project (from user preferences) */
  protected readonly defaultBoardId = computed(() => {
    const projectKey = this.currentProjectKey();
    const projectId = this.projectStore.activeProject()?.id;

    return projectKey && projectId ? this.preferencesStore.getDefaultBoardId(projectId) : null;
  });
  /**
   * Whether the current user can manage project settings (PROJECT_ADMIN+).
   * Tenant OWNER/ADMIN bypass project role checks.
   */
  protected readonly canManageProject = computed(() => {
    const tenantRole = this.authStore.tenantRole();

    if (tenantRole === TenantRole.OWNER || tenantRole === TenantRole.ADMIN) return true;

    const projectRole = this.projectStore.projectRole();

    return projectRole === ProjectRole.PROJECT_ADMIN;
  });
  /** V2-10: workspace Settings/Members nav is admin-only — hidden from MEMBERs. */
  protected readonly isTenantAdmin = computed(() => {
    const tenantRole = this.authStore.tenantRole();

    return tenantRole === TenantRole.OWNER || tenantRole === TenantRole.ADMIN;
  });

  constructor() {
    // Load project board preferences whenever the project context changes.
    effect(() => {
      const projectId = this.projectStore.activeProject()?.id;

      if (projectId) {
        this.preferencesStore.loadProjectPreferences(projectId);
      }
    });
  }
}
