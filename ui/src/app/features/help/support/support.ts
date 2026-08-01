import { Component, signal, inject } from '@angular/core';
import { form, FormRoot, FormField, schema, required, email, maxLength } from '@angular/forms/signals';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmTextareaImports } from '@spartan-ng/helm/textarea';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { HttpErrorResponse } from '@angular/common/http';
import { SupportClient } from '@services/support-client';

interface SupportModel {
  name: string;
  email: string;
  message: string;
}

@Component({
  selector: 'ui-support',
  imports: [
    FormRoot,
    FormField,
    HlmFieldImports,
    HlmInputImports,
    HlmTextareaImports,
    HlmButtonImports,
    HlmSpinnerImports,
  ],
  templateUrl: './support.html',
})
export class Support {
  private readonly supportClient = inject(SupportClient);
  protected readonly error = signal('');
  protected readonly success = signal(false);
  private readonly model = signal<SupportModel>({ name: '', email: '', message: '' });
  private readonly createdAt = signal(Date.now());
  protected readonly supportForm = form(
    this.model,
    schema<SupportModel>((field) => {
      required(field.name, { message: 'Name is required' });
      maxLength(field.name, 200, { message: 'Name must be at most 200 characters' });
      required(field.email, { message: 'Email is required' });
      email(field.email, { message: 'Invalid email address' });
      required(field.message, { message: 'Message is required' });
      maxLength(field.message, 2000, { message: 'Message must be at most 2000 characters' });
    }),
    {
      submission: {
        action: async (f) => {
          this.error.set('');
          this.success.set(false);

          this.supportClient
            .submit({
              ...this.model(),
              createdAt: this.createdAt(),
            })
            .subscribe({
              next: () => {
                this.success.set(true);
                f().reset({ name: '', email: '', message: '' });
                this.createdAt.set(Date.now());
              },
              error: (err) => {
                this.error.set(this.getErrorMessage(err));
              },
            });
        },
      },
    },
  );

  private getErrorMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      return err.error?.message ?? err.message;
    }

    return 'An unexpected error occurred. Please try again.';
  }
}
