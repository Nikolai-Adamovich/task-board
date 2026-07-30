/**
 * Tests for the LandingPage component.
 *
 * Purely presentational component with no logic — verifies it creates successfully.
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { LandingPage } from './landing-page';
import { API_BASE_URL } from '@app/api-url.token';

describe('LandingPage', () => {
  function setup() {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_BASE_URL, useValue: 'http://localhost/api' },
      ],
    });
  }

  it('should create the component', () => {
    setup();

    const fixture = TestBed.createComponent(LandingPage);

    fixture.detectChanges();

    expect(fixture.componentInstance).toBeTruthy();
  });
});
