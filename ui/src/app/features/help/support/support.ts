import { Component, signal } from '@angular/core';
import { form, FormRoot, FormField, schema, required } from '@angular/forms/signals';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmTextareaImports } from '@spartan-ng/helm/textarea';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { HttpErrorResponse } from '@angular/common/http';

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
  protected readonly error = signal('');
  protected readonly model = signal<SupportModel>({ name: '', email: '', message: '' });
  protected readonly supportForm = form(
    this.model,
    schema<SupportModel>((field) => {
      required(field.name, { message: 'Name is required' });
      required(field.email, { message: 'Email is required' });
      required(field.message, { message: 'Message is required' });
    }),
    {
      submission: {
        action: async () => {
          this.error.set('');

          try {
            const modelValue = this.model();

            console.log('Support message submitted:', modelValue);
            this.model.set({ name: '', email: '', message: '' });
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

    return 'An unexpected error occurred. Please try again.';
  }
}
