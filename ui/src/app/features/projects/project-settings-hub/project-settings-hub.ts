import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideSettings,
  lucideTag,
  lucideCircleDot,
  lucideLayers,
  lucideLayoutDashboard,
  lucideTriangleAlert,
  lucideUsers,
} from '@ng-icons/lucide';
import { AuthStore } from '@stores/auth-store';
import { ProjectStore } from '@stores/project-store';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { canManageProject } from '@app/shared/utils/role-utils';

interface SettingsLink {
  /** Route segment under `…/settings` (or absolute sibling for members) */
  segment: string;
  icon: string;
  labelKey: string;
  descriptionKey: string;
  destructive?: boolean;
}

/**
 * Project settings hub index (spec S15, DEC-035).
 * Lists all settings areas; admin-only entries are hidden for Editor/Viewer.
 */
@Component({
  selector: 'ui-project-settings-hub',
  imports: [RouterLink, TranslocoPipe, NgIcon, HlmCardImports],
  providers: [
    provideIcons({
      lucideSettings,
      lucideTag,
      lucideCircleDot,
      lucideLayers,
      lucideLayoutDashboard,
      lucideTriangleAlert,
      lucideUsers,
    }),
  ],
  templateUrl: './project-settings-hub.html',
})
export class ProjectSettingsHub {
  private readonly authStore = inject(AuthStore);
  private readonly projectStore = inject(ProjectStore);
  /** Bound via withComponentInputBinding() — receives project key from route */
  readonly projectKey = input.required<string>();
  /**
   * Whether the current user can manage project settings (PROJECT_ADMIN+).
   * Tenant OWNER/ADMIN bypass project role checks.
   */
  protected readonly isAdmin = computed(() =>
    canManageProject(this.projectStore.projectRole(), this.authStore.tenantRole()),
  );
  protected readonly adminLinks = computed<SettingsLink[]>(() => [
    {
      segment: 'general',
      icon: 'lucideSettings',
      labelKey: 'projectSettings.general',
      descriptionKey: 'projectSettings.generalDesc',
    },
    {
      segment: 'task-types',
      icon: 'lucideLayers',
      labelKey: 'projectSettings.taskTypes',
      descriptionKey: 'projectSettings.taskTypesDesc',
    },
    {
      segment: 'statuses',
      icon: 'lucideCircleDot',
      labelKey: 'projectSettings.statuses',
      descriptionKey: 'projectSettings.statusesDesc',
    },
    {
      segment: 'labels',
      icon: 'lucideTag',
      labelKey: 'projectSettings.labels',
      descriptionKey: 'projectSettings.labelsDesc',
    },
    {
      segment: 'boards',
      icon: 'lucideLayoutDashboard',
      labelKey: 'projectSettings.boards',
      descriptionKey: 'projectSettings.boardsDesc',
    },
    {
      segment: 'danger-zone',
      icon: 'lucideTriangleAlert',
      labelKey: 'projectSettings.dangerZone',
      descriptionKey: 'projectSettings.dangerZoneDesc',
      destructive: true,
    },
  ]);
}
