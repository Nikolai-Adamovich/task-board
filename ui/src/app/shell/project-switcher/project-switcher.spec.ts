/**
 * Tests for the ProjectSwitcher component (F-10 / D-47).
 *
 * Verifies creation, placeholder rendering without projects, active-project
 * detection and navigation on select.
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { TenantRole } from '@task-board/shared';
import type { Project } from '@task-board/shared';
import { ProjectSwitcher } from './project-switcher';
import { TenantStore } from '@stores/tenant-store';
import { AuthStore } from '@stores/auth-store';
import { API_BASE_URL } from '@app/api-url.token';

function makeProject(key: string, name: string): Project {
  return {
    id: `id-${key}`,
    tenantId: 'tenant-1',
    key,
    name,
    description: null,
    status: 'ACTIVE' as Project['status'],
    defaultStatusId: '',
    defaultBoardId: '',
    archiveReason: null,
    deletionScheduledAt: null,
    createdAt: '',
    updatedAt: '',
  };
}

describe('ProjectSwitcher', () => {
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

    const tenantStore = TestBed.inject(TenantStore);
    const router = TestBed.inject(Router);

    return { tenantStore, router };
  }

  it('should create the component', () => {
    setup();

    const fixture = TestBed.createComponent(ProjectSwitcher);

    fixture.detectChanges();

    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should show the select-project placeholder when no project is active', () => {
    setup();

    const fixture = TestBed.createComponent(ProjectSwitcher);

    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('projectSwitcher.selectProject');
  });

  it('should navigate to the project route on select', () => {
    const { tenantStore, router } = setup();
    const fixture = TestBed.createComponent(ProjectSwitcher);

    tenantStore.setActiveTenant({ id: 'tenant-1', slug: 'acme', name: 'Acme' } as never);
    fixture.detectChanges();

    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (fixture.componentInstance as any).selectProject(makeProject('PROJ', 'Project One'));

    expect(navigateSpy).toHaveBeenCalledWith(['/w', 'acme', 'projects', 'PROJ']);
  });

  it('should allow project creation for OWNER and ADMIN only', () => {
    const { tenantStore } = setup();
    const fixture = TestBed.createComponent(ProjectSwitcher);

    tenantStore.setActiveTenant({ id: 'tenant-1', slug: 'acme', name: 'Acme' } as never);

    const authStore = TestBed.inject(AuthStore);

    authStore.setTenantRole(TenantRole.MEMBER);
    fixture.detectChanges();
    expect(fixture.componentInstance['canCreateProject']()).toBe(false);

    authStore.setTenantRole(TenantRole.ADMIN);
    fixture.detectChanges();
    expect(fixture.componentInstance['canCreateProject']()).toBe(true);

    authStore.setTenantRole(TenantRole.OWNER);
    fixture.detectChanges();
    expect(fixture.componentInstance['canCreateProject']()).toBe(true);
  });

  it('should navigate to the tenant home (create dialog lives there) on create-project', () => {
    const { tenantStore, router } = setup();
    const fixture = TestBed.createComponent(ProjectSwitcher);

    tenantStore.setActiveTenant({ id: 'tenant-1', slug: 'acme', name: 'Acme' } as never);
    fixture.detectChanges();

    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (fixture.componentInstance as any).navigateToCreateProject();

    expect(navigateSpy).toHaveBeenCalledWith(['/w', 'acme']);
  });
});
