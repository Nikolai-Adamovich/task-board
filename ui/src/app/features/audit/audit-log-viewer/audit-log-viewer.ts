import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { ProjectStore } from '@stores/project-store';
import { TranslocoPipe } from '@jsverse/transloco';
import { provideIcons, NgIcon } from '@ng-icons/core';
import { lucideHistory, lucideFilter } from '@ng-icons/lucide';
import { finalize } from 'rxjs';
import { AuditClient } from '@services/audit-client';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { HlmNumberedPagination } from '@spartan-ng/helm/pagination';
import { AuditEntityType } from '@task-board/shared';
import type { AuditEvent, PaginatedResponse } from '@task-board/shared';

@Component({
  selector: 'ui-audit-log-viewer',
  imports: [
    TranslocoPipe,
    NgIcon,
    HlmCardImports,
    HlmButtonImports,
    HlmBadgeImports,
    HlmSpinnerImports,
    HlmSelectImports,
    HlmNumberedPagination,
  ],
  providers: [provideIcons({ lucideHistory, lucideFilter })],
  templateUrl: './audit-log-viewer.html',
})
export class AuditLogViewer implements OnInit {
  private readonly auditClient = inject(AuditClient);
  private readonly projectStore = inject(ProjectStore);
  /** Bound via withComponentInputBinding() — now receives project key from route */
  readonly projectKey = input.required<string>();
  /** Resolved project UUID from the store */
  protected readonly projectId = computed(() => this.projectStore.activeProject()?.id ?? '');
  protected readonly events = signal<AuditEvent[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly page = signal(1);
  protected readonly totalPages = signal(0);
  protected readonly total = signal(0);
  protected readonly limit = 20;
  protected readonly entityTypeFilter = signal<AuditEntityType | ''>('');
  /** All available entity types for the filter dropdown */
  protected readonly entityTypes = Object.values(AuditEntityType);

  ngOnInit(): void {
    this.loadEvents();
  }

  protected onFilterChange(value: string): void {
    this.entityTypeFilter.set(value as AuditEntityType | '');
    this.page.set(1);
    this.loadEvents();
  }

  protected goToPage(newPage: number): void {
    if (newPage < 1 || newPage > this.totalPages()) return;
    this.page.set(newPage);
    this.loadEvents();
  }

  protected formatDate(iso: string): string {
    return new Date(iso).toLocaleString();
  }

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

  protected truncateId(id: string): string {
    return id.length > 8 ? id.slice(0, 8) + '\u2026' : id;
  }

  private loadEvents(): void {
    this.loading.set(true);
    this.error.set('');

    const entityType = this.entityTypeFilter() || undefined;

    this.auditClient
      .listByProject(this.projectId(), this.page(), this.limit, entityType)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (res: PaginatedResponse<AuditEvent>) => {
          this.events.set(res.data);
          this.totalPages.set(res.pagination.totalPages);
          this.total.set(res.pagination.total);
        },
        error: (err) => {
          this.error.set(err?.error?.message ?? 'errors.unexpected');
        },
      });
  }
}
