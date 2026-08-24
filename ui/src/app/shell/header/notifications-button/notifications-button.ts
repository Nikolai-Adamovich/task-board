import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideBell } from '@ng-icons/lucide';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmSheetImports } from '@spartan-ng/helm/sheet';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'ui-notifications-button',
  standalone: true,
  imports: [NgIcon, HlmButtonImports, HlmSheetImports, TranslocoPipe],
  providers: [provideIcons({ lucideBell })],
  templateUrl: './notifications-button.html',
})
export class NotificationsButton {
  protected readonly sheetOpen = signal(false);
}
