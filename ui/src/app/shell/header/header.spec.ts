/**
 * Tests for the app header's mobile hamburger (Q6 / DEC-052a).
 *
 * Below md the Spartan sidebar renders as an offcanvas sheet; the hamburger
 * must be mobile-only (md:hidden) and open it via HlmSidebarService.
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { TranslocoService, TranslocoTestingModule } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { HlmSidebarService } from '@spartan-ng/helm/sidebar';
import { API_BASE_URL } from '@app/api-url.token';
import { clickUntil, settle } from '@app/shared/testing/zoneless';
import { Header } from './header';

describe('Header', () => {
  async function setup() {
    TestBed.configureTestingModule({
      imports: [TranslocoTestingModule.forRoot({ langs: { en: {} }, preloadLangs: true }), Header],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_BASE_URL, useValue: 'http://localhost/api' },
      ],
    });

    await firstValueFrom(TestBed.inject(TranslocoService).load('en'));

    const sidebarService = TestBed.inject(HlmSidebarService);
    const fixture = TestBed.createComponent(Header);

    await settle(fixture);

    return { fixture, sidebarService };
  }

  function findHamburger(fixture: ReturnType<typeof TestBed.createComponent<Header>>): HTMLButtonElement | null {
    const buttons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('button'));

    // class token is literally "md:hidden" (mobile-only visibility)
    return buttons.find((b) => b.classList.contains('md:hidden')) ?? null;
  }

  it('renders a mobile-only hamburger button', async () => {
    const { fixture } = await setup();
    const hamburger = findHamburger(fixture);

    expect(hamburger).toBeTruthy();
    expect(hamburger?.getAttribute('aria-label')).toBeTruthy();
  });

  it('opens the mobile sidebar sheet on click', async () => {
    const { fixture, sidebarService } = await setup();
    const spy = vi.spyOn(sidebarService, 'setOpenMobile');

    await clickUntil(
      () => findHamburger(fixture)?.click(),
      () => expect(spy).toHaveBeenCalledWith(true),
    );
  });
});
