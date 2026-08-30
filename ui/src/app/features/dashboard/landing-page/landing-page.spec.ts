/**
 * Tests for the LandingPage component.
 *
 * Purely presentational component with no logic — verifies it creates successfully.
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { TranslocoService, TranslocoTestingModule } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { settle } from '@app/shared/testing/zoneless';
import { LandingPage } from './landing-page';
import { API_BASE_URL } from '@app/api-url.token';

describe('LandingPage', () => {
  async function setup() {
    TestBed.configureTestingModule({
      imports: [TranslocoTestingModule.forRoot({ langs: { en: {} }, preloadLangs: true })],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_BASE_URL, useValue: 'http://localhost/api' },
      ],
    });

    await firstValueFrom(TestBed.inject(TranslocoService).load('en'));
  }

  it('should create the component', async () => {
    await setup();

    const fixture = TestBed.createComponent(LandingPage);

    await settle(fixture);

    expect(fixture.componentInstance).toBeTruthy();
  });
});
