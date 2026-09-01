import { Component, computed, inject, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArchive,
  lucideCalendar,
  lucideCircleDot,
  lucideExternalLink,
  lucideSettings,
  lucideTrash2,
  lucideUsers,
} from '@ng-icons/lucide';
import { rxResource } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { ProjectClient } from '@services/project-client';
import { SprintClient } from '@services/sprint-client';
import { StatusClient } from '@services/status-client';
import { TaskClient } from '@services/task-client';
import { AuthStore } from '@stores/auth-store';
import { ProjectStore } from '@stores/project-store';
import { PreferencesStore } from '@stores/preferences-store';
import { TenantStore } from '@stores/tenant-store';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmEmptyImports } from '@spartan-ng/helm/empty';
import { HlmAlertImports } from '@spartan-ng/helm/alert';
import { SprintStatus, ProjectStatus } from '@task-board/shared';
import { statusBadgeVariant } from '@app/constants/priority';
import { canManageProject } from '@app/shared/utils/role-utils';
import { getErrorMessage } from '@app/shared/utils/error-utils';
import type { Project, Sprint, Status, Task } from '@task-board/shared';

/** Per-status task count row */
interface StatusCount {
  status: Status;
  total: number;
}

/**
 * Project overview landing page (spec S9, DEC-034).
 *
 * Widgets: header (name/key/status/description), task summary by status,
 * active-sprint block, recent tasks, members preview, board shortcuts.
 * Lifecycle actions (archive/delete) live in the settings hub danger zone (DEC-035).
 */
@Component({
  selector: 'ui-project-detail',
  imports: [
    RouterLink,
    DatePipe,
    TranslocoPipe,
    NgIcon,
    HlmButtonImports,
    HlmSpinnerImports,
    HlmBadgeImports,
    HlmCardImports,
    HlmEmptyImports,
    HlmAlertImports,
  ],
  providers: [
    provideIcons({
      lucideArchive,
      lucideCalendar,
      lucideCircleDot,
      lucideExternalLink,
      lucideSettings,
      lucideTrash2,
      lucideUsers,
    }),
  ],
  templateUrl: './project-detail.html',
})
export class ProjectDetail {
  /** Shared badge-class helper (see constants/priority.ts) */
  protected readonly statusBadgeVariant = statusBadgeVariant;
  private readonly projectClient = inject(ProjectClient);
  private readonly sprintClient = inject(SprintClient);
  private readonly statusClient = inject(StatusClient);
  private readonly taskClient = inject(TaskClient);
  private readonly authStore = inject(AuthStore);
  private readonly projectStore = inject(ProjectStore);
  private readonly preferencesStore = inject(PreferencesStore);
  /** R3-P8: DatePipe token derived from the user's date format preference */
  protected readonly dateFmt = this.preferencesStore.datePipeFormat;
  /** P12 (item 28): active language passed as the DatePipe locale for localized month names */
  protected readonly lang = this.preferencesStore.language;
  private readonly tenantStore = inject(TenantStore);
  /** Bound via withComponentInputBinding() — receives project key from route */
  readonly projectKey = input.required<string>();
  /** Resolved project UUID from the store */
  protected readonly projectId = computed(() => this.projectStore.activeProject()?.id ?? '');
  /** Current tenant slug for building links (DEC-032) */
  protected readonly tenantSlug = computed(() => this.tenantStore.activeTenant()?.slug ?? '');
  protected readonly ProjectStatus = ProjectStatus;
  protected readonly SprintStatus = SprintStatus;
  private readonly projectResource = rxResource({
    params: () => ({ projectId: this.projectId() }),
    stream: ({ params }) => this.projectClient.getById(params.projectId),
  });
  protected readonly project = computed<Project | null>(() =>
    this.projectResource.hasValue() ? this.projectResource.value() : null,
  );
  // Single-board model (doc 102): no board-list fetch — the project has one board.
  private readonly sprintsResource = rxResource({
    params: () => ({ projectId: this.projectId() }),
    stream: ({ params }) => this.sprintClient.list(params.projectId),
    defaultValue: [] as Sprint[],
  });
  protected readonly activeSprint = computed<Sprint | null>(() => {
    const sprints = this.sprintsResource.hasValue() ? this.sprintsResource.value() : [];

    return sprints.find((s) => s.status === SprintStatus.ACTIVE) ?? null;
  });
  private readonly statusesResource = rxResource({
    params: () => ({ projectId: this.projectId() }),
    stream: ({ params }) => this.statusClient.list(params.projectId),
    defaultValue: [] as Status[],
  });
  /**
   * S-05: one status-summary request (server-side $group aggregation) instead
   * of one list request per status; counts are joined with the statuses in code.
   */
  private readonly statusSummaryResource = rxResource({
    params: () => ({ projectId: this.projectId() }),
    stream: ({ params }) => this.taskClient.statusSummary(params.projectId),
    defaultValue: [] as { statusId: string; count: number }[],
  });
  protected readonly statusCounts = computed<StatusCount[]>(() => {
    if (!this.statusSummaryResource.hasValue() || !this.statusesResource.hasValue()) return [];

    const counts = new Map(this.statusSummaryResource.value().map((row) => [row.statusId, row.count]));

    return this.statusesResource.value().map((status) => ({ status, total: counts.get(status.id) ?? 0 }));
  });
  protected readonly totalTasks = computed(() => this.statusCounts().reduce((sum, entry) => sum + entry.total, 0));
  private readonly recentTasksResource = rxResource({
    params: () => ({ projectId: this.projectId() }),
    stream: ({ params }) =>
      this.taskClient.list(params.projectId, { limit: 5, sort: 'updatedAt:desc' }).pipe(map((res) => res.data)),
    defaultValue: [] as Task[],
  });
  protected readonly recentTasks = computed(() =>
    this.recentTasksResource.hasValue() ? this.recentTasksResource.value() : [],
  );
  protected readonly loading = computed(() => this.projectResource.isLoading());
  protected readonly error = computed(() => {
    const err = this.projectResource.error();

    return err ? getErrorMessage(err) : '';
  });
  /** Members preview comes from the project context store (loaded by projectGuard) */
  protected readonly membersPreview = computed(() => this.projectStore.members().slice(0, 5));
  protected readonly extraMembersCount = computed(() =>
    Math.max(this.projectStore.members().length - this.membersPreview().length, 0),
  );
  /**
   * Whether the current user can manage project settings (PROJECT_ADMIN+).
   * Tenant OWNER/ADMIN bypass project role checks.
   */
  protected readonly isAdmin = computed(() =>
    canManageProject(this.projectStore.projectRole(), this.authStore.tenantRole()),
  );
  /** Read-only banner shown for archived / deletion-pending projects */
  protected readonly readOnlyBannerKey = computed(() => {
    const status = this.project()?.status;

    if (status === ProjectStatus.ARCHIVED) return 'projectDetail.archivedBanner';
    if (status === ProjectStatus.DELETION_PENDING) return 'projectDetail.deletionPendingBanner';

    return '';
  });

  protected memberInitials(name: string | undefined, email: string | undefined): string {
    const source = name || email || '?';
    const parts = source.trim().split(/\s+/);

    return parts.length > 1
      ? ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase()
      : source.slice(0, 2).toUpperCase();
  }
}
