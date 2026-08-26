/**
 * Tests for the ForgotPassword component.
 *
 * Validates Signal Form validation (same rules as ForgotPasswordSchema) and
 * the neutral post-submit confirmation flow.
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { ForgotPassword } from './forgot-password';
import { API_BASE_URL } from '@app/api-url.token';

describe('ForgotPassword', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let component: any;
  let httpMock: HttpTestingController;

  function setup() {
    TestBed.configureTestingModule({
      imports: [TranslocoTestingModule.forRoot({ langs: { en: {} } })],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_BASE_URL, useValue: 'http://localhost/api' },
      ],
    });

    httpMock = TestBed.inject(HttpTestingController);

    const fixture = TestBed.createComponent(ForgotPassword);

    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  // ── Email validation ─────────────────────────────────────────────────────

  describe('form validation', () => {
    beforeEach(() => setup());

    it('should be invalid when email is empty', () => {
      expect(component.forgotForm.email().invalid()).toBe(true);
      expect(component.forgotForm.email().errors().length).toBeGreaterThan(0);
    });

    it('should be invalid for a malformed email', () => {
      component.model.update((m: { email: string }) => ({ ...m, email: 'not-an-email' }));

      expect(component.forgotForm.email().invalid()).toBe(true);
    });

    it('should be valid for a standard email', () => {
      component.model.update((m: { email: string }) => ({ ...m, email: 'user@example.com' }));

      expect(component.forgotForm.email().valid()).toBe(true);
    });
  });

  // ── Submission flow ──────────────────────────────────────────────────────

  describe('submission', () => {
    beforeEach(() => setup());

    it('shows the neutral confirmation after a successful request', async () => {
      expect(component.submitted()).toBe(false);

      const promise = component.requestReset();

      httpMock
        .expectOne('http://localhost/api/auth/forgot-password')
        .flush({ data: { message: 'If an account exists…' } });

      await promise;

      expect(component.submitted()).toBe(true);
      expect(component.error()).toBe('');
    });

    it('stays on the form and surfaces an error when the request fails', async () => {
      const promise = component.requestReset();

      httpMock
        .expectOne('http://localhost/api/auth/forgot-password')
        .flush({ error: { code: 'INTERNAL_ERROR', message: 'boom' } }, { status: 500, statusText: 'Server Error' });

      await promise;

      expect(component.submitted()).toBe(false);
      expect(component.error()).not.toBe('');
    });
  });
});
