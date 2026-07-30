import { Component, input, output, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { TenantClient } from '@services/tenant-client';
import { provideIcons, NgIcon } from '@ng-icons/core';
import { lucideMail, lucideBuilding2 } from '@ng-icons/lucide';
import type { MyInvitation } from '@task-board/shared';

@Component({
  selector: 'ui-invitation-view',
  imports: [RouterLink, DatePipe, HlmCardImports, HlmButtonImports, HlmBadgeImports, HlmSpinnerImports, NgIcon],
  providers: [provideIcons({ lucideMail, lucideBuilding2 })],
  templateUrl: './invitation-view.html',
})
export class InvitationView {
  private readonly tenantClient = inject(TenantClient);
  readonly invitations = input<MyInvitation[]>([]);
  readonly invitationHandled = output();
  protected readonly acceptingId = signal<string | null>(null);
  protected readonly decliningId = signal<string | null>(null);

  protected acceptInvitation(invitation: MyInvitation): void {
    this.acceptingId.set(invitation.id);
    this.tenantClient.acceptInvitationById(invitation.id).subscribe({
      next: () => {
        this.acceptingId.set(null);
        this.invitationHandled.emit();
      },
      error: () => this.acceptingId.set(null),
    });
  }

  protected declineInvitation(invitation: MyInvitation): void {
    this.decliningId.set(invitation.id);
    this.tenantClient.declineInvitation(invitation.id).subscribe({
      next: () => {
        this.decliningId.set(null);
        this.invitationHandled.emit();
      },
      error: () => this.decliningId.set(null),
    });
  }
}
