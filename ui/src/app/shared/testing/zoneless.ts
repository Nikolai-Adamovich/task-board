/**
 * Zoneless testing helpers (Angular 22).
 *
 * Canonical pattern: never call `fixture.detectChanges()`. Notify Angular
 * (setInput / events) and `await settle(fixture)`.
 *
 * `settle` waits for pending async work (`whenStable()`) and then forces a
 * synchronous scheduler flush (`TestBed.tick()`). The extra tick closes the
 * zoneless click race where a `(click)` listener attachment is queued as
 * scheduler work that `whenStable()` does not flush — a native
 * `nativeElement.click()` on a connected button would otherwise sometimes not
 * reach the Angular listener.
 *
 * `clickUntil` closes the residual race: it retries the native click until the
 * expected effect is observed (the assertion re-runs on every attempt).
 */
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { vi } from 'vitest';

const SETTLE_TIMEOUT_MS = 250;

export async function clickUntil(click: () => void, expectEffect: () => void, timeout = 2000): Promise<void> {
  await vi.waitFor(
    () => {
      click();
      expectEffect();
    },
    { timeout, interval: 10 },
  );
}

export async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
  // `whenStable()` never resolves while a resource/request is intentionally
  // left pending (e.g. a never-emitting mock) — bound the wait so specs that
  // poll signals still make progress. In healthy specs whenStable wins the
  // race long before the cap.
  await Promise.race([fixture.whenStable(), new Promise((r) => setTimeout(r, SETTLE_TIMEOUT_MS))]);
  TestBed.tick();
}
