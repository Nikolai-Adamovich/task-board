import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCircleHelp, lucideBookOpen, lucideLifeBuoy } from '@ng-icons/lucide';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDropdownMenuImports } from '@spartan-ng/helm/dropdown-menu';

@Component({
  selector: 'ui-help-menu',
  standalone: true,
  imports: [RouterLink, NgIcon, HlmButtonImports, HlmDropdownMenuImports],
  providers: [provideIcons({ lucideCircleHelp, lucideBookOpen, lucideLifeBuoy })],
  templateUrl: './help-menu.html',
})
export class HelpMenu {}
