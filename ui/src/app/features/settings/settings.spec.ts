/**
 * Tests for the Settings (preferences) component.
 *
 * Covers:
 * - Rendering of theme / zoom / language comboboxes
 * - V5-3: itemToString helpers resolve human labels for the closed trigger
 * - Change handlers delegate to the PreferencesStore
 */
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { TranslocoTestingModule, TranslocoService } from '@jsverse/transloco';
import { signal } from '@angular/core';
import { Settings } from './settings';
import { PreferencesStore } from '@stores/preferences-store';
import { ThemeRegistry } from '@services/theme-registry';

describe('Settings', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let component: any;
  let fixture: ComponentFixture<Settings>;
  let preferencesStoreMock: {
    zoom: ReturnType<typeof signal<number>>;
    theme: ReturnType<typeof signal<string>>;
    language: ReturnType<typeof signal<string>>;
    dateFormat: ReturnType<typeof signal<string | null>>;
    timeFormat: ReturnType<typeof signal<string | null>>;
    setZoomLocal: ReturnType<typeof vi.fn>;
    commitZoom: ReturnType<typeof vi.fn>;
    setThemeLocal: ReturnType<typeof vi.fn>;
    commitTheme: ReturnType<typeof vi.fn>;
    setLanguage: ReturnType<typeof vi.fn>;
    setDateFormat: ReturnType<typeof vi.fn>;
    setTimeFormat: ReturnType<typeof vi.fn>;
  };
  let themeRegistryMock: { themes: ReturnType<typeof signal>; load: ReturnType<typeof vi.fn> };

  function setup() {
    preferencesStoreMock = {
      zoom: signal(100),
      theme: signal('light'),
      language: signal('en'),
      dateFormat: signal(null),
      timeFormat: signal(null),
      setZoomLocal: vi.fn(),
      commitZoom: vi.fn(),
      setThemeLocal: vi.fn(),
      commitTheme: vi.fn(),
      setLanguage: vi.fn(),
      setDateFormat: vi.fn(),
      setTimeFormat: vi.fn(),
    };
    themeRegistryMock = {
      themes: signal([
        { id: 'light', name: 'Light' },
        { id: 'dark', name: 'Dark' },
      ]),
      load: vi.fn().mockResolvedValue(undefined),
    };

    TestBed.configureTestingModule({
      imports: [TranslocoTestingModule.forRoot({ langs: { en: {} } })],
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

  it('should commit theme changes through the store', () => {
    setup();

    component.onThemeChange('dark');

    expect(preferencesStoreMock.setThemeLocal).toHaveBeenCalledWith('dark');
    expect(preferencesStoreMock.commitTheme).toHaveBeenCalled();
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
});
