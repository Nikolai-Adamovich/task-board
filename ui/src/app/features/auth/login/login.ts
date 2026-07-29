import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { form, FormField, submit, schema, required, email } from '@angular/forms/signals';
import { AuthClient } from '@services/auth-client';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { HttpErrorResponse } from '@angular/common/http';

interface LoginModel {
  email: string;
  password: string;
}

@Component({
  imports: [
    RouterLink,
    FormField,
    HlmCardImports,
    HlmFieldImports,
    HlmInputImports,
    HlmButtonImports,
    HlmSpinnerImports,
  ],
  selector: 'ui-login',
  templateUrl: './login.html',
})
export class Login {
  private readonly authService = inject(AuthClient);
  private readonly router = inject(Router);
  protected readonly error = signal('');
  private readonly model = signal<LoginModel>({ email: '', password: '' });
  protected readonly loginForm = form(
    this.model,
    schema<LoginModel>((field) => {
      required(field.email, { message: 'Email is required' });
      email(field.email, { message: 'Invalid email address' });
      required(field.password, { message: 'Password is required' });
    }),
    {
      submission: {
        action: async () => {
          this.error.set('');

          try {
            await this.authService.login(this.model());
            await this.router.navigateByUrl('/');
          } catch (err) {
            this.error.set(this.getErrorMessage(err));
          }
        },
      },
    },
  );

  private getErrorMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      return err.error?.message ?? err.message;
    }

    return 'Login failed. Please try again.';
  }

  protected onSubmit(): void {
    submit(this.loginForm);
  }
}
