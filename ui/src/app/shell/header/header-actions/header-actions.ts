import { Component, inject } from '@angular/core';
import { AuthStore } from '@stores/auth-store';
import { HelpMenu } from '../help-menu/help-menu';
import { NotificationsButton } from '../notifications-button/notifications-button';
import { SignInButton } from '../sign-in-button/sign-in-button';
import { UserMenu } from '../user-menu/user-menu';

@Component({
  selector: 'ui-header-actions',
  imports: [UserMenu, NotificationsButton, SignInButton, HelpMenu],
  templateUrl: './header-actions.html',
})
export class HeaderActions {
  protected readonly authStore = inject(AuthStore);
}
