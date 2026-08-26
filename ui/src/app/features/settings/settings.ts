import { Component, computed, inject, OnInit } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { DATE_FORMAT_PREFERENCES, TIME_FORMAT_PREFERENCES } from '@task-board/shared';
import type { DateFormatPreference, TimeFormatPreference } from '@task-board/shared';
import { PreferencesStore } from '@stores/preferences-store';
import { ThemeRegistry } from '@services/theme-registry';
import { ZOOM_VALUES } from '@shell/header/zoom.util';

interface LanguageOption {
  id: string;
  label: string;
}

/**
 * User preferences page: theme, zoom and language selection.
 * All changes are applied immediately via the PreferencesStore.
 */
@Component({
  selector: 'ui-settings',
  imports: [TranslocoPipe, HlmCardImports, HlmSelectImports, HlmButtonImports],
  templateUrl: './settings.html',
})
export class Settings implements OnInit {
  private readonly preferencesStore = inject(PreferencesStore);
  private readonly themeRegistry = inject(ThemeRegistry);
  private readonly transloco = inject(TranslocoService);
  protected readonly zoom = this.preferencesStore.zoom;
  protected readonly theme = this.preferencesStore.theme;
  protected readonly language = this.preferencesStore.language;
  /** R3-P8: date/time display format preferences */
  protected readonly dateFormat = this.preferencesStore.dateFormat;
  protected readonly timeFormat = this.preferencesStore.timeFormat;
  protected readonly dateFormatValues = DATE_FORMAT_PREFERENCES;
  protected readonly timeFormatValues = TIME_FORMAT_PREFERENCES;
  protected readonly themes = this.themeRegistry.themes;
  protected readonly availableLangs = computed(() => this.transloco.getAvailableLangs() as LanguageOption[]);
  protected readonly zoomValues = ZOOM_VALUES;

  ngOnInit(): void {
    void this.themeRegistry.load();
  }

  /** V5-3: itemToString — closed trigger shows the theme name, not the raw id */
  protected readonly themeName = (id: string): string => this.themes().find((t) => t.id === id)?.name ?? id;
  /** V5-3: itemToString — closed trigger shows "100%", not the raw number */
  protected readonly zoomLabel = (z: number | string): string => `${z}%`;
  /** V5-3: itemToString — closed trigger shows the language name, not the locale code */
  protected readonly languageLabel = (code: string): string =>
    this.availableLangs().find((l) => l.id === code)?.label ?? code;
  /** V7-5: itemToString — closed time-format trigger shows the option label, not the stored "12h"/"24h" */
  protected readonly timeFormatLabel = (value: string): string =>
    this.transloco.translate(value === '24h' ? 'settings.timeFormat24h' : 'settings.timeFormat12h');

  protected onZoomChange(value: string | number): void {
    const zoom = Number(value);

    if (Number.isFinite(zoom)) {
      this.preferencesStore.setZoomLocal(zoom);
      this.preferencesStore.commitZoom();
    }
  }

  protected onThemeChange(themeId: string): void {
    this.preferencesStore.setThemeLocal(themeId);
    this.preferencesStore.commitTheme();
  }

  protected onLanguageChange(lang: string): void {
    this.preferencesStore.setLanguage(lang);
  }

  /** R3-P8: persist the preferred date display format */
  protected onDateFormatChange(value: string | DateFormatPreference | null): void {
    this.preferencesStore.setDateFormat(value as DateFormatPreference);
  }

  /** R3-P8: persist the preferred time display format */
  protected onTimeFormatChange(value: string | TimeFormatPreference | null): void {
    this.preferencesStore.setTimeFormat(value as TimeFormatPreference);
  }
}
