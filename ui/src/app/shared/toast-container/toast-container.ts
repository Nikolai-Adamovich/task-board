import { Component, inject } from '@angular/core';
import { NotificationService } from '@services/notification.service';

@Component({
  selector: 'ui-toast-container',
  templateUrl: './toast-container.html',
})
export class ToastContainer {
  readonly notificationService = inject(NotificationService);

  getClasses(type: string): string {
    switch (type) {
      case 'success':
        return 'border-green-300 bg-green-50 text-green-800 dark:border-green-700 dark:bg-green-950 dark:text-green-200';

      case 'error':
        return 'border-red-300 bg-red-50 text-red-800 dark:border-red-700 dark:bg-red-950 dark:text-red-200';

      case 'warning':
        return 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200';

      default:
        return 'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-200';
    }
  }
}
