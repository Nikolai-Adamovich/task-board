import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthClient } from '@services/auth-client';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';

@Component({
  imports: [RouterLink, HlmCardImports, HlmFieldImports, HlmInputImports, HlmButtonImports, HlmSpinnerImports],
  selector: 'ui-register',
  templateUrl: './register.html',
})
export class Register {
  private readonly authService = inject(AuthClient);
  private readonly router = inject(Router);
  protected readonly displayName = signal('');
  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly error = signal('');
  protected readonly loading = signal(false);

  protected onDisplayNameInput(event: Event): void {
    this.displayName.set((event.target as HTMLInputElement).value);
  }

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
      .register({
        displayName: this.displayName(),
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
          this.error.set(err.error?.message ?? 'Registration failed. Please try again.');
        },
      });
  }
}
