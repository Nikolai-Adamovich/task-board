import { Component, input, output, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { TenantClient } from '@services/tenant-client';
import { provideIcons, NgIcon } from '@ng-icons/core';
import { lucideMail, lucideBuilding2 } from '@ng-icons/lucide';
import { finalize } from 'rxjs';
import type { MyInvitation } from '@app/types/frontend';

@Component({
  selector: 'ui-invitation-view',
  imports: [
    RouterLink,
    DatePipe,
    TranslocoPipe,
    HlmCardImports,
    HlmButtonImports,
    HlmBadgeImports,
    HlmSpinnerImports,
    NgIcon,
  ],
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
    this.tenantClient
      .acceptInvitationById(invitation.id)
      .pipe(finalize(() => this.acceptingId.set(null)))
      .subscribe({
        next: () => {
          this.invitationHandled.emit();
        },
        error: (err) => console.error(err),
      });
  }

  protected declineInvitation(invitation: MyInvitation): void {
    this.decliningId.set(invitation.id);
    this.tenantClient
      .declineInvitation(invitation.id)
      .pipe(finalize(() => this.decliningId.set(null)))
      .subscribe({
        next: () => {
          this.invitationHandled.emit();
        },
        error: (err) => console.error(err),
      });
  }
}
