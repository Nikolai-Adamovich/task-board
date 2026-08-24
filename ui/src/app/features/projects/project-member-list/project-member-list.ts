import { Component, inject, input, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { TranslocoPipe } from '@jsverse/transloco';
import { provideIcons, NgIcon } from '@ng-icons/core';
import {
  lucideUserPlus,
  lucideTrash2,
  lucideSave,
  lucideCheck,
  lucideArrowUp,
  lucideArrowDown,
  lucideFilter,
} from '@ng-icons/lucide';
import { finalize } from 'rxjs';
import { form, FormRoot, FormField, schema, required } from '@angular/forms/signals';
import { ProjectClient } from '@services/project-client';
import { AuthStore } from '@stores/auth-store';
import { ProjectStore } from '@stores/project-store';
import { canManageProject } from '@app/shared/utils/role-utils';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmNativeSelectImports } from '@spartan-ng/helm/native-select';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmAvatarImports } from '@spartan-ng/helm/avatar';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { HlmPopoverImports } from '@spartan-ng/helm/popover';
import { Pagination } from '@app/shared/pagination/pagination';
import { ProjectRole } from '@task-board/shared';
import type { ProjectMember } from '@task-board/shared';
import type { BrnDialogState } from '@spartan-ng/brain/dialog';
import { injectToasts } from '@app/shared/utils/toast-utils';
import { getErrorMessage } from '@app/shared/utils/error-utils';
import { HlmAlertImports } from '@spartan-ng/helm/alert';
import { ConfirmDialog } from '@app/shared/confirm-dialog/confirm-dialog';
import { useMemberTable } from '@app/shared/member-list/member-table';

@Component({
  selector: 'ui-project-member-list',
  imports: [
    ConfirmDialog,
    HlmAlertImports,
    FormRoot,
    FormField,
    TranslocoPipe,
    NgIcon,
    HlmButtonImports,
    HlmCardImports,
    HlmFieldImports,
    HlmInputImports,
    HlmSpinnerImports,
    HlmDialogImports,
    HlmNativeSelectImports,
    HlmSelectImports,
    HlmBadgeImports,
    HlmAvatarImports,
    HlmTableImports,
    HlmPopoverImports,
    Pagination,
  ],
  providers: [
    provideIcons({
      lucideUserPlus,
      lucideTrash2,
      lucideSave,
      lucideCheck,
      lucideArrowUp,
      lucideArrowDown,
      lucideFilter,
    }),
  ],
  templateUrl: './project-member-list.html',
})
export class ProjectMemberList implements OnInit, OnDestroy {
  private readonly notify = injectToasts();
  private readonly projectClient = inject(ProjectClient);
  private readonly authStore = inject(AuthStore);
  private readonly projectStore = inject(ProjectStore);
  private readonly route = inject(ActivatedRoute);
  private queryParamsSub?: Subscription;
  /** Bound via withComponentInputBinding() — now receives project key from route */
  readonly projectKey = input.required<string>();
  /** Resolved project UUID from the store */
  protected readonly projectId = computed(() => this.projectStore.activeProject()?.id ?? '');
  protected readonly members = signal<ProjectMember[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly savingUserId = signal<string | null>(null);
  protected readonly removingUserId = signal<string | null>(null);
  protected readonly showAddMember = signal(false);
  protected readonly showRemoveConfirm = signal(false);
  protected readonly memberToRemove = signal<ProjectMember | null>(null);
  protected readonly projectRoles = Object.values(ProjectRole);
  /** Map of userId → pending role value (not yet saved) */
  protected readonly pendingRoles = signal<Record<string, string>>({});
  protected readonly isAdmin = computed(() => {
    return canManageProject(this.projectStore.projectRole(), this.authStore.tenantRole());
  });
  /**
   * Shared sort / column-filter / pagination machinery (see shared/member-list).
   * Filter and sort state is synced to URL query params.
   */
  private readonly table = useMemberTable<ProjectMember>({
    source: this.members,
    filters: {
      name: { matches: (m, q) => (m.displayName ?? m.userId).toLowerCase().includes(q) },
      email: { matches: (m, q) => (m.email ?? '').toLowerCase().includes(q) },
      role: { matches: (m, q) => m.role === q },
    },
    sorters: {
      displayName: (m) => m.displayName ?? m.userId,
      email: (m) => m.email ?? '',
      role: (m) => m.role,
    },
    load: () => this.loadMembers(),
  });
  protected readonly page = this.table.page;
  protected readonly pageSize = this.table.pageSize;
  protected readonly total = this.table.total;
  protected readonly totalPages = this.table.totalPages;
  protected readonly paginatedMembers = this.table.paginated;
  protected readonly sortField = this.table.sortField;
  protected readonly sortDirection = this.table.sortDirection;

  protected filterName(): string {
    return this.table.getFilterValue('name');
  }

  protected filterEmail(): string {
    return this.table.getFilterValue('email');
  }

  protected filterRole(): string {
    return this.table.getFilterValue('role');
  }

  protected toggleSort(field: string): void {
    this.table.toggleSort(field);
  }

  protected onColumnFilterChange(field: string, value: string): void {
    this.table.onColumnFilterChange(field, value);
  }

  protected onPageChange(newPage: number): void {
    this.table.onPageChange(newPage);
  }

  protected onPageSizeChange(newSize: number): void {
    this.table.onPageSizeChange(newSize);
  }
  private readonly memberModel = signal<{ userId: string; role: string }>({
    userId: '',
    role: ProjectRole.EDITOR,
  });
  protected readonly addMemberForm = form(
    this.memberModel,
    schema<{ userId: string; role: string }>((field) => {
      required(field.userId, { message: 'validation.userIdRequired' });
    }),
    {
      submission: {
        action: async (f) => {
          this.error.set('');

          this.projectClient
            .addMember(this.projectId(), this.memberModel().userId, this.memberModel().role as ProjectRole)
            .subscribe({
              next: () => {
                this.loadMembers();
                this.showAddMember.set(false);
                f().reset({ userId: '', role: ProjectRole.EDITOR });
                this.notify.success('toasts.created');
              },
              error: (err) => {
                this.error.set(getErrorMessage(err));
              },
            });
        },
      },
    },
  );

  /** Get the effective role for a member (pending change or current role) */
  protected getEffectiveRole(member: ProjectMember): string {
    return this.pendingRoles()[member.userId] ?? member.role;
  }

  /** Check if a member has an unsaved role change */
  protected hasPendingChange(member: ProjectMember): boolean {
    return member.userId in this.pendingRoles() && this.pendingRoles()[member.userId] !== member.role;
  }

  /** Stage a role change locally (don't send to API yet) */
  protected onRoleSelect(member: ProjectMember, newRole: string | null | undefined): void {
    if (!newRole) return;

    this.pendingRoles.update((map) => ({ ...map, [member.userId]: newRole }));
  }

  /** Save the pending role change to the API */
  protected saveRole(member: ProjectMember): void {
    const newRole = this.pendingRoles()[member.userId];

    if (!newRole || newRole === member.role) return;

    this.savingUserId.set(member.userId);

    this.projectClient
      .updateMemberRole(this.projectId(), member.userId, newRole)
      .pipe(finalize(() => this.savingUserId.set(null)))
      .subscribe({
        next: () => {
          // Remove pending state and refresh
          this.pendingRoles.update((map) =>
            Object.fromEntries(Object.entries(map).filter(([k]) => k !== member.userId)),
          );
          this.loadMembers();
          this.notify.success('toasts.updated');
        },
        error: (err) => {
          this.error.set(getErrorMessage(err));
        },
      });
  }

  protected confirmRemoveMember(member: ProjectMember): void {
    this.memberToRemove.set(member);
    this.showRemoveConfirm.set(true);
  }

  protected removeMember(): void {
    const member = this.memberToRemove();

    if (!member) return;

    this.removingUserId.set(member.userId);

    this.projectClient
      .removeMember(this.projectId(), member.userId)
      .pipe(finalize(() => this.removingUserId.set(null)))
      .subscribe({
        next: () => {
          this.loadMembers();
          this.showRemoveConfirm.set(false);
          this.memberToRemove.set(null);
          this.notify.success('toasts.deleted');
        },
        error: (err) => {
          this.error.set(getErrorMessage(err));
        },
      });
  }

  onAddMemberDialogStateChange(state: BrnDialogState): void {
    if (state === 'closed') {
      this.showAddMember.set(false);
    }
  }

  protected onRemoveDialogStateChange(open: boolean): void {
    if (!open) {
      this.showRemoveConfirm.set(false);
      this.memberToRemove.set(null);
    }
  }

  ngOnInit(): void {
    // Sync URL query params → table state, then load
    this.queryParamsSub = this.route.queryParams.subscribe((params) => {
      this.table.syncFromParams(params);
    });
  }

  ngOnDestroy(): void {
    this.queryParamsSub?.unsubscribe();
  }

  private loadMembers(): void {
    this.loading.set(true);

    this.projectClient
      .listMembers(this.projectId())
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (members) => {
          this.members.set(members);
        },
      });
  }
}
