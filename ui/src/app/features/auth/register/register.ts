import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { form, FormField, submit, schema, required, email, minLength, maxLength } from '@angular/forms/signals';
import { AuthStore } from '@stores/auth-store';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';

interface RegisterModel {
  displayName: string;
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
  selector: 'ui-register',
  templateUrl: './register.html',
})
export class Register {
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);
  protected readonly error = signal('');
  private readonly model = signal<RegisterModel>({ displayName: '', email: '', password: '' });
  protected readonly registerForm = form(
    this.model,
    schema<RegisterModel>((field) => {
      required(field.displayName, { message: 'Display name is required' });
      maxLength(field.displayName, 100, { message: 'Display name must be at most 100 characters' });
      required(field.email, { message: 'Email is required' });
      email(field.email, { message: 'Invalid email address' });
      required(field.password, { message: 'Password is required' });
      minLength(field.password, 8, { message: 'Password must be at least 8 characters' });
      maxLength(field.password, 128, { message: 'Password must be at most 128 characters' });
    }),
    {
      submission: {
        action: async () => {
          this.error.set('');

          try {
            await this.authStore.register(this.model());
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

    return 'Registration failed. Please try again.';
  }

  protected onSubmit(): void {
    submit(this.registerForm);
  }
}
