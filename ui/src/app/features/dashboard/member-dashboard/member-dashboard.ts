import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { provideIcons, NgIcon } from '@ng-icons/core';
import { lucideBuilding2, lucideLayoutDashboard, lucideArrowRight } from '@ng-icons/lucide';
import { PriorityColorMap, NeutralColor } from '@app/constants/priority';
import type { TenantWithRole, MyTask } from '@task-board/shared';

@Component({
  selector: 'ui-member-dashboard',
  imports: [RouterLink, TranslocoPipe, HlmCardImports, HlmButtonImports, HlmBadgeImports, NgIcon],
  providers: [provideIcons({ lucideBuilding2, lucideLayoutDashboard, lucideArrowRight })],
  templateUrl: './member-dashboard.html',
})
export class MemberDashboard {
  readonly tenants = input<TenantWithRole[]>([]);
  readonly tasks = input<MyTask[]>([]);

  protected getPriorityColor(priority: string): string {
    return (PriorityColorMap as Record<string, string>)[priority] ?? NeutralColor;
  }
}
