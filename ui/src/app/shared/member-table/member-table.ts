import { Component, computed, inject, input, output, signal } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { provideIcons, NgIcon } from '@ng-icons/core';
import {
  lucideArrowDown,
  lucideArrowUp,
  lucideBan,
  lucideFilter,
  lucideMail,
  lucidePencil,
  lucideRefreshCw,
  lucideRotateCcw,
  lucideSkull,
  lucideTrash2,
} from '@ng-icons/lucide';
import { HlmAlertImports } from '@spartan-ng/helm/alert';
import { HlmAvatarImports } from '@spartan-ng/helm/avatar';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmNativeSelectImports } from '@spartan-ng/helm/native-select';
import { HlmPopoverImports } from '@spartan-ng/helm/popover';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { InvitationStatus, MemberStatus, TenantRole } from '@task-board/shared';
import type { BrnDialogState } from '@spartan-ng/brain/dialog';
import { ConfirmDialog } from '@app/shared/confirm-dialog/confirm-dialog';
import { Pagination } from '@app/shared/pagination/pagination';
import { memberStatusBadgeVariant, roleBadgeVariant } from '@app/constants/priority';
import { initials } from '@app/shared/utils/error-utils';

/** Normalized row model consumed by {@link MemberTable} — both member shapes map onto it. */
export interface MemberRow {
  userId: string;
  displayName?: string | null;
  email?: string | null;
  role: string;
  /** Tenant variant only (`MemberStatus`). */
  status?: string;
  /** Tenant variant only (`InvitationStatus`). */
  invitationStatus?: string | null;
}

/** Payload of the {@link MemberTable.roleChange} output. */
export interface MemberRoleChange {
  row: MemberRow;
  role: string;
}

interface ColumnDef {
  field: string;
  labelKey: string;
  filterType: 'text' | 'select';
  popoverWidth: string;
  placeholderKey?: string;
  selectAllLabelKey?: string;
}

/** Display-name i18n keys for known roles; unknown roles fall back to the raw enum value. */
const ROLE_LABEL_KEYS: Record<string, string> = {
  [TenantRole.OWNER]: 'members.roleOwner',
  [TenantRole.ADMIN]: 'members.roleAdmin',
  [TenantRole.MEMBER]: 'members.roleMember',
  PROJECT_ADMIN: 'members.roleProjectAdmin',
  EDITOR: 'members.roleEditor',
  VIEWER: 'members.roleViewer',
};

/**
 * Shared member table used by BOTH the tenant members and project members pages (U4).
 *
 * Columns: User (avatar + name), Email, Role, [tenant-only: Access/Invitation status], Actions.
 * Actions: Edit (small dialog with role select + confirm) and Remove (confirm dialog);
 * the tenant variant adds Resend/Revoke (pending invitations), Reinvite (expired/revoked
 * invitations), Restore (revoked without pending invitation) and permanent delete.
 *
 * The host page owns data fetching, permissions and the actual API calls — this component
 * only renders state and emits intents. Sort/filter/pagination state is passed down and
 * changes are emitted back so pages can keep their URL-synced `useMemberTable` machinery.
 */
@Component({
  selector: 'ui-member-table',
  imports: [
    ConfirmDialog,
    NgIcon,
    Pagination,
    TranslocoPipe,
    HlmAlertImports,
    HlmAvatarImports,
    HlmBadgeImports,
    HlmButtonImports,
    HlmDialogImports,
    HlmFieldImports,
    HlmInputImports,
    HlmNativeSelectImports,
    HlmPopoverImports,
    HlmSelectImports,
    HlmSpinnerImports,
    HlmTableImports,
  ],
  providers: [
    provideIcons({
      lucideArrowDown,
      lucideArrowUp,
      lucideBan,
      lucideFilter,
      lucideMail,
      lucidePencil,
      lucideRefreshCw,
      lucideRotateCcw,
      lucideSkull,
      lucideTrash2,
    }),
  ],
  templateUrl: './member-table.html',
})
export class MemberTable {
  /** `'tenant'` adds the Access/Invitation status column and invitation lifecycle actions. */
  readonly variant = input.required<'tenant' | 'project'>();
  /** Rows to render (already filtered/sorted/paginated by the host page). */
  readonly rows = input.required<MemberRow[]>();
  /** Whether the current user may manage members (shows the Actions column). */
  readonly canManage = input(false);
  /** Whether the member list is currently loading. */
  readonly loading = input(false);
  /**
   * Guard for V1-10/V2-1: when the tenant/project id could not be resolved from the
   * store context, an error state is shown instead of the table and no requests fire.
   */
  readonly contextMissing = input(false);
  /** Assignable roles for the Edit dialog and the Role column filter. */
  readonly roles = input<string[]>([]);
  /** Row-level action in flight (spinner + disabled buttons). */
  readonly busyUserId = input<string | null>(null);
  /** Row-level removal in flight. */
  readonly removingUserId = input<string | null>(null);
  readonly page = input(1);
  readonly pageSize = input(20);
  readonly total = input(0);
  readonly totalPages = input(1);
  readonly sortField = input('');
  readonly sortDirection = input<'asc' | 'desc'>('asc');
  /** Current column-filter values keyed by field name. */
  readonly filters = input<Record<string, string>>({});
  readonly sortToggle = output<string>();
  readonly filterChange = output<{ field: string; value: string }>();
  readonly pageChange = output<number>();
  readonly pageSizeChange = output<number>();
  /** Confirmed role change from the Edit dialog. */
  readonly roleChange = output<MemberRoleChange>();
  /** Confirmed removal (after the confirm dialog). */
  readonly remove = output<MemberRow>();
  /** Tenant variant: resend a pending invitation. */
  readonly resend = output<MemberRow>();
  /** Tenant variant: revoke access (active member or pending invitation). */
  readonly revoke = output<MemberRow>();
  /** Tenant variant: restore a revoked membership without pending invitation. */
  readonly restore = output<MemberRow>();
  /** Tenant variant: reinvite after an expired/revoked invitation. */
  readonly reinvite = output<MemberRow>();
  /** Tenant variant: permanently delete a revoked/declined member. */
  readonly hardDelete = output<MemberRow>();
  private readonly i18n = inject(TranslocoService);
  protected readonly initials = initials;
  protected readonly roleBadgeVariant = roleBadgeVariant;
  protected readonly memberStatusBadgeVariant = memberStatusBadgeVariant;
  protected readonly MemberStatus = MemberStatus;
  protected readonly InvitationStatus = InvitationStatus;
  protected readonly editingRow = signal<MemberRow | null>(null);
  protected readonly editRole = signal('');
  protected readonly rowToRemove = signal<MemberRow | null>(null);
  /** Column definitions depend on the variant (tenant adds the status column). */
  protected readonly columns = computed<ColumnDef[]>(() => {
    const cols: ColumnDef[] = [
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
      },
    ];

    if (this.variant() === 'tenant') {
      cols.push({
        field: 'status',
        labelKey: 'members.status',
        filterType: 'select',
        popoverWidth: 'w-48',
        selectAllLabelKey: 'members.allStatuses',
      });
    }

    return cols;
  });
  protected readonly colspan = computed(() => this.columns().length + (this.canManage() ? 1 : 0));
  protected readonly roleOptions = computed(() =>
    this.roles().map((role) => ({ value: role, label: this.roleLabel(role) })),
  );
  protected readonly statusOptions: { value: string; labelKey: string }[] = [
    { value: MemberStatus.ACTIVE, labelKey: 'members.statusActive' },
    { value: MemberStatus.ACCESS_REVOKED, labelKey: 'members.statusAccessRevoked' },
  ];

  /** Human-readable role label; unknown enum values render verbatim. */
  protected roleLabel(role: string): string {
    const key = ROLE_LABEL_KEYS[role];

    return key ? this.i18n.translate(key) : role;
  }

  protected getFilterValue(field: string): string {
    return this.filters()[field] ?? '';
  }

  // ── Edit (role change) ─────────────────────────────────────────

  protected openEdit(row: MemberRow): void {
    this.editingRow.set(row);
    this.editRole.set(row.role);
  }

  protected onEditDialogStateChange(state: BrnDialogState): void {
    if (state === 'closed') {
      this.editingRow.set(null);
    }
  }

  protected confirmRoleChange(): void {
    const row = this.editingRow();
    const role = this.editRole();

    this.editingRow.set(null);

    if (!row || !role || role === row.role) return;

    this.roleChange.emit({ row, role });
  }

  // ── Remove ─────────────────────────────────────────────────────

  protected confirmRemove(row: MemberRow): void {
    this.rowToRemove.set(row);
  }

  protected onRemoveDialogStateChange(open: boolean): void {
    if (!open) {
      this.rowToRemove.set(null);
    }
  }

  protected onRemoveConfirmed(): void {
    const row = this.rowToRemove();

    this.rowToRemove.set(null);

    if (row) {
      this.remove.emit(row);
    }
  }

  // ── Row predicates ─────────────────────────────────────────────

  protected isOwner(row: MemberRow): boolean {
    return row.role === TenantRole.OWNER;
  }

  /** Revoked/expired invitation → Reinvite applies (BR-036: pending ones only via the invitee). */
  protected hasExpiredOrRevokedInvitation(row: MemberRow): boolean {
    return row.invitationStatus === InvitationStatus.EXPIRED || row.invitationStatus === InvitationStatus.REVOKED;
  }

  protected canRestore(row: MemberRow): boolean {
    return row.status === MemberStatus.ACCESS_REVOKED && row.invitationStatus !== InvitationStatus.PENDING;
  }

  protected canRevoke(row: MemberRow): boolean {
    return row.status === MemberStatus.ACTIVE || row.invitationStatus === InvitationStatus.PENDING;
  }

  protected canHardDelete(row: MemberRow): boolean {
    return row.status === MemberStatus.ACCESS_REVOKED || row.invitationStatus === InvitationStatus.DECLINED;
  }
}
