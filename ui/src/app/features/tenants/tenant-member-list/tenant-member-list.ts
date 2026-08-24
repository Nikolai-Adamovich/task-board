import { Component, inject, input, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
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
import { roleBadgeVariant, memberStatusBadgeVariant } from '@app/constants/priority';
import type { TenantMember } from '@task-board/shared';
import type { BrnDialogState } from '@spartan-ng/brain/dialog';
import { MemberStatus, TenantRole, InvitationStatus } from '@task-board/shared';
import { injectToasts } from '@app/shared/utils/toast-utils';
import { getErrorMessage, initials } from '@app/shared/utils/error-utils';
import { HlmAlertImports } from '@spartan-ng/helm/alert';
import { useMemberTable } from '@app/shared/member-list/member-table';

interface InviteFormModel {
  email: string;
  role: string;
}

interface ColumnDef {
  field: string;
  labelKey: string;
  filterType: 'text' | 'select';
  popoverWidth: string;
  placeholderKey?: string;
  selectAllLabelKey?: string;
  selectOptions?: { value: string; labelKey: string }[];
}

@Component({
  selector: 'ui-tenant-member-list',
  imports: [
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
  /** Shared badge-class + initials helpers (see constants/priority.ts / shared/utils) */
  protected readonly roleBadgeVariant = roleBadgeVariant;
  protected readonly memberStatusBadgeVariant = memberStatusBadgeVariant;
  protected readonly initials = initials;
  private readonly notify = injectToasts();
  private readonly tenantClient = inject(TenantClient);
  private readonly authStore = inject(AuthStore);
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
  protected readonly removingUserId = signal<string | null>(null);
  protected readonly actioningUserId = signal<string | null>(null);
  protected readonly canManage = computed(() => {
    const role = this.authStore.tenantRole();

    return role === TenantRole.OWNER || role === TenantRole.ADMIN;
  });
  /**
   * Shared sort / column-filter / pagination machinery (see shared/member-list).
   * Filter and sort state is synced to URL query params.
   */
  private readonly table = useMemberTable<TenantMember>({
    source: this.members,
    filters: {
      name: { matches: (m, q) => (m.displayName ?? m.email ?? m.userId ?? '').toLowerCase().includes(q) },
      email: { matches: (m, q) => (m.email ?? '').toLowerCase().includes(q) },
      role: { matches: (m, q) => m.role === q },
      status: { matches: (m, q) => m.status === q },
    },
    sorters: {
      name: (m) => m.displayName ?? m.email ?? m.userId ?? '',
      email: (m) => m.email ?? '',
      role: (m) => m.role,
      status: (m) => m.status,
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

  protected toggleSort(field: string): void {
    this.table.toggleSort(field);
  }

  protected getFilterValue(field: string): string {
    return this.table.getFilterValue(field);
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
  /** Column definitions for table headers */
  protected readonly columns: ColumnDef[] = [
    {
      field: 'name',
      labelKey: 'members.name',
      filterType: 'text',
      popoverWidth: 'w-56',
      placeholderKey: 'members.filterByName',
    },
    {
      field: 'email',
      labelKey: 'members.email',
      filterType: 'text',
      popoverWidth: 'w-56',
      placeholderKey: 'members.filterByEmail',
    },
    {
      field: 'role',
      labelKey: 'members.role',
      filterType: 'select',
      popoverWidth: 'w-48',
      selectAllLabelKey: 'members.allRoles',
      selectOptions: Object.values(TenantRole).map((r) => ({
        value: r,
        labelKey: 'members.role' + r.charAt(0) + r.slice(1).toLowerCase(),
      })),
    },
    {
      field: 'status',
      labelKey: 'members.status',
      filterType: 'select',
      popoverWidth: 'w-48',
      selectAllLabelKey: 'members.allStatuses',
      selectOptions: [
        { value: 'ACTIVE', labelKey: 'members.statusActive' },
        { value: 'ACCESS_REVOKED', labelKey: 'members.statusAccessRevoked' },
      ],
    },
  ];

  protected onDialogStateChange(state: BrnDialogState): void {
    if (state === 'closed') {
      this.showInviteDialog.set(false);
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
        this.notify.success('toasts.updated');
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
          this.notify.success('toasts.deleted');
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

  /** Check if a member has an expired or revoked invitation */
  protected hasExpiredOrRevokedInvitation(member: TenantMember): boolean {
    return (
      member.invitation?.status === InvitationStatus.EXPIRED || member.invitation?.status === InvitationStatus.REVOKED
    );
  }
}
