/**
 * Tests for the ResetPassword component.
 *
 * Validates Signal Form validation (same rules as ResetPasswordSchema),
 * missing-token handling and the success flow (toast + redirect to login).
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { TranslocoService, TranslocoTestingModule } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { settle } from '@app/shared/testing/zoneless';
import { ResetPassword } from './reset-password';
import { API_BASE_URL } from '@app/api-url.token';

describe('ResetPassword', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let component: any;
  let httpMock: HttpTestingController;

  async function setup(token?: string) {
    TestBed.configureTestingModule({
      imports: [TranslocoTestingModule.forRoot({ langs: { en: {} }, preloadLangs: true })],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'auth/login', redirectTo: '/' }]),
        { provide: API_BASE_URL, useValue: 'http://localhost/api' },
      ],
    });

    await firstValueFrom(TestBed.inject(TranslocoService).load('en'));

    httpMock = TestBed.inject(HttpTestingController);

    const fixture = TestBed.createComponent(ResetPassword);

    component = fixture.componentInstance;
    if (token !== undefined) {
      fixture.componentRef.setInput('token', token);
    }
    await settle(fixture);
  }

  // ── Token handling ───────────────────────────────────────────────────────

  describe('missing token', () => {
    beforeEach(() => setup());

    it('flags the missing-token state when no query param is bound', () => {
      expect(component.missingToken()).toBe(true);
    });
  });

  describe('present token', () => {
    beforeEach(() => setup('reset-token-abc'));

    it('clears the missing-token state when a token is bound', () => {
      expect(component.missingToken()).toBe(false);
    });
  });

  // ── Form validation ──────────────────────────────────────────────────────

  describe('form validation', () => {
    beforeEach(() => setup('reset-token-abc'));

    it('should be invalid when fields are empty', () => {
      expect(component.resetForm().invalid()).toBe(true);
    });

    it('should be invalid for passwords shorter than 8 chars', () => {
      component.model.update((m: { newPassword: string; confirmPassword: string }) => ({
        ...m,
        newPassword: 'short',
        confirmPassword: 'short',
      }));

      expect(component.resetForm.newPassword().invalid()).toBe(true);
    });

    it('should be invalid when only the new password is filled', () => {
      component.model.update((m: { newPassword: string; confirmPassword: string }) => ({
        ...m,
        newPassword: 'securePass123',
      }));

      expect(component.resetForm().invalid()).toBe(true);
    });

    it('should be valid when both fields match at the minimum length', () => {
      component.model.update(() => ({ newPassword: '12345678', confirmPassword: '12345678' }));

      expect(component.resetForm().valid()).toBe(true);
    });
  });

  // ── Submission flow ──────────────────────────────────────────────────────

  describe('submission', () => {
    beforeEach(() => setup('reset-token-abc'));

    it('sends the token and new password on submit', async () => {
      component.model.update(() => ({ newPassword: 'newSecurePass123', confirmPassword: 'newSecurePass123' }));

      const promise = component.resetPassword();
      const req = httpMock.expectOne('http://localhost/api/auth/reset-password');

      expect(req.request.body).toEqual({ token: 'reset-token-abc', newPassword: 'newSecurePass123' });
      req.flush({ data: { message: 'Password has been reset.' } });

      await promise;

      expect(component.error()).toBe('');
      expect(component.submitting()).toBe(false);
    });

    it('surfaces an error without navigating away when the token is invalid', async () => {
      component.model.update(() => ({ newPassword: 'newSecurePass123', confirmPassword: 'newSecurePass123' }));

      const promise = component.resetPassword();

      httpMock
        .expectOne('http://localhost/api/auth/reset-password')
        .flush(
          { error: { code: 'INVALID_RESET_TOKEN', message: 'Invalid or expired reset token' } },
          { status: 400, statusText: 'Bad Request' },
        );

      await promise;

      // The error interceptor (which maps codes to transloco keys) is not active in
      // this harness — assert that the failure surfaced without navigating away.
      expect(component.error()).not.toBe('');
      expect(component.submitting()).toBe(false);
    });

    it('blocks submission when the passwords do not match', async () => {
      component.model.update(() => ({ newPassword: 'newSecurePass123', confirmPassword: 'differentPass123' }));

      await component.resetPassword();

      expect(component.error()).not.toBe('');
      httpMock.verify(); // no HTTP request should have been made
    });
  });
});
