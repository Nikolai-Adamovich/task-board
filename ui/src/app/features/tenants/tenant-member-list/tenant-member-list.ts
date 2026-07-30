import { Component, inject, input, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { provideIcons, NgIcon } from '@ng-icons/core';
import { lucideUserPlus, lucideTrash2, lucideShield, lucideBan, lucideRefreshCw, lucideSkull } from '@ng-icons/lucide';
import { TenantClient } from '@services/tenant-client';
import { AuthStore } from '@stores/auth-store';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmNativeSelectImports } from '@spartan-ng/helm/native-select';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmAvatarImports } from '@spartan-ng/helm/avatar';
import type { TenantMember } from '@task-board/shared';
import type { BrnDialogState } from '@spartan-ng/brain/dialog';
import { TenantRole } from '@task-board/shared';

const roleColorMap: Record<string, string> = {
  owner: 'bg-purple-100 text-purple-700',
  admin: 'bg-blue-100 text-blue-700',
  member: 'bg-gray-100 text-gray-600',
};
const statusColorMap: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  pending: 'bg-amber-100 text-amber-700',
  declined: 'bg-red-100 text-red-700',
  access_revoked: 'bg-red-100 text-red-700',
};

@Component({
  selector: 'ui-tenant-member-list',
  imports: [
    FormsModule,
    NgIcon,
    HlmButtonImports,
    HlmCardImports,
    HlmFieldImports,
    HlmInputImports,
    HlmSpinnerImports,
    HlmDialogImports,
    HlmNativeSelectImports,
    HlmBadgeImports,
    HlmAvatarImports,
  ],
  providers: [provideIcons({ lucideUserPlus, lucideTrash2, lucideShield, lucideBan, lucideRefreshCw, lucideSkull })],
  templateUrl: './tenant-member-list.html',
})
export class TenantMemberList implements OnInit {
  private readonly tenantClient = inject(TenantClient);
  private readonly authStore = inject(AuthStore);
  /** Bound via withComponentInputBinding() */
  readonly tenantId = input.required<string>();
  protected readonly members = signal<TenantMember[]>([]);
  protected readonly loading = signal(true);
  protected readonly inviting = signal(false);
  protected readonly showInviteDialog = signal(false);
  protected readonly roles = TenantRole;
  protected inviteEmail = '';
  protected inviteRole = 'member';
  protected readonly removingUserId = signal<string | null>(null);
  protected readonly actioningUserId = signal<string | null>(null);
  protected readonly canManage = computed(() => {
    const role = this.authStore.tenantRole();

    return role === 'owner' || role === 'admin';
  });

  protected getRoleColor(role: string): string {
    return roleColorMap[role] ?? 'bg-gray-100 text-gray-600';
  }

  protected getStatusColor(status: string): string {
    return statusColorMap[status] ?? 'bg-gray-100 text-gray-600';
  }

  protected onDialogStateChange(state: BrnDialogState): void {
    if (state === 'closed') {
      this.showInviteDialog.set(false);
      this.inviteEmail = '';
      this.inviteRole = 'member';
    }
  }

  ngOnInit(): void {
    this.loadMembers();
  }

  private loadMembers(): void {
    this.loading.set(true);
    this.tenantClient.listMembers(this.tenantId()).subscribe({
      next: (res) => {
        this.members.set(res.data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected inviteMember(): void {
    if (!this.inviteEmail) return;

    this.inviting.set(true);
    this.tenantClient.inviteMember(this.tenantId(), this.inviteEmail, this.inviteRole).subscribe({
      next: () => {
        this.inviting.set(false);
        this.showInviteDialog.set(false);
        this.inviteEmail = '';
        this.inviteRole = 'member';
        this.loadMembers();
      },
      error: () => this.inviting.set(false),
    });
  }

  protected changeRole(member: TenantMember, newRole: string | undefined | null): void {
    if (!newRole || newRole === member.role || !member.userId) return;

    this.tenantClient.updateMemberRole(this.tenantId(), member.userId, newRole).subscribe({
      next: (updated) => {
        this.members.update((list) => list.map((m) => (m.userId === updated.userId ? updated : m)));
      },
    });
  }

  protected removeMember(member: TenantMember): void {
    if (!member.userId) return;

    this.removingUserId.set(member.userId);

    this.tenantClient.removeMember(this.tenantId(), member.userId).subscribe({
      next: () => {
        this.members.update((list) => list.filter((m) => m.userId !== member.userId));
        this.removingUserId.set(null);
      },
      error: () => this.removingUserId.set(null),
    });
  }

  protected revokeAccess(member: TenantMember): void {
    if (!member.userId) return;

    this.actioningUserId.set(member.userId);
    this.tenantClient.revokeAccess(this.tenantId(), member.userId).subscribe({
      next: () => {
        this.members.update((list) =>
          list.map((m) => (m.userId === member.userId ? { ...m, status: 'access_revoked' as const } : m)),
        );
        this.actioningUserId.set(null);
      },
      error: () => this.actioningUserId.set(null),
    });
  }

  protected resendInvitation(member: TenantMember): void {
    if (!member.userId) return;

    this.actioningUserId.set(member.userId);
    this.tenantClient.resendInvitation(this.tenantId(), member.userId).subscribe({
      next: () => this.actioningUserId.set(null),
      error: () => this.actioningUserId.set(null),
    });
  }

  protected hardDeleteMember(member: TenantMember): void {
    if (!member.userId) return;

    this.actioningUserId.set(member.userId);
    this.tenantClient.hardDeleteMember(this.tenantId(), member.userId).subscribe({
      next: () => {
        this.members.update((list) => list.filter((m) => m.userId !== member.userId));
        this.actioningUserId.set(null);
      },
      error: () => this.actioningUserId.set(null),
    });
  }

  protected isOwner(member: TenantMember): boolean {
    return member.role === 'owner';
  }

  protected getInitials(userId: string | null): string {
    if (!userId) return '??';
    return userId.substring(0, 2).toUpperCase();
  }
}
