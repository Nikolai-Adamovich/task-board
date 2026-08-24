import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { provideIcons, NgIcon } from '@ng-icons/core';
import { lucideBuilding2, lucideLayoutDashboard, lucideArrowRight } from '@ng-icons/lucide';
import { priorityBadgeVariant, statusBadgeVariant, roleBadgeVariant } from '@app/constants/priority';
import type { TenantWithRole, MyTask } from '@app/types/frontend';
import { HlmEmptyImports } from '@spartan-ng/helm/empty';

@Component({
  selector: 'ui-member-dashboard',
  imports: [HlmEmptyImports, RouterLink, TranslocoPipe, HlmCardImports, HlmButtonImports, HlmBadgeImports, NgIcon],
  providers: [provideIcons({ lucideBuilding2, lucideLayoutDashboard, lucideArrowRight })],
  templateUrl: './member-dashboard.html',
})
export class MemberDashboard {
  /** Shared badge-class helpers (see constants/priority.ts) */
  protected readonly priorityBadgeVariant = priorityBadgeVariant;
  protected readonly statusBadgeVariant = statusBadgeVariant;
  protected readonly roleBadgeVariant = roleBadgeVariant;
  readonly tenants = input<TenantWithRole[]>([]);
  readonly tasks = input<MyTask[]>([]);
}
