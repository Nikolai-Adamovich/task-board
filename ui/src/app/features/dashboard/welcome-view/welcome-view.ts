import { Component, input, output, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { AuthStore } from '@stores/auth-store';
import { TenantClient } from '@services/tenant-client';
import { provideIcons, NgIcon } from '@ng-icons/core';
import { lucideBuilding2, lucideCheck, lucideMail } from '@ng-icons/lucide';
import { finalize } from 'rxjs';
import type { MyInvitation } from '@app/types/frontend';

@Component({
  selector: 'ui-welcome-view',
  imports: [RouterLink, TranslocoPipe, HlmCardImports, HlmButtonImports, HlmBadgeImports, HlmSpinnerImports, NgIcon],
  providers: [provideIcons({ lucideBuilding2, lucideCheck, lucideMail })],
  templateUrl: './welcome-view.html',
})
export class WelcomeView {
  protected readonly authStore = inject(AuthStore);
  private readonly tenantClient = inject(TenantClient);
  readonly invitations = input<MyInvitation[]>([]);
  readonly invitationHandled = output();
  protected readonly acceptingId = signal<string | null>(null);

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
}
