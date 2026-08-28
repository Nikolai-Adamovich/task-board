import { TestBed } from '@angular/core/testing';
import type { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { PendingChangesService } from './pending-changes.service';
import { pendingChangesGuard, type PendingChanges } from './pending-changes.guard';

/**
 * P13b (Fix 4): the unsaved-changes confirmation — guard blocks when the page
 * reports pending changes, allows when pristine, and the promise resolves
 * according to the dialog choice (leave → true, stay → false).
 */
describe('PendingChanges', () => {
  let service: PendingChangesService;
  const snap = {} as ActivatedRouteSnapshot;
  const state = {} as RouterStateSnapshot;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PendingChangesService);
  });

  function run(component: PendingChanges | null): Promise<boolean> {
    return TestBed.runInInjectionContext(() =>
      pendingChangesGuard(component as PendingChanges, snap, state, state),
    ) as Promise<boolean>;
  }

  describe('pendingChangesGuard', () => {
    it('allows navigation when the component is pristine (no dialog)', async () => {
      const result = await run({ hasPendingChanges: () => false });

      expect(result).toBe(true);
      expect(service.open()).toBe(false);
    });

    it('allows navigation when there is no component instance', async () => {
      const result = await run(null);

      expect(result).toBe(true);
      expect(service.open()).toBe(false);
    });

    it('opens the dialog and blocks while dirty; "leave" resolves true', async () => {
      const navigation = run({ hasPendingChanges: () => true });

      // Guard is suspended with the dialog open
      await Promise.resolve();
      expect(service.open()).toBe(true);

      service.leave();

      await expect(navigation).resolves.toBe(true);
      expect(service.open()).toBe(false);
    });

    it('resolves false when the user stays', async () => {
      const navigation = run({ hasPendingChanges: () => true });

      await Promise.resolve();
      expect(service.open()).toBe(true);

      service.stay();

      await expect(navigation).resolves.toBe(false);
      expect(service.open()).toBe(false);
    });
  });

  describe('PendingChangesService', () => {
    it('resolves false for a second confirm while the dialog is already open', async () => {
      const first = service.confirm();
      const second = await service.confirm();

      expect(second).toBe(false);

      service.leave();

      await expect(first).resolves.toBe(true);
    });
  });
});
