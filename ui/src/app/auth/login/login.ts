import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthClient } from '../../services/auth-client';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';

@Component({
  imports: [RouterLink, HlmCardImports, HlmFieldImports, HlmInputImports, HlmButtonImports, HlmSpinnerImports],
  selector: 'app-login',
  templateUrl: './login.html',
})
export class Login {
  private readonly authService = inject(AuthClient);
  private readonly router = inject(Router);

  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly error = signal('');
  protected readonly loading = signal(false);

  protected onEmailInput(event: Event): void {
    this.email.set((event.target as HTMLInputElement).value);
  }

  protected onPasswordInput(event: Event): void {
    this.password.set((event.target as HTMLInputElement).value);
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    this.error.set('');
    this.loading.set(true);

    this.authService
      .login({
        email: this.email(),
        password: this.password(),
      })
      .subscribe({
        next: () => {
          this.loading.set(false);
          this.router.navigate(['/']);
        },
        error: (err) => {
          this.loading.set(false);
          this.error.set(err.error?.message ?? 'Login failed. Please try again.');
        },
      });
  }
}
