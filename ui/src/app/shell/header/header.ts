import { Component } from '@angular/core';
import { HeaderActions } from './header-actions/header-actions';
import { HeaderBranding } from './header-branding/header-branding';

@Component({
  selector: 'ui-header',
  imports: [HeaderBranding, HeaderActions],
  templateUrl: './header.html',
})
export class Header {}
