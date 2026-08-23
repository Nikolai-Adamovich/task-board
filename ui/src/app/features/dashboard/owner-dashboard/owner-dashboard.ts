import { Component, input } from '@angular/core';
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
import { PriorityColorMap, NeutralColor } from '@app/constants/priority';
import type { TenantWithRole, MyTask } from '@app/types/frontend';

@Component({
  selector: 'ui-owner-dashboard',
  imports: [RouterLink, TranslocoPipe, HlmCardImports, HlmButtonImports, HlmBadgeImports, NgIcon],
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
  readonly tenants = input<TenantWithRole[]>([]);
  readonly tasks = input<MyTask[]>([]);

  protected getPriorityColor(priority: string): string {
    return (PriorityColorMap as Record<string, string>)[priority] ?? NeutralColor;
  }

  protected getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-100 text-green-700';

      case 'ARCHIVED':
        return 'bg-yellow-100 text-yellow-700';

      case 'DELETION_PENDING':
        return 'bg-red-100 text-red-700';

      default:
        return 'bg-gray-100 text-gray-700';
    }
  }
}
