import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { provideIcons, NgIcon } from '@ng-icons/core';
import { lucideLayoutDashboard, lucideUsers, lucideFolderKanban, lucideBuilding2 } from '@ng-icons/lucide';

@Component({
  selector: 'ui-landing-page',
  imports: [RouterLink, HlmCardImports, HlmButtonImports, NgIcon],
  providers: [provideIcons({ lucideLayoutDashboard, lucideUsers, lucideFolderKanban, lucideBuilding2 })],
  templateUrl: './landing-page.html',
})
export class LandingPage {}
