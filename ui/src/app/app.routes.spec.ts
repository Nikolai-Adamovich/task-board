/**
 * Tests for the legacy `/t/...` → `/w/...` compatibility redirect (Round 5).
 *
 * Old bookmarks/deep links must keep working: only the first URL segment is
 * rewritten, the rest of the path (plus query params and fragment) is preserved.
 */
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Component } from '@angular/core';
import { legacyTenantRedirectRoute } from './app.routes';

@Component({
  /* eslint-disable-next-line @angular-eslint/component-max-inline-declarations */
  template: '',
})
class Dummy {}

describe('legacyTenantRedirectRoute', () => {
  function setup() {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          legacyTenantRedirectRoute,
          { path: 'w/:tenantSlug', component: Dummy, children: [{ path: '**', component: Dummy }] },
          { path: '', component: Dummy },
          { path: '**', redirectTo: '' },
        ]),
      ],
    });

    return TestBed.inject(Router);
  }

  it('should rewrite only the first segment of a deep link', async () => {
    const router = setup();

    await router.navigateByUrl('/t/acme/projects/ABC/tasks/ABC-1');

    expect(router.url).toBe('/w/acme/projects/ABC/tasks/ABC-1');
  });

  it('should preserve query params and fragment', async () => {
    const router = setup();

    await router.navigateByUrl('/t/acme/projects/ABC/tasks?page=2&sort=due#row-3');

    expect(router.url).toBe('/w/acme/projects/ABC/tasks?page=2&sort=due#row-3');
  });

  it('should redirect the tenant home /t/:slug', async () => {
    const router = setup();

    await router.navigateByUrl('/t/acme');

    expect(router.url).toBe('/w/acme');
  });

  it('should send a bare /t through to the root fallback', async () => {
    const router = setup();

    await router.navigateByUrl('/t');

    expect(router.url).toBe('/');
  });

  it('should not match URLs that do not start with /t', async () => {
    const router = setup();

    await router.navigateByUrl('/workspace/create');

    expect(router.url).toBe('/');
  });
});
