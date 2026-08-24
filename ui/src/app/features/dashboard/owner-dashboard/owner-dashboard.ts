import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { provideIcons, NgIcon } from '@ng-icons/core';
import {
  lucideBuilding2,
  lucideLayoutDashboard,
  lucideArrowRight,
  lucideSettings,
  lucideUsers,
  lucidePlus,
} from '@ng-icons/lucide';
import { priorityBadgeClass, statusBadgeClass, roleBadgeClass } from '@app/constants/priority';
import type { TenantWithRole, MyTask } from '@app/types/frontend';
import { HlmEmptyImports } from '@spartan-ng/helm/empty';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'ui-owner-dashboard',
  imports: [HlmEmptyImports, RouterLink, TranslocoPipe, HlmCardImports, HlmButtonImports, HlmBadgeImports, NgIcon],
  providers: [
    provideIcons({
      lucideBuilding2,
      lucideLayoutDashboard,
      lucideArrowRight,
      lucideSettings,
      lucideUsers,
      lucidePlus,
    }),
  ],
  templateUrl: './owner-dashboard.html',
})
export class OwnerDashboard {
  /** Shared badge-class helpers (see constants/priority.ts) */
  protected readonly priorityBadgeClass = priorityBadgeClass;
  protected readonly statusBadgeClass = statusBadgeClass;
  protected readonly roleBadgeClass = roleBadgeClass;
  readonly tenants = input<TenantWithRole[]>([]);
  readonly tasks = input<MyTask[]>([]);
}
