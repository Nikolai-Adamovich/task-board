/**
 * Tests for the Settings (preferences) component.
 *
 * Covers:
 * - Rendering of theme / zoom / language comboboxes
 * - V5-3: itemToString helpers resolve human labels for the closed trigger
 * - Change handlers delegate to the PreferencesStore
 * - BOTH per-mode theme selections are marked in the dropdown (Auto-mode UX fix)
 * - A cross-mode pick fires a neutral warning toast (with alert icon); a same-mode pick does not
 */
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { TranslocoTestingModule, TranslocoService } from '@jsverse/transloco';
import { signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { toast } from '@spartan-ng/brain/sonner';
import { Settings } from './settings';
import { PreferencesStore } from '@stores/preferences-store';
import { ThemeRegistry } from '@services/theme-registry';
import { ToastAlertIcon } from '@app/shared/toast-alert-icon/toast-alert-icon';

describe('Settings', () => {
  beforeEach(() => {
    // Spy on the sonner toast object directly — module mocking is unreliable
    // under the Angular vitest builder when several specs mock the same module.
    vi.spyOn(toast, 'warning').mockReturnValue('toast-id');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let component: any;
  let fixture: ComponentFixture<Settings>;
  let preferencesStoreMock: {
    zoom: ReturnType<typeof signal<number>>;
    themeMode: ReturnType<typeof signal<string>>;
    lightTheme: ReturnType<typeof signal<string | null>>;
    darkTheme: ReturnType<typeof signal<string | null>>;
    selectedTheme: ReturnType<typeof signal<string>>;
    effectiveTheme: ReturnType<typeof signal<string>>;
    language: ReturnType<typeof signal<string>>;
    dateFormat: ReturnType<typeof signal<string | null>>;
    timeFormat: ReturnType<typeof signal<string | null>>;
    setZoomLocal: ReturnType<typeof vi.fn>;
    commitZoom: ReturnType<typeof vi.fn>;
    setThemeChoiceLocal: ReturnType<typeof vi.fn>;
    commitTheme: ReturnType<typeof vi.fn>;
    setLanguage: ReturnType<typeof vi.fn>;
    setDateFormat: ReturnType<typeof vi.fn>;
    setTimeFormat: ReturnType<typeof vi.fn>;
  };
  let themeRegistryMock: { themes: ReturnType<typeof signal>; load: ReturnType<typeof vi.fn> };

  function setup() {
    preferencesStoreMock = {
      zoom: signal(100),
      themeMode: signal('auto'),
      lightTheme: signal('light'),
      darkTheme: signal('dark'),
      selectedTheme: signal('light'),
      effectiveTheme: signal('light'),
      language: signal('en'),
      dateFormat: signal(null),
      timeFormat: signal(null),
      setZoomLocal: vi.fn(),
      commitZoom: vi.fn(),
      // Simulate Auto mode with a light-preferring browser: light picks apply
      // immediately, dark picks stay deferred (effective theme unchanged).
      setThemeChoiceLocal: vi.fn((id: string, mode: 'light' | 'dark') => {
        if (mode === 'light') preferencesStoreMock.effectiveTheme.set(id);
      }),
      commitTheme: vi.fn(),
      setLanguage: vi.fn(),
      setDateFormat: vi.fn(),
      setTimeFormat: vi.fn(),
    };
    themeRegistryMock = {
      themes: signal([
        { id: 'light', name: 'Light', mode: 'light' },
        { id: 'dark', name: 'Dark', mode: 'dark' },
      ]),
      load: vi.fn().mockResolvedValue(undefined),
    };

    TestBed.configureTestingModule({
      imports: [
        TranslocoTestingModule.forRoot({
          langs: {
            en: {
              themes: {
                modeLight: 'Light',
                modeDark: 'Dark',
                deferredToast:
                  'Theme saved. It will be applied when Auto switches to {{mode}}, or switch the mode to {{mode}} now.',
              },
            },
          },
          translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
        }),
      ],
      providers: [
        { provide: PreferencesStore, useValue: preferencesStoreMock },
        { provide: ThemeRegistry, useValue: themeRegistryMock },
      ],
    });

    // V5-3: the language combobox resolves labels from Transloco's available langs
    const transloco = TestBed.inject(TranslocoService);

    vi.spyOn(transloco, 'getAvailableLangs').mockReturnValue([
      { id: 'en', label: 'English' },
      { id: 'de', label: 'Deutsch' },
    ] as never);

    fixture = TestBed.createComponent(Settings);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('should render the five preference cards', () => {
    setup();

    // hlmCard is an attribute directive rendered on plain divs
    const cards = fixture.nativeElement.querySelectorAll('[hlmCard]');

    expect(cards.length).toBe(5);
    expect(themeRegistryMock.load).toHaveBeenCalled();
  });

  // ── V5-3: closed triggers show human labels, not raw values ─────────────

  it('should map a theme id to its display name via itemToString', () => {
    setup();

    expect(component.themeName('dark')).toBe('Dark');
    // Unknown ids fall back to the raw value instead of rendering empty
    expect(component.themeName('contrast')).toBe('contrast');
  });

  it('should render zoom values with a percent sign via itemToString', () => {
    setup();

    expect(component.zoomLabel(100)).toBe('100%');
    expect(component.zoomLabel(150)).toBe('150%');
  });

  it('should map a locale code to its language name via itemToString', () => {
    setup();

    expect(component.languageLabel('de')).toBe('Deutsch');
    expect(component.languageLabel('xx')).toBe('xx');
  });

  // ── Change handlers ──────────────────────────────────────────────────────

  it('should commit dark-dropdown picks as a dark-mode choice', () => {
    setup();

    component.onDarkThemeChange('dark');

    expect(preferencesStoreMock.setThemeChoiceLocal).toHaveBeenCalledWith('dark', 'dark');
    expect(preferencesStoreMock.commitTheme).toHaveBeenCalled();
  });

  it('should commit light-dropdown picks as a light-mode choice', () => {
    setup();

    component.onLightThemeChange('light');

    expect(preferencesStoreMock.setThemeChoiceLocal).toHaveBeenCalledWith('light', 'light');
    expect(preferencesStoreMock.commitTheme).toHaveBeenCalled();
  });

  // ── Both per-mode selections are marked, regardless of the active mode ───

  it('should mark BOTH per-mode selections as selected in auto mode', () => {
    setup();

    expect(component.isLightSelected('light')).toBe(true);
    expect(component.isDarkSelected('dark')).toBe(true);
    // Non-selected themes are not marked — including cross-mode ones
    expect(component.isLightSelected('dark')).toBe(false);
    expect(component.isDarkSelected('light')).toBe(false);
    expect(component.isLightSelected('contrast')).toBe(false);
  });

  it('should fall back to the default theme ids when a per-mode choice is unset', () => {
    preferencesStoreMock.lightTheme.set(null);
    preferencesStoreMock.darkTheme.set(null);
    setup();

    expect(component.isLightSelected('light')).toBe(true);
    expect(component.isDarkSelected('dark')).toBe(true);
    expect(component.selectedLightTheme()).toBe('light');
    expect(component.selectedDarkTheme()).toBe('dark');
  });

  // ── Neutral warning toast on a "hidden" (cross-mode) pick ────────────────

  it('should show a neutral warning toast when the picked theme will not be applied now', async () => {
    setup();
    // Preload the lang so synchronous translate() resolves real strings
    await firstValueFrom(TestBed.inject(TranslocoService).selectTranslate('themes.deferredToast'));

    // Auto mode, browser prefers light → picking a dark theme is deferred
    component.onDarkThemeChange('dark');

    expect(toast.warning).toHaveBeenCalledTimes(1);
    expect(toast.warning).toHaveBeenCalledWith(
      'Theme saved. It will be applied when Auto switches to Dark, or switch the mode to Dark now.',
      expect.objectContaining({ icon: ToastAlertIcon }),
    );
  });

  it('should NOT show a toast when the picked theme is applied immediately', () => {
    setup();

    // Auto mode, browser prefers light → picking a light theme applies at once
    component.onLightThemeChange('light');

    expect(toast.warning).not.toHaveBeenCalled();
  });

  it('should commit numeric zoom changes through the store', () => {
    setup();

    component.onZoomChange('150');

    expect(preferencesStoreMock.setZoomLocal).toHaveBeenCalledWith(150);
    expect(preferencesStoreMock.commitZoom).toHaveBeenCalled();
  });

  it('should ignore non-finite zoom input', () => {
    setup();

    component.onZoomChange('auto');

    expect(preferencesStoreMock.setZoomLocal).not.toHaveBeenCalled();
    expect(preferencesStoreMock.commitZoom).not.toHaveBeenCalled();
  });

  it('should persist language changes through the store', () => {
    setup();

    component.onLanguageChange('de');

    expect(preferencesStoreMock.setLanguage).toHaveBeenCalledWith('de');
  });

  // ── R3-P8: date/time format preference ───────────────────────────────────

  it('should persist date format changes through the store', () => {
    setup();

    component.onDateFormatChange('DD/MM/YYYY');

    expect(preferencesStoreMock.setDateFormat).toHaveBeenCalledWith('DD/MM/YYYY');
  });

  it('should persist time format changes through the store', () => {
    setup();

    component.onTimeFormatChange('12h');

    expect(preferencesStoreMock.setTimeFormat).toHaveBeenCalledWith('12h');
  });

  // ── P12 (DEC-056): free-form custom date format ──────────────────────────

  it('should persist a valid custom date format live', () => {
    setup();

    component.onCustomDateFormatChange('DD MMM YY');

    expect(component.customFormat()).toBe('DD MMM YY');
    expect(component.customFormatInvalid()).toBe(false);
    expect(preferencesStoreMock.setDateFormat).toHaveBeenCalledWith('DD MMM YY');
  });

  it('should NOT persist an invalid custom date format and flag it', () => {
    setup();

    component.onCustomDateFormatChange('YYYY; DROP');

    expect(component.customFormat()).toBe('YYYY; DROP');
    expect(component.customFormatInvalid()).toBe(true);
    expect(preferencesStoreMock.setDateFormat).not.toHaveBeenCalled();
  });

  it('should not flag the untouched (empty) custom input as invalid', () => {
    setup();

    component.onCustomDateFormatChange('');

    expect(component.customFormatInvalid()).toBe(false);
    expect(preferencesStoreMock.setDateFormat).not.toHaveBeenCalled();
  });

  it('should keep the custom input in sync when a preset is picked', () => {
    setup();

    component.onDateFormatChange('MM/DD/YYYY');

    expect(component.customFormat()).toBe('MM/DD/YYYY');
  });

  it('should prefill the custom input with a stored custom format on init', () => {
    preferencesStoreMock.dateFormat = signal('DD MMM YY');
    TestBed.configureTestingModule({
      imports: [TranslocoTestingModule.forRoot({ langs: { en: {} } })],
      providers: [
        { provide: PreferencesStore, useValue: preferencesStoreMock },
        { provide: ThemeRegistry, useValue: themeRegistryMock },
      ],
    });
    fixture = TestBed.createComponent(Settings);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.customFormat()).toBe('DD MMM YY');
  });
});
