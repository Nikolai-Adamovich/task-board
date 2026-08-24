import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButtonImports } from '@spartan-ng/helm/button';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'ui-sign-in-button',
  standalone: true,
  imports: [HlmButtonImports, RouterLink, TranslocoPipe],
  templateUrl: './sign-in-button.html',
})
export class SignInButton {}
