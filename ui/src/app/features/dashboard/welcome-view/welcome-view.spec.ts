/**
 * Tests for the WelcomeView component.
 *
 * Covers:
 * - acceptInvitation method
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { WelcomeView } from './welcome-view';
import { TenantClient } from '@services/tenant-client';
import { AuthStore } from '@stores/auth-store';
import { API_BASE_URL } from '@app/api-url.token';
import type { User } from '@task-board/shared';
import type { MyInvitation } from '@app/types/frontend';

const NOW = '2025-01-01T00:00:00Z';
const mockInvitations: MyInvitation[] = [
  { id: 'inv1', tenantId: 't1', tenantName: 'Acme', role: 'MEMBER', invitedEmail: 'a@b.com', invitedAt: NOW },
];

describe('WelcomeView', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let component: any;
  let tenantClientMock: { acceptInvitationById: ReturnType<typeof vi.fn> };
  let authStoreMock: { currentUser: ReturnType<typeof vi.fn> };

  function setup() {
    tenantClientMock = {
      acceptInvitationById: vi.fn().mockReturnValue(of({ success: true })),
    };
    authStoreMock = {
      currentUser: vi.fn().mockReturnValue({ id: 'u1', displayName: 'Test' } as User),
    };

    TestBed.configureTestingModule({
      imports: [TranslocoTestingModule.forRoot({ langs: { en: {} } })],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_BASE_URL, useValue: 'http://localhost/api' },
        { provide: TenantClient, useValue: tenantClientMock },
        { provide: AuthStore, useValue: authStoreMock },
      ],
    });

    const fixture = TestBed.createComponent(WelcomeView);

    fixture.componentRef.setInput('invitations', mockInvitations);

    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  describe('acceptInvitation', () => {
    beforeEach(() => setup());

    it('should call tenantClient.acceptInvitationById', () => {
      component.acceptInvitation(mockInvitations[0]);

      expect(tenantClientMock.acceptInvitationById).toHaveBeenCalledWith('inv1');
    });

    it('should clear acceptingId after success', () => {
      component.acceptInvitation(mockInvitations[0]);

      expect(component.acceptingId()).toBeNull();
    });

    it('should emit invitationHandled after success', () => {
      const emitted = vi.fn();

      component.invitationHandled.subscribe(emitted);
      component.acceptInvitation(mockInvitations[0]);

      expect(emitted).toHaveBeenCalled();
    });

    it('should clear acceptingId on error', () => {
      tenantClientMock.acceptInvitationById.mockReturnValueOnce(throwError(() => new Error('fail')));
      component.acceptInvitation(mockInvitations[0]);

      expect(component.acceptingId()).toBeNull();
    });
  });
});
