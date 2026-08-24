import { ChangeDetectionStrategy, Component } from '@angular/core';
import { HeaderActions } from './header-actions/header-actions';
import { HeaderBranding } from './header-branding/header-branding';
import { HeaderSearch } from './header-search/header-search';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'ui-header',
  imports: [HeaderBranding, HeaderSearch, HeaderActions],
  templateUrl: './header.html',
})
export class Header {}
