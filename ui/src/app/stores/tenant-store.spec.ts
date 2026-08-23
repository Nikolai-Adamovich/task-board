/**
 * Tests for the TenantStore.
 *
 * Covers:
 * - loadTenants: fetches tenants, restores active tenant from localStorage, defaults to first
 * - createTenant: adds to list and sets as active
 * - updateTenant: syncs active tenant and list
 * - deleteTenant: removes from list, reassigns active tenant
 * - archiveTenant / restoreTenant / cancelDeletion: lifecycle status updates
 * - setActiveTenant: persists to localStorage
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TenantStore } from './tenant-store';
import { API_BASE_URL } from '@app/api-url.token';
import type { TenantWithRole } from '@app/types/frontend';

const TENANT_KEY = 'taskboard_tenant_id';
const NOW = '2025-01-01T00:00:00Z';
const mockTenants: TenantWithRole[] = [
  {
    id: 't1',
    name: 'Acme',
    description: null,
    status: 'ACTIVE',
    deletionScheduledAt: null,
    role: 'OWNER',
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 't2',
    name: 'Globex',
    description: null,
    status: 'ACTIVE',
    deletionScheduledAt: null,
    role: 'MEMBER',
    createdAt: NOW,
    updatedAt: NOW,
  },
];

describe('TenantStore', () => {
  let httpMock: HttpTestingController;

  function createModule() {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://localhost/api' },
      ],
    });

    httpMock = TestBed.inject(HttpTestingController);
  }

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    httpMock?.verify();
    localStorage.clear();
  });

  // ── loadTenants ─────────────────────────────────────────────────────────

  describe('loadTenants', () => {
    it('should fetch tenants and populate the signal', async () => {
      createModule();

      const store = TestBed.inject(TenantStore);
      const promise = store.loadTenants();
      const req = httpMock.expectOne('http://localhost/api/tenants');

      expect(req.request.method).toBe('GET');
      req.flush({ data: mockTenants });

      const result = await promise;

      expect(result).toEqual(mockTenants);
      expect(store.tenants()).toEqual(mockTenants);
    });

    it('should restore active tenant from localStorage', async () => {
      localStorage.setItem(TENANT_KEY, 't2');
      createModule();

      const store = TestBed.inject(TenantStore);
      const promise = store.loadTenants();

      httpMock.expectOne('http://localhost/api/tenants').flush({ data: mockTenants });

      await promise;

      expect(store.activeTenant()?.id).toBe('t2');
    });

    it('should default to first tenant if localStorage has no match', async () => {
      createModule();

      const store = TestBed.inject(TenantStore);
      const promise = store.loadTenants();

      httpMock.expectOne('http://localhost/api/tenants').flush({ data: mockTenants });

      await promise;

      expect(store.activeTenant()?.id).toBe('t1');
    });

    it('should set activeTenant to null when tenant list is empty', async () => {
      createModule();

      const store = TestBed.inject(TenantStore);
      const promise = store.loadTenants();

      httpMock.expectOne('http://localhost/api/tenants').flush({ data: [] });

      await promise;

      expect(store.activeTenant()).toBeNull();
    });
  });

  // ── createTenant ────────────────────────────────────────────────────────

  describe('createTenant', () => {
    it('should create tenant, add to list, and set as active', async () => {
      createModule();

      const store = TestBed.inject(TenantStore);
      // Pre-load tenants
      const loadPromise = store.loadTenants();

      httpMock.expectOne('http://localhost/api/tenants').flush({ data: [mockTenants[0]] });
      await loadPromise;

      const newTenant = {
        id: 't3',
        name: 'NewCo',
        description: null,
        status: 'ACTIVE',
        deletionScheduledAt: null,
        createdAt: '2025-06-01T00:00:00Z',
        updatedAt: '2025-06-01T00:00:00Z',
      };
      const createPromise = store.createTenant({ name: 'NewCo' });
      const req = httpMock.expectOne('http://localhost/api/tenants');

      expect(req.request.method).toBe('POST');
      req.flush({ data: newTenant });

      const result = await createPromise;

      expect(result.role).toBe('OWNER');
      expect(store.tenants()).toHaveLength(2);
      expect(store.activeTenant()?.id).toBe('t3');
    });
  });

  // ── updateTenant ────────────────────────────────────────────────────────

  describe('updateTenant', () => {
    it('should update tenant in list and active tenant', async () => {
      createModule();

      const store = TestBed.inject(TenantStore);
      const loadPromise = store.loadTenants();

      httpMock.expectOne('http://localhost/api/tenants').flush({ data: [...mockTenants] });
      await loadPromise;

      expect(store.activeTenant()?.name).toBe('Acme');

      const updated = { ...mockTenants[0], name: 'Acme Corp' };
      const updatePromise = store.updateTenant('t1', { name: 'Acme Corp' });
      const req = httpMock.expectOne('http://localhost/api/tenants/t1');

      expect(req.request.method).toBe('PATCH');
      req.flush({ data: updated });

      const result = await updatePromise;

      expect(result.name).toBe('Acme Corp');
      expect(store.activeTenant()?.name).toBe('Acme Corp');
      expect(store.tenants().find((t) => t.id === 't1')?.name).toBe('Acme Corp');
    });
  });

  // ── deleteTenant ────────────────────────────────────────────────────────

  describe('deleteTenant', () => {
    it('should remove tenant from list and reassign active tenant', async () => {
      createModule();

      const store = TestBed.inject(TenantStore);
      const loadPromise = store.loadTenants();

      httpMock.expectOne('http://localhost/api/tenants').flush({ data: [...mockTenants] });
      await loadPromise;

      expect(store.activeTenant()?.id).toBe('t1');

      const deletePromise = store.deleteTenant('t1');
      const req = httpMock.expectOne('http://localhost/api/tenants/t1');

      expect(req.request.method).toBe('DELETE');
      req.flush({ data: { success: true } });

      await deletePromise;

      expect(store.tenants()).toHaveLength(1);
      expect(store.tenants()[0].id).toBe('t2');
      expect(store.activeTenant()?.id).toBe('t2');
    });

    it('should set activeTenant to null when last tenant is deleted', async () => {
      createModule();

      const store = TestBed.inject(TenantStore);
      const loadPromise = store.loadTenants();

      httpMock.expectOne('http://localhost/api/tenants').flush({ data: [mockTenants[0]] });
      await loadPromise;

      const deletePromise = store.deleteTenant('t1');

      httpMock.expectOne('http://localhost/api/tenants/t1').flush({ data: { success: true } });

      await deletePromise;

      expect(store.tenants()).toHaveLength(0);
      expect(store.activeTenant()).toBeNull();
      expect(localStorage.getItem(TENANT_KEY)).toBeNull();
    });
  });

  // ── archiveTenant ───────────────────────────────────────────────────────

  describe('archiveTenant', () => {
    it('should update tenant status to ARCHIVED', async () => {
      createModule();

      const store = TestBed.inject(TenantStore);
      const loadPromise = store.loadTenants();

      httpMock.expectOne('http://localhost/api/tenants').flush({ data: [...mockTenants] });
      await loadPromise;

      const archivePromise = store.archiveTenant('t1');

      httpMock.expectOne('http://localhost/api/tenants/t1/archive').flush({ data: { success: true } });

      await archivePromise;

      expect(store.tenants().find((t) => t.id === 't1')?.status).toBe('ARCHIVED');
      expect(store.activeTenant()?.status).toBe('ARCHIVED');
    });
  });

  // ── restoreTenant ───────────────────────────────────────────────────────

  describe('restoreTenant', () => {
    it('should update tenant status to ACTIVE', async () => {
      createModule();

      const store = TestBed.inject(TenantStore);
      const loadPromise = store.loadTenants();

      httpMock.expectOne('http://localhost/api/tenants').flush({ data: [...mockTenants] });
      await loadPromise;

      // First archive
      const archivePromise = store.archiveTenant('t1');

      httpMock.expectOne('http://localhost/api/tenants/t1/archive').flush({ data: { success: true } });

      await archivePromise;

      expect(store.activeTenant()?.status).toBe('ARCHIVED');

      // Then restore
      const restorePromise = store.restoreTenant('t1');

      httpMock.expectOne('http://localhost/api/tenants/t1/restore').flush({ data: { success: true } });

      await restorePromise;

      expect(store.activeTenant()?.status).toBe('ACTIVE');
    });
  });

  // ── cancelDeletion ──────────────────────────────────────────────────────

  describe('cancelDeletion', () => {
    it('should update tenant status to ACTIVE', async () => {
      createModule();

      const store = TestBed.inject(TenantStore);
      const loadPromise = store.loadTenants();

      httpMock.expectOne('http://localhost/api/tenants').flush({ data: [...mockTenants] });
      await loadPromise;

      const cancelPromise = store.cancelDeletion('t1');

      httpMock.expectOne('http://localhost/api/tenants/t1/cancel-deletion').flush({ data: { success: true } });

      await cancelPromise;

      expect(store.activeTenant()?.status).toBe('ACTIVE');
    });
  });

  // ── setActiveTenant ─────────────────────────────────────────────────────

  describe('setActiveTenant', () => {
    it('should persist tenant ID to localStorage', () => {
      createModule();

      const store = TestBed.inject(TenantStore);

      store.setActiveTenant(mockTenants[1]);

      expect(store.activeTenant()?.id).toBe('t2');
      expect(localStorage.getItem(TENANT_KEY)).toBe('t2');
    });
  });
});
