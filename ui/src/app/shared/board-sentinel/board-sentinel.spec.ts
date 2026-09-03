/**
 * Tests for the BoardSentinel directive.
 *
 * The browser IntersectionObserver is stubbed: specs drive the captured
 * callback with intersecting / non-intersecting entries and assert the
 * emit + disabled guard contract.
 */
import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { BoardSentinel } from './board-sentinel';
import { settle } from '@app/shared/testing/zoneless';

type ObserverCallback = (entries: { isIntersecting: boolean }[]) => void;

let capturedCallback: ObserverCallback | null = null;
let disconnected = 0;

class StubObserver {
  static lastRoot: Element | null = null;

  constructor(callback: ObserverCallback, options?: { root?: Element | null }) {
    capturedCallback = callback;
    StubObserver.lastRoot = options?.root ?? null;
  }

  observe(): void {
    /* noop — the spec drives the callback manually */
  }

  disconnect(): void {
    disconnected += 1;
  }
}

@Component({
  templateUrl: './sentinel-host.html',
  imports: [BoardSentinel],
})
class SentinelHost {
  readonly disabled = signal(false);
  readonly fired = signal(false);
}

describe('BoardSentinel', () => {
  let fixture: ComponentFixture<SentinelHost>;
  let host: SentinelHost;

  beforeEach(() => {
    capturedCallback = null;
    disconnected = 0;
    vi.stubGlobal('IntersectionObserver', StubObserver);

    TestBed.configureTestingModule({});
    fixture = TestBed.createComponent(SentinelHost);
    host = fixture.componentInstance;
    host.disabled.set(false);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function emitIntersecting(isIntersecting: boolean): Promise<void> {
    await settle(fixture);
    capturedCallback?.([{ isIntersecting }]);
    await settle(fixture);
  }

  it('emits nearBottom when the sentinel enters the margin', async () => {
    await emitIntersecting(true);

    expect(host.fired()).toBe(true);
  });

  it('stays silent on non-intersecting callbacks', async () => {
    await emitIntersecting(false);

    expect(host.fired()).toBe(false);
  });

  it('never fires while disabled (exhausted column or active load)', async () => {
    host.disabled.set(true);
    await settle(fixture);
    await emitIntersecting(true);

    expect(host.fired()).toBe(false);
  });

  it('observes with the scroll container as root and disconnects on destroy', async () => {
    await settle(fixture);

    expect(capturedCallback).not.toBeNull();
    expect(StubObserver.lastRoot).not.toBeNull();

    fixture.destroy();

    expect(disconnected).toBe(1);
  });
});
