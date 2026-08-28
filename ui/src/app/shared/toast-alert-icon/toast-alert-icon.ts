import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideTriangleAlert } from '@ng-icons/lucide';

/**
 * Standalone alert icon used as the sonner toast `icon` (a `Type<unknown>`) for
 * destructive-styled toasts. Self-contained: provides its own lucide icon so it
 * can be rendered by the toaster inside an overlay without extra setup.
 */
@Component({
  selector: 'ui-toast-alert-icon',
  imports: [NgIcon],
  providers: [provideIcons({ lucideTriangleAlert })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './toast-alert-icon.html',
})
export class ToastAlertIcon {}
