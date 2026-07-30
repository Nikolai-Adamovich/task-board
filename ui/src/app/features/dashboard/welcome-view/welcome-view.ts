import { Component, input, output, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { AuthStore } from '@stores/auth-store';
import { TenantClient } from '@services/tenant-client';
import { provideIcons, NgIcon } from '@ng-icons/core';
import { lucideBuilding2, lucideCheck, lucideMail } from '@ng-icons/lucide';
import type { MyInvitation } from '@task-board/shared';

@Component({
  selector: 'ui-welcome-view',
  imports: [RouterLink, HlmCardImports, HlmButtonImports, HlmBadgeImports, HlmSpinnerImports, NgIcon],
  providers: [provideIcons({ lucideBuilding2, lucideCheck, lucideMail })],
  templateUrl: './welcome-view.html',
})
export class WelcomeView {
  protected readonly authStore = inject(AuthStore);
  private readonly tenantService = inject(TenantClient);
  readonly invitations = input<MyInvitation[]>([]);
  readonly invitationHandled = output();
  protected readonly acceptingId = signal<string | null>(null);

  protected acceptInvitation(invitation: MyInvitation): void {
    this.acceptingId.set(invitation.id);
    this.tenantService.acceptInvitationById(invitation.id).subscribe({
      next: () => {
        this.acceptingId.set(null);
        this.invitationHandled.emit();
      },
      error: () => this.acceptingId.set(null),
    });
  }
}
