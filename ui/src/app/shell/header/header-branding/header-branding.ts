import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideLayoutDashboard } from '@ng-icons/lucide';

@Component({
  selector: 'ui-header-branding',
  standalone: true,
  imports: [RouterLink, NgIcon, TranslocoPipe],
  providers: [provideIcons({ lucideLayoutDashboard })],
  templateUrl: './header-branding.html',
})
export class HeaderBranding {}
