/**
 * Tests for ProjectStore — background members loading and reactive project role.
 *
 * Covers the deep-link critical-path optimization: `loadProjectByKey` resolves
 * as soon as the project itself is fetched; members load in the background and
 * the `projectRole` computed updates reactively (OWNER/ADMIN bypass, MEMBER
 * from membership, stale-response guard against cross-project races).
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ProjectStore } from './project-store';
import { AuthStore } from '@stores/auth-store';
import { API_BASE_URL } from '@app/api-url.token';
import type { Project, ProjectMember, User } from '@task-board/shared';

const BASE = 'http://localhost/api';

function makeProject(id: string): Project {
  return { id, name: `Project ${id}`, key: id.toUpperCase() } as unknown as Project;
}

function member(id: string, projectId: string, userId: string, role: string): ProjectMember {
  return { id, projectId, userId, role } as unknown as ProjectMember;
}

describe('ProjectStore — background members + reactive projectRole', () => {
  let store: ProjectStore;
  let authStore: AuthStore;
  let httpMock: HttpTestingController;

  function setup(): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_BASE_URL, useValue: BASE },
      ],
    });

    store = TestBed.inject(ProjectStore);
    authStore = TestBed.inject(AuthStore);
    httpMock = TestBed.inject(HttpTestingController);
  }

  afterEach(() => {
    httpMock.verify();
  });

  it('resolves loadProjectByKey without waiting for members (members request fired in background)', async () => {
    setup();

    const promise = store.loadProjectByKey('t1', 'KEY');

    httpMock.expectOne(`${BASE}/projects/by-key/KEY`).flush({ data: makeProject('p1') });

    const project = await promise;

    expect(project.id).toBe('p1');
    expect(store.activeProject()?.id).toBe('p1');
    expect(store.loading()).toBe(false);

    // The members request was already issued but did NOT block the promise —
    // it is only flushed after the loadProjectByKey promise has resolved.
    httpMock.expectOne(`${BASE}/projects/p1/members`).flush({ data: [] });
  });

  it('derives PROJECT_ADMIN for a tenant OWNER immediately, without members', async () => {
    setup();
    authStore.setTenantRole('OWNER');

    const promise = store.loadProjectByKey('t1', 'KEY');

    httpMock.expectOne(`${BASE}/projects/by-key/KEY`).flush({ data: makeProject('p1') });
    await promise;

    expect(store.projectRole()).toBe('PROJECT_ADMIN');

    // The role is derived without members — flush the background request.
    httpMock.expectOne(`${BASE}/projects/p1/members`).flush({ data: [] });
  });

  it('derives PROJECT_ADMIN for a tenant ADMIN immediately, without members', async () => {
    setup();
    authStore.setTenantRole('ADMIN');

    const promise = store.loadProjectByKey('t1', 'KEY');

    httpMock.expectOne(`${BASE}/projects/by-key/KEY`).flush({ data: makeProject('p1') });
    await promise;

    expect(store.projectRole()).toBe('PROJECT_ADMIN');

    // The role is derived without members — flush the background request.
    httpMock.expectOne(`${BASE}/projects/p1/members`).flush({ data: [] });
  });

  it('derives the membership role for a tenant MEMBER once members arrive', async () => {
    setup();
    authStore.setTenantRole('MEMBER');
    authStore.currentUser.set({ id: 'u1' } as User);

    const promise = store.loadProjectByKey('t1', 'KEY');

    httpMock.expectOne(`${BASE}/projects/by-key/KEY`).flush({ data: makeProject('p1') });
    await promise;

    // Members have not arrived yet — the role is not resolved.
    expect(store.projectRole()).toBeNull();

    httpMock.expectOne(`${BASE}/projects/p1/members`).flush({
      data: [member('m1', 'p1', 'u-other', 'VIEWER'), member('m2', 'p1', 'u1', 'EDITOR')],
    });

    await vi.waitFor(() => expect(store.projectRole()).toBe('EDITOR'));
  });

  it('leaves the role null for a tenant MEMBER without project membership', async () => {
    setup();
    authStore.setTenantRole('MEMBER');
    authStore.currentUser.set({ id: 'u1' } as User);

    const promise = store.loadProjectByKey('t1', 'KEY');

    httpMock.expectOne(`${BASE}/projects/by-key/KEY`).flush({ data: makeProject('p1') });
    await promise;

    httpMock.expectOne(`${BASE}/projects/p1/members`).flush({
      data: [member('m1', 'p1', 'u-other', 'VIEWER')],
    });

    await vi.waitFor(() => expect(store.members().length).toBe(1));
    expect(store.projectRole()).toBeNull();
  });

  it('discards a stale members response after navigating to another project', async () => {
    setup();
    authStore.setTenantRole('MEMBER');
    authStore.currentUser.set({ id: 'u1' } as User);

    // Load project A (its members request goes in flight)…
    const first = store.loadProjectByKey('t1', 'KEYA');

    httpMock.expectOne(`${BASE}/projects/by-key/KEYA`).flush({ data: makeProject('pA') });
    await first;

    // …then navigate to project B before A's members response arrives.
    const second = store.loadProjectByKey('t1', 'KEYB');

    httpMock.expectOne(`${BASE}/projects/by-key/KEYB`).flush({ data: makeProject('pB') });
    await second;

    // A's members response arrives late — it must be discarded, not merged
    // into project B's context.
    httpMock.expectOne(`${BASE}/projects/pA/members`).flush({
      data: [member('mA', 'pA', 'u1', 'VIEWER')],
    });

    // B's members response applies.
    httpMock.expectOne(`${BASE}/projects/pB/members`).flush({
      data: [member('mB', 'pB', 'u1', 'EDITOR')],
    });

    await vi.waitFor(() => expect(store.members().some((m) => m.id === 'mB')).toBe(true));
    expect(store.members().some((m) => m.id === 'mA')).toBe(false);
    expect(store.projectRole()).toBe('EDITOR');
  });

  it('does not fail loadProjectByKey when the background members request errors', async () => {
    setup();
    authStore.setTenantRole('MEMBER');
    authStore.currentUser.set({ id: 'u1' } as User);

    const promise = store.loadProjectByKey('t1', 'KEY');

    httpMock.expectOne(`${BASE}/projects/by-key/KEY`).flush({ data: makeProject('p1') });

    const project = await promise;

    expect(project.id).toBe('p1');

    httpMock.expectOne(`${BASE}/projects/p1/members`).flush('boom', { status: 500, statusText: 'Server Error' });

    // Members are non-critical: the project context stays intact, members stay empty.
    expect(store.activeProject()?.id).toBe('p1');
    expect(store.members()).toEqual([]);
  });

  it('clears members and resets the role with clearProject', async () => {
    setup();
    authStore.setTenantRole('OWNER');

    const promise = store.loadProjectByKey('t1', 'KEY');

    httpMock.expectOne(`${BASE}/projects/by-key/KEY`).flush({ data: makeProject('p1') });
    await promise;

    httpMock.expectOne(`${BASE}/projects/p1/members`).flush({
      data: [member('m1', 'p1', 'u1', 'EDITOR')],
    });

    await vi.waitFor(() => expect(store.members().length).toBe(1));
    expect(store.projectRole()).toBe('PROJECT_ADMIN');

    store.clearProject();

    expect(store.activeProject()).toBeNull();
    expect(store.members()).toEqual([]);
    expect(store.projectRole()).toBeNull();
  });
});
