import { Component, inject, input, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
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
import { PreferencesStore } from '@stores/preferences-store';
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
import { HttpErrorResponse } from '@angular/common/http';
import type { ProjectMember } from '@task-board/shared';
import type { BrnDialogState } from '@spartan-ng/brain/dialog';

@Component({
  selector: 'ui-project-member-list',
  imports: [
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
  private readonly projectClient = inject(ProjectClient);
  private readonly authStore = inject(AuthStore);
  private readonly projectStore = inject(ProjectStore);
  private readonly preferencesStore = inject(PreferencesStore);
  private readonly router = inject(Router);
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
  /** Pagination */
  protected readonly page = signal(1);
  protected readonly pageSize = signal(this.preferencesStore.pageSize());
  protected readonly total = computed(() => this.filteredMembers().length);
  protected readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize())));
  protected readonly paginatedMembers = computed(() => {
    const start = (this.page() - 1) * this.pageSize();

    return this.filteredMembers().slice(start, start + this.pageSize());
  });
  /** Column sorting */
  protected readonly sortField = signal('');
  protected readonly sortDirection = signal<'asc' | 'desc'>('asc');
  /** Column-level filter signals */
  protected readonly filterName = signal('');
  protected readonly filterEmail = signal('');
  protected readonly filterRole = signal('');
  /** Members sorted by the current sort column */
  protected readonly sortedMembers = computed(() => {
    const list = [...this.members()];
    const field = this.sortField();
    const dir = this.sortDirection() === 'asc' ? 1 : -1;

    if (!field) return list;

    return list.sort((a, b) => {
      let valA: string;
      let valB: string;

      switch (field) {
        case 'displayName':
          valA = a.displayName ?? a.userId;
          valB = b.displayName ?? b.userId;
          break;

        case 'email':
          valA = a.email ?? '';
          valB = b.email ?? '';
          break;

        case 'role':
          valA = a.role;
          valB = b.role;
          break;

        default:
          return 0;
      }

      return valA.localeCompare(valB) * dir;
    });
  });
  /** Members filtered by column filters */
  protected readonly filteredMembers = computed(() => {
    let list = this.sortedMembers();
    const name = this.filterName().toLowerCase();
    const role = this.filterRole();
    const email = this.filterEmail().toLowerCase();

    if (name) {
      list = list.filter((m) => {
        const display = (m.displayName ?? m.userId).toLowerCase();

        return display.includes(name);
      });
    }

    if (email) {
      list = list.filter((m) => (m.email ?? '').toLowerCase().includes(email));
    }

    if (role) {
      list = list.filter((m) => m.role === role);
    }

    return list;
  });
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
              },
              error: (err) => {
                this.error.set(this.getErrorMessage(err));
              },
            });
        },
      },
    },
  );

  protected toggleSort(field: string): void {
    if (this.sortField() === field) {
      if (this.sortDirection() === 'asc') {
        this.sortDirection.set('desc');
      } else {
        // Was desc → clear sort entirely
        this.sortField.set('');
        this.sortDirection.set('asc');
      }
    } else {
      this.sortField.set(field);
      this.sortDirection.set('asc');
    }
    this.syncToUrl();
  }

  /** Handle column filter changes from popover dropdowns/inputs */
  protected onColumnFilterChange(filterName: string, value: string): void {
    switch (filterName) {
      case 'name':
        this.filterName.set(value);
        break;

      case 'email':
        this.filterEmail.set(value);
        break;

      case 'role':
        this.filterRole.set(value);
        break;
    }
    this.page.set(1);
    this.syncToUrl();
  }

  protected onPageChange(newPage: number): void {
    this.page.set(newPage);
  }

  protected onPageSizeChange(newSize: number): void {
    this.pageSize.set(newSize);
    this.preferencesStore.setPageSize(newSize);
    this.page.set(1);
  }

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
        },
        error: (err) => {
          this.error.set(this.getErrorMessage(err));
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
        },
        error: (err) => {
          this.error.set(this.getErrorMessage(err));
        },
      });
  }

  protected onAddMemberDialogStateChange(state: BrnDialogState): void {
    if (state === 'closed') {
      this.showAddMember.set(false);
    }
  }

  protected onRemoveDialogStateChange(state: BrnDialogState): void {
    if (state === 'closed') {
      this.showRemoveConfirm.set(false);
      this.memberToRemove.set(null);
    }
  }

  ngOnInit(): void {
    // Sync URL query params → component state
    this.queryParamsSub = this.route.queryParams.subscribe((params) => {
      this.filterName.set(params['name'] ?? '');
      this.filterEmail.set(params['email'] ?? '');
      this.filterRole.set(params['role'] ?? '');

      const sortParam = params['sort'] ?? '';

      if (sortParam) {
        const [field, direction] = sortParam.split(':');

        this.sortField.set(field ?? '');
        this.sortDirection.set((direction === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc');
      } else {
        this.sortField.set('');
        this.sortDirection.set('asc');
      }

      this.loadMembers();
    });
  }

  ngOnDestroy(): void {
    this.queryParamsSub?.unsubscribe();
  }

  /** Sync all filter/sort state to URL query params */
  private syncToUrl(): void {
    const queryParams: Record<string, string | null> = {
      name: this.filterName() || null,
      email: this.filterEmail() || null,
      role: this.filterRole() || null,
      sort: this.sortField() ? `${this.sortField()}:${this.sortDirection()}` : null,
    };

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      replaceUrl: true,
    });
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

  private getErrorMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      return err.error?.message ?? err.message;
    }

    return 'errors.unexpected';
  }
}
