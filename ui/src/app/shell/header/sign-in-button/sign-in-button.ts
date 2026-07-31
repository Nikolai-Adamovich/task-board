import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HlmButtonImports } from '@spartan-ng/helm/button';

@Component({
  selector: 'ui-sign-in-button',
  standalone: true,
  imports: [HlmButtonImports, RouterLink],
  templateUrl: './sign-in-button.html',
})
export class SignInButton {}
