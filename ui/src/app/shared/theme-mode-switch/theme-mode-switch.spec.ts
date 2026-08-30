/**
 * Tests for the shared Auto/Light/Dark theme mode switch.
 *
 * Covers:
 * - Mode order: Auto first, then Light, then Dark
 * - Horizontal-only keyboard model: ArrowDown emits `navigateDown` (region
 *   navigation) and ArrowUp is a no-op — neither may fall through to the
 *   native vertical radio-group movement; Left/Right stay native (mode switch)
 * - `focusActive()` focuses the radio of the currently active mode
 */
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { TranslocoService, TranslocoTestingModule } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { signal } from '@angular/core';
import { ThemeModeSwitch } from './theme-mode-switch';
import { PreferencesStore } from '@stores/preferences-store';
import { settle } from '@app/shared/testing/zoneless';

describe('ThemeModeSwitch', () => {
  let fixture: ComponentFixture<ThemeModeSwitch>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let component: any;
  let setThemeModeLocal: ReturnType<typeof vi.fn>;

  async function setup(mode = 'auto'): Promise<void> {
    setThemeModeLocal = vi.fn();

    const preferencesStoreMock = {
      themeMode: signal(mode),
      setThemeModeLocal,
    };

    TestBed.configureTestingModule({
      imports: [
        TranslocoTestingModule.forRoot({
          langs: {
            en: { themes: { mode: 'Mode', modeAuto: 'Auto', modeLight: 'Light', modeDark: 'Dark' } },
          },
          translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
          preloadLangs: true,
        }),
      ],
      providers: [{ provide: PreferencesStore, useValue: preferencesStoreMock }],
    });

    await firstValueFrom(TestBed.inject(TranslocoService).load('en'));

    fixture = TestBed.createComponent(ThemeModeSwitch);
    component = fixture.componentInstance;
    await settle(fixture);
  }

  function radioValues(): string[] {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return [...(fixture.nativeElement as any).querySelectorAll('input[type="radio"]')].map(
      (i: HTMLInputElement) => i.value,
    );
  }

  function dispatchKey(key: string): { preventDefault: ReturnType<typeof vi.fn> } {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    const preventDefault = vi.spyOn(event, 'preventDefault');

    fixture.nativeElement.querySelector('hlm-radio-group').dispatchEvent(event);
    return { preventDefault };
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Mode order: Auto first ───────────────────────────────────────────────

  it('should render Auto first, then Light, then Dark', async () => {
    await setup();

    expect(radioValues()).toEqual(['auto', 'light', 'dark']);
  });

  // ── Horizontal-only keyboard model ───────────────────────────────────────

  it('should emit navigateDown on ArrowDown and prevent native vertical movement', async () => {
    await setup();

    const emitted: unknown[] = [];

    component.navigateDown.subscribe(() => emitted.push(true));

    const { preventDefault } = dispatchKey('ArrowDown');

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(emitted).toHaveLength(1);
    expect(setThemeModeLocal).not.toHaveBeenCalled();
  });

  it('should do nothing on ArrowUp (blocked, no navigation, no mode change)', async () => {
    await setup();

    const emitted: unknown[] = [];

    component.navigateDown.subscribe(() => emitted.push(true));

    const { preventDefault } = dispatchKey('ArrowUp');

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(emitted).toHaveLength(0);
    expect(setThemeModeLocal).not.toHaveBeenCalled();
  });

  it('should leave ArrowLeft/ArrowRight to the native radio group (mode switching)', async () => {
    await setup();

    const emitted: unknown[] = [];

    component.navigateDown.subscribe(() => emitted.push(true));

    const { preventDefault } = dispatchKey('ArrowRight');

    // NOT prevented — the native radio-group behavior switches the mode.
    expect(preventDefault).not.toHaveBeenCalled();
    expect(emitted).toHaveLength(0);
  });

  // ── focusActive ──────────────────────────────────────────────────────────

  it('should focus the radio of the currently active mode', async () => {
    await setup('dark');

    component.focusActive();

    const active = document.activeElement as HTMLInputElement | null;

    expect(active?.type).toBe('radio');
    expect(active?.value).toBe('dark');
  });
});
