import { Component, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideSearch, lucideX } from '@ng-icons/lucide';
import { HlmInputImports } from '@spartan-ng/helm/input';

@Component({
  selector: 'ui-header-search',
  standalone: true,
  imports: [NgIcon, HlmInputImports, TranslocoPipe],
  providers: [provideIcons({ lucideSearch, lucideX })],
  templateUrl: './header-search.html',
})
export class HeaderSearch {
  protected readonly searchValue = signal('');
}
