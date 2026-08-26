import { Component, computed, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ProjectStore } from '@stores/project-store';
import { TenantStore } from '@stores/tenant-store';
import { SprintBacklog } from '../sprint-backlog/sprint-backlog';

/**
 * Standalone backlog page (`…/sprints/backlog`, DEC-039): lists all tasks of
 * the active project that are not assigned to any sprint.
 */
@Component({
  selector: 'ui-backlog-view',
  imports: [TranslocoPipe, SprintBacklog],
  templateUrl: './backlog-view.html',
})
export class BacklogView {
  private readonly projectStore = inject(ProjectStore);
  private readonly tenantStore = inject(TenantStore);
  protected readonly projectId = computed(() => this.projectStore.activeProject()?.id ?? '');
  /** Canonical task URLs need the project key (DEC-032) */
  protected readonly projectKey = computed(() => this.projectStore.activeProject()?.key ?? '');
  protected readonly tenantSlug = computed(() => this.tenantStore.activeTenant()?.slug ?? '');
}
