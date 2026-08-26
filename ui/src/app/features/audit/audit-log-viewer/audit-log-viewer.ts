import { Component, computed, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { ProjectStore } from '@stores/project-store';
import { PreferencesStore } from '@stores/preferences-store';
import { TranslocoPipe } from '@jsverse/transloco';
import { provideIcons, NgIcon } from '@ng-icons/core';
import { lucideHistory, lucideFilter, lucideArrowUp, lucideArrowDown } from '@ng-icons/lucide';
import { rxResource } from '@angular/core/rxjs-interop';
import { AuditClient, type AuditListParams } from '@services/audit-client';
import type { AuditEvent, PaginatedResponse } from '@task-board/shared';
import { AuditEntityType } from '@task-board/shared';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { Pagination } from '@app/shared/pagination/pagination';
import { HlmEmptyImports } from '@spartan-ng/helm/empty';
import { HlmAlertImports } from '@spartan-ng/helm/alert';

/** R3-P7: strict numeric query-param transform — non-positive/garbage → 0 (caller applies defaults). */
function safeNumericParam(value: unknown): number {
  const n = Number(value);

  return Number.isFinite(n) && n > 0 ? n : 0;
}

interface ActorOption {
  id: string;
  name: string;
}

const EMPTY_PAGE: PaginatedResponse<AuditEvent> = {
  data: [],
  pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
};

@Component({
  selector: 'ui-audit-log-viewer',
  imports: [
    DatePipe,
    HlmAlertImports,
    HlmEmptyImports,
    TranslocoPipe,
    NgIcon,
    HlmButtonImports,
    HlmBadgeImports,
    HlmSpinnerImports,
    HlmSelectImports,
    HlmTableImports,
    Pagination,
  ],
  providers: [provideIcons({ lucideHistory, lucideFilter, lucideArrowUp, lucideArrowDown })],
  templateUrl: './audit-log-viewer.html',
})
export class AuditLogViewer {
  private readonly auditClient = inject(AuditClient);
  private readonly projectStore = inject(ProjectStore);
  private readonly preferencesStore = inject(PreferencesStore);
  /** R3-P8: DatePipe token derived from the user's date/time format preference */
  protected readonly dateTimeFmt = this.preferencesStore.dateTimePipeFormat;
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  /** Bound via withComponentInputBinding() — receives the project key from the route */
  readonly projectKey = input.required<string>();
  // ─── URL-synced query params (bound automatically by withComponentInputBinding) ──
  readonly page = input(1, { transform: safeNumericParam });
  readonly limit = input(20, { transform: safeNumericParam });
  /** `asc` | `desc` (time sort direction — default desc = newest first) */
  readonly sort = input<'asc' | 'desc'>('desc');
  readonly action = input('');
  readonly entityType = input('');
  /** Actor user id */
  readonly actor = input('');
  // ─── Derived state ─────────────────────────────────────────────────────────
  /** Resolved project UUID from the store (available after guard loads project) */
  protected readonly projectId = computed(() => this.projectStore.activeProject()?.id ?? '');
  protected readonly safePage = computed(() => this.page() || 1);
  protected readonly safeLimit = computed(() => this.limit() || 20);
  /** All available entity types for the filter dropdown */
  protected readonly entityTypes = Object.values(AuditEntityType);
  protected readonly actions = ['CREATED', 'UPDATED', 'DELETED'] as const;
  /**
   * R3-P7: actor options are populated from the loaded page data (distinct actors),
   * per plan §P7 — no dedicated endpoint.
   */
  protected readonly actorOptions = computed<ActorOption[]>(() => {
    const seen = new Map<string, string>();

    for (const event of this.events()) {
      if (event.actor.userId && !seen.has(event.actor.userId)) seen.set(event.actor.userId, event.actor.displayName);
    }

    return [...seen].map(([id, name]) => ({ id, name }));
  });
  private readonly auditResource = rxResource({
    params: () => ({
      projectId: this.projectId(),
      page: this.safePage(),
      limit: this.safeLimit(),
      sort: this.sort(),
      action: (this.action() || undefined) as AuditListParams['action'],
      entityType: (this.entityType() || undefined) as AuditListParams['entityType'],
      actorId: this.actor() || undefined,
    }),
    stream: ({ params }) => this.auditClient.listByProject(params.projectId, params),
    defaultValue: EMPTY_PAGE,
  });
  // hasValue() guards are mandatory — reading .value() in the error state throws.
  protected readonly events = computed(() => (this.auditResource.hasValue() ? this.auditResource.value().data : []));
  protected readonly total = computed(() =>
    this.auditResource.hasValue() ? this.auditResource.value().pagination.total : 0,
  );
  protected readonly totalPages = computed(() =>
    this.auditResource.hasValue() ? this.auditResource.value().pagination.totalPages : 0,
  );
  protected readonly loading = computed(() => this.auditResource.isLoading());
  protected readonly error = computed(() => {
    // The resource may hand us the raw thrown value or an Error wrapper (with `cause`)
    interface ErrShape {
      error?: { message?: string };
      message?: string;
      cause?: { error?: { message?: string } };
    }

    const err = this.auditResource.error() as ErrShape | null | undefined;

    if (!err) return '';

    return err.error?.message ?? err.cause?.error?.message ?? err.message ?? 'errors.unexpected';
  });
  /** Row-click inline expansion of the full changes detail */
  protected readonly expandedEventId = signal<string | null>(null);

  // ─── URL sync ──────────────────────────────────────────────────────────────

  /** Merge params into the URL; null removes a param. Inputs update reactively. */
  private patchParams(params: Record<string, string | number | null>): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: params,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  // ─── Handlers ──────────────────────────────────────────────────────────────

  protected onEntityTypeChange(value: string): void {
    this.patchParams({ entityType: value || null, page: null });
  }

  protected onActionChange(value: string): void {
    this.patchParams({ action: value || null, page: null });
  }

  protected onActorChange(value: string): void {
    this.patchParams({ actor: value || null, page: null });
  }

  protected toggleSort(): void {
    this.patchParams({ sort: this.sort() === 'desc' ? 'asc' : 'desc' });
  }

  protected goToPage(newPage: number): void {
    if (newPage < 1 || newPage > this.totalPages()) return;

    this.patchParams({ page: newPage === 1 ? null : newPage });
  }

  protected toggleExpand(eventId: string): void {
    this.expandedEventId.update((current) => (current === eventId ? null : eventId));
  }

  // ─── Display helpers ───────────────────────────────────────────────────────

  protected getActionVariant(action: string): string {
    switch (action) {
      case 'CREATED':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';

      case 'UPDATED':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';

      case 'DELETED':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';

      default:
        return '';
    }
  }

  /** Human-readable change value: server-resolved label first, raw value fallback. */
  protected changeValue(change: AuditEvent['changes'][number], side: 'old' | 'new'): string {
    const label = side === 'old' ? (change.oldLabel ?? change.oldValue) : (change.newLabel ?? change.newValue);

    return label === null || label === undefined || label === '' ? '\u2014' : String(label);
  }

  /** Compact one-line diff text for the Changes cell (`field: old → new`). */
  protected compactDiff(change: AuditEvent['changes'][number]): string {
    const oldPart = change.oldValue !== null ? `${this.changeValue(change, 'old')} \u2192 ` : '';

    return `${change.field}: ${oldPart}${this.changeValue(change, 'new')}`;
  }

  /** First changes shown in the compact cell before expansion. */
  protected visibleChanges(event: AuditEvent, max = 2): AuditEvent['changes'] {
    return event.changes.slice(0, max);
  }

  protected initials(name: string): string {
    return (
      name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('') || '?'
    );
  }
}
