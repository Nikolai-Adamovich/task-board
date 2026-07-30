import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { form, FormField, submit, schema, required, minLength, maxLength } from '@angular/forms/signals';
import { TenantClient } from '@services/tenant-client';
import { AuthStore } from '@stores/auth-store';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import type { InvitationDetails } from '@task-board/shared';

interface InvitationFormModel {
  displayName: string;
  password: string;
  confirmPassword: string;
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
    HlmBadgeImports,
  ],
  selector: 'ui-accept-invitation',
  templateUrl: './accept-invitation.html',
})
export class AcceptInvitation implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly tenantClient = inject(TenantClient);
  private readonly authStore = inject(AuthStore);
  protected readonly loading = signal(true);
  protected readonly submitting = signal(false);
  protected readonly error = signal('');
  protected readonly invitation = signal<InvitationDetails | null>(null);
  private readonly token = signal('');
  private readonly model = signal<InvitationFormModel>({ displayName: '', password: '', confirmPassword: '' });
  protected readonly invitationForm = form(
    this.model,
    schema<InvitationFormModel>((field) => {
      required(field.displayName, { message: 'Display name is required' });
      maxLength(field.displayName, 100, { message: 'Display name must be at most 100 characters' });
      required(field.password, { message: 'Password is required' });
      minLength(field.password, 8, { message: 'Password must be at least 8 characters' });
      maxLength(field.password, 128, { message: 'Password must be at most 128 characters' });
      required(field.confirmPassword, { message: 'Please confirm your password' });
    }),
    {
      submission: {
        action: async () => {
          await this.acceptAsNewUser();
        },
      },
    },
  );

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');

    if (!token) {
      this.error.set('No invitation token provided.');
      this.loading.set(false);
      return;
    }

    this.token.set(token);

    this.tenantClient.getInvitationDetails(token).subscribe({
      next: (details) => {
        this.invitation.set(details);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(err.error?.message ?? 'Invalid or expired invitation.');
        this.loading.set(false);
      },
    });
  }

  protected async acceptAsNewUser(): Promise<void> {
    const invitation = this.invitation();

    if (!invitation) return;

    const modelValue = this.model();

    if (modelValue.password !== modelValue.confirmPassword) {
      this.error.set('Passwords do not match.');
      return;
    }

    this.error.set('');
    this.submitting.set(true);

    this.tenantClient
      .acceptInvitation({
        token: this.token(),
        password: modelValue.password,
        displayName: modelValue.displayName,
      })
      .subscribe({
        next: (res) => {
          this.authStore.setSession(res);
          this.router.navigateByUrl('/');
        },
        error: (err: HttpErrorResponse) => {
          this.error.set(err.error?.message ?? 'Failed to accept invitation.');
          this.submitting.set(false);
        },
      });
  }

  protected acceptAsExistingUser(): void {
    this.error.set('');
    this.submitting.set(true);

    this.tenantClient
      .acceptInvitation({
        token: this.token(),
      })
      .subscribe({
        next: (res) => {
          this.authStore.setSession(res);
          this.router.navigateByUrl('/');
        },
        error: (err: HttpErrorResponse) => {
          this.error.set(err.error?.message ?? 'Failed to accept invitation.');
          this.submitting.set(false);
        },
      });
  }

  protected onSubmit(): void {
    submit(this.invitationForm);
  }
}
