import { Component, inject, input, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { TranslocoPipe } from '@jsverse/transloco';
import { provideIcons, NgIcon } from '@ng-icons/core';
import {
  lucideUserPlus,
  lucideTrash2,
  lucideShield,
  lucideBan,
  lucideRefreshCw,
  lucideSkull,
  lucideRotateCcw,
  lucideMail,
  lucideArrowUp,
  lucideArrowDown,
  lucideFilter,
} from '@ng-icons/lucide';
import { finalize } from 'rxjs';
import { form, FormRoot, FormField, schema, required } from '@angular/forms/signals';
import { TenantClient } from '@services/tenant-client';
import { AuthStore } from '@stores/auth-store';
import { PreferencesStore } from '@stores/preferences-store';
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
import { TenantRoleColorMap, MemberStatusColorMap, NeutralColor } from '@app/constants/priority';
import { HttpErrorResponse } from '@angular/common/http';
import type { TenantMember } from '@task-board/shared';
import type { BrnDialogState } from '@spartan-ng/brain/dialog';
import { MemberStatus, TenantRole, InvitationStatus } from '@task-board/shared';

interface InviteFormModel {
  email: string;
  role: string;
}

interface ColumnDef {
  field: string;
  labelKey: string;
  filterType: 'text' | 'select';
  popoverWidth: string;
  placeholder?: string;
  selectAllLabel?: string;
  selectOptions?: { value: string; label: string }[];
}

@Component({
  selector: 'ui-tenant-member-list',
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
      lucideShield,
      lucideBan,
      lucideRefreshCw,
      lucideSkull,
      lucideRotateCcw,
      lucideMail,
      lucideArrowUp,
      lucideArrowDown,
      lucideFilter,
    }),
  ],
  templateUrl: './tenant-member-list.html',
})
export class TenantMemberList implements OnInit, OnDestroy {
  private readonly tenantClient = inject(TenantClient);
  private readonly authStore = inject(AuthStore);
  private readonly preferencesStore = inject(PreferencesStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private queryParamsSub?: Subscription;
  /** Bound via withComponentInputBinding() */
  readonly tenantId = input.required<string>();
  protected readonly members = signal<TenantMember[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly showInviteDialog = signal(false);
  protected readonly TenantRole = TenantRole;
  protected readonly MemberStatus = MemberStatus;
  protected readonly InvitationStatus = InvitationStatus;
  protected readonly roles = Object.values(TenantRole);
  protected readonly model = signal<InviteFormModel>({ email: '', role: TenantRole.MEMBER });
  protected readonly inviteForm = form(
    this.model,
    schema<InviteFormModel>((field) => {
      required(field.email, { message: 'validation.emailRequired' });
      required(field.role, { message: 'validation.roleRequired' });
    }),
    {
      submission: {
        action: async (f) => {
          this.error.set('');

          const modelValue = this.model();

          this.tenantClient.inviteMember(this.tenantId(), modelValue.email, modelValue.role).subscribe({
            next: () => {
              this.showInviteDialog.set(false);
              f().reset({ email: '', role: TenantRole.MEMBER });
              this.loadMembers();
            },
            error: (err) => {
              this.error.set(this.getErrorMessage(err));
            },
          });
        },
      },
    },
  );
  protected readonly removingUserId = signal<string | null>(null);
  protected readonly actioningUserId = signal<string | null>(null);
  protected readonly canManage = computed(() => {
    const role = this.authStore.tenantRole();

    return role === TenantRole.OWNER || role === TenantRole.ADMIN;
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
  protected readonly filterStatus = signal('');
  /** Column definitions for table headers */
  protected readonly columns: ColumnDef[] = [
    {
      field: 'name',
      labelKey: 'members.name',
      filterType: 'text',
      popoverWidth: 'w-56',
      placeholder: 'Filter by name...',
    },
    {
      field: 'email',
      labelKey: 'members.email',
      filterType: 'text',
      popoverWidth: 'w-56',
      placeholder: 'Filter by email...',
    },
    {
      field: 'role',
      labelKey: 'members.role',
      filterType: 'select',
      popoverWidth: 'w-48',
      selectAllLabel: 'All Roles',
      selectOptions: Object.values(TenantRole).map((r) => ({ value: r, label: r })),
    },
    {
      field: 'status',
      labelKey: 'members.status',
      filterType: 'select',
      popoverWidth: 'w-48',
      selectAllLabel: 'All Statuses',
      selectOptions: [
        { value: 'ACTIVE', label: 'Active' },
        { value: 'ACCESS_REVOKED', label: 'Access Revoked' },
      ],
    },
  ];
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
        case 'name':
          valA = a.displayName ?? a.email ?? a.userId ?? '';
          valB = b.displayName ?? b.email ?? b.userId ?? '';
          break;

        case 'email':
          valA = a.email ?? '';
          valB = b.email ?? '';
          break;

        case 'role':
          valA = a.role;
          valB = b.role;
          break;

        case 'status':
          valA = a.status;
          valB = b.status;
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
    const status = this.filterStatus();
    const email = this.filterEmail().toLowerCase();

    if (name) {
      list = list.filter((m) => {
        const display = (m.displayName ?? m.email ?? m.userId ?? '').toLowerCase();

        return display.includes(name);
      });
    }

    if (email) {
      list = list.filter((m) => (m.email ?? '').toLowerCase().includes(email));
    }

    if (role) {
      list = list.filter((m) => m.role === role);
    }

    if (status) {
      list = list.filter((m) => m.status === status);
    }

    return list;
  });

  protected getFilterValue(field: string): string {
    switch (field) {
      case 'name':
        return this.filterName();

      case 'email':
        return this.filterEmail();

      case 'role':
        return this.filterRole();

      case 'status':
        return this.filterStatus();

      default:
        return '';
    }
  }

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

      case 'status':
        this.filterStatus.set(value);
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

  protected getRoleColor(role: string): string {
    return (TenantRoleColorMap as Record<string, string>)[role] ?? NeutralColor;
  }

  protected getStatusColor(status: string): string {
    return (MemberStatusColorMap as Record<string, string>)[status] ?? NeutralColor;
  }

  protected onDialogStateChange(state: BrnDialogState): void {
    if (state === 'closed') {
      this.showInviteDialog.set(false);
    }
  }

  ngOnInit(): void {
    // Sync URL query params → component state
    this.queryParamsSub = this.route.queryParams.subscribe((params) => {
      this.filterName.set(params['name'] ?? '');
      this.filterEmail.set(params['email'] ?? '');
      this.filterRole.set(params['role'] ?? '');
      this.filterStatus.set(params['status'] ?? '');

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
      status: this.filterStatus() || null,
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
    this.tenantClient
      .listMembers(this.tenantId())
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (members) => {
          this.members.set(members);
        },
      });
  }

  protected changeRole(member: TenantMember, newRole: string | null | undefined): void {
    if (!newRole || newRole === member.role || !member.userId) return;

    this.tenantClient.updateMemberRole(this.tenantId(), member.userId, newRole as TenantRole).subscribe({
      next: (updated) => {
        this.members.update((list) => list.map((m) => (m.userId === updated.userId ? updated : m)));
      },
    });
  }

  protected removeMember(member: TenantMember): void {
    if (!member.userId) return;

    this.removingUserId.set(member.userId);

    this.tenantClient
      .removeMember(this.tenantId(), member.userId)
      .pipe(finalize(() => this.removingUserId.set(null)))
      .subscribe({
        next: () => {
          this.members.update((list) => list.filter((m) => m.userId !== member.userId));
        },
      });
  }

  protected revokeAccess(member: TenantMember): void {
    if (!member.userId) return;

    this.actioningUserId.set(member.userId);
    this.tenantClient
      .revokeAccess(this.tenantId(), member.userId)
      .pipe(finalize(() => this.actioningUserId.set(null)))
      .subscribe({
        next: () => {
          this.members.update((list) =>
            list.map((m) => (m.userId === member.userId ? { ...m, status: MemberStatus.ACCESS_REVOKED } : m)),
          );
        },
      });
  }

  protected restoreMembership(member: TenantMember): void {
    if (!member.userId) return;

    this.actioningUserId.set(member.userId);
    this.tenantClient
      .restoreMembership(this.tenantId(), member.userId)
      .pipe(finalize(() => this.actioningUserId.set(null)))
      .subscribe({
        next: () => {
          this.members.update((list) =>
            list.map((m) => (m.userId === member.userId ? { ...m, status: MemberStatus.ACTIVE } : m)),
          );
        },
      });
  }

  protected reinviteMember(member: TenantMember): void {
    if (!member.userId) return;

    this.actioningUserId.set(member.userId);
    this.tenantClient
      .reinviteMember(this.tenantId(), member.userId)
      .pipe(finalize(() => this.actioningUserId.set(null)))
      .subscribe({
        next: () => {
          this.loadMembers();
        },
      });
  }

  protected resendInvitation(member: TenantMember): void {
    if (!member.userId) return;

    this.actioningUserId.set(member.userId);
    this.tenantClient
      .resendInvitation(this.tenantId(), member.userId)
      .pipe(finalize(() => this.actioningUserId.set(null)))
      .subscribe();
  }

  protected hardDeleteMember(member: TenantMember): void {
    if (!member.userId) return;

    this.actioningUserId.set(member.userId);
    this.tenantClient
      .hardDeleteMember(this.tenantId(), member.userId)
      .pipe(finalize(() => this.actioningUserId.set(null)))
      .subscribe({
        next: () => {
          this.members.update((list) => list.filter((m) => m.userId !== member.userId));
        },
      });
  }

  protected isOwner(member: TenantMember): boolean {
    return member.role === TenantRole.OWNER;
  }

  protected getInitials(name: string | null): string {
    if (!name) return '??';

    const parts = name.trim().split(/\s+/);

    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  /** Check if a member has an expired or revoked invitation */
  protected hasExpiredOrRevokedInvitation(member: TenantMember): boolean {
    return (
      member.invitation?.status === InvitationStatus.EXPIRED || member.invitation?.status === InvitationStatus.REVOKED
    );
  }

  private getErrorMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      return err.error?.message ?? err.message;
    }

    return 'errors.unexpected';
  }
}
