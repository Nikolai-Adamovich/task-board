import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
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
  lucideCreditCard,
  lucidePlus,
} from '@ng-icons/lucide';
import type { TenantWithRole, MyTask } from '@task-board/shared';

const priorityColorMap: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  medium: 'bg-blue-100 text-blue-700',
  low: 'bg-gray-100 text-gray-600',
};

@Component({
  selector: 'ui-owner-dashboard',
  imports: [RouterLink, HlmCardImports, HlmButtonImports, HlmBadgeImports, NgIcon],
  providers: [
    provideIcons({
      lucideBuilding2,
      lucideLayoutDashboard,
      lucideArrowRight,
      lucideSettings,
      lucideUsers,
      lucideCreditCard,
      lucidePlus,
    }),
  ],
  templateUrl: './owner-dashboard.html',
})
export class OwnerDashboard {
  readonly tenants = input<TenantWithRole[]>([]);
  readonly tasks = input<MyTask[]>([]);

  protected getPriorityColor(priority: string): string {
    return priorityColorMap[priority] ?? 'bg-gray-100 text-gray-600';
  }

  protected get inProgressCount(): number {
    return this.tasks().filter((t) => t.columnTitle.toLowerCase().includes('progress')).length;
  }
}
