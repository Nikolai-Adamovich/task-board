import { Component } from '@angular/core';
import { HeaderActions } from './header-actions/header-actions';
import { HeaderBranding } from './header-branding/header-branding';
import { HeaderSearch } from './header-search/header-search';

@Component({
  selector: 'ui-header',
  imports: [HeaderBranding, HeaderSearch, HeaderActions],
  templateUrl: './header.html',
})
export class Header {}
