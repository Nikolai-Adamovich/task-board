import { Component, inject, input, signal, computed, OnInit } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { provideIcons, NgIcon } from '@ng-icons/core';
import { lucideUserPlus, lucideTrash2, lucideShield, lucideBan, lucideRefreshCw, lucideSkull } from '@ng-icons/lucide';
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
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmAvatarImports } from '@spartan-ng/helm/avatar';
import { TenantRoleColorMap, MemberStatusColorMap, NeutralColor } from '@app/constants/priority';
import { HttpErrorResponse } from '@angular/common/http';
import type { TenantMember } from '@task-board/shared';
import type { BrnDialogState } from '@spartan-ng/brain/dialog';
import { MemberStatus, TenantRole } from '@task-board/shared';

interface InviteFormModel {
  email: string;
  role: string;
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
  protected readonly error = signal('');
  protected readonly showInviteDialog = signal(false);
  protected readonly TenantRole = TenantRole;
  protected readonly MemberStatus = MemberStatus;
  protected readonly roles = Object.values(TenantRole);
  protected readonly model = signal<InviteFormModel>({ email: '', role: TenantRole.Member });
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
              f().reset({ email: '', role: TenantRole.Member });
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

    return role === TenantRole.Owner || role === TenantRole.Admin;
  });

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
    this.loadMembers();
  }

  private loadMembers(): void {
    this.loading.set(true);
    this.tenantClient
      .listMembers(this.tenantId())
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (res) => {
          this.members.set(res.data);
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
            list.map((m) => (m.userId === member.userId ? { ...m, status: MemberStatus.AccessRevoked } : m)),
          );
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
    return member.role === TenantRole.Owner;
  }

  protected getInitials(userId: string | null): string {
    if (!userId) return '??';
    return userId.substring(0, 2).toUpperCase();
  }

  private getErrorMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      return err.error?.message ?? err.message;
    }

    return 'errors.unexpected';
  }
}
