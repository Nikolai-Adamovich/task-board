import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { HlmButtonImports } from '@spartan-ng/helm/button';
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
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings.html',
})
export class Settings implements OnInit {
  private readonly preferencesStore = inject(PreferencesStore);
  private readonly themeRegistry = inject(ThemeRegistry);
  private readonly transloco = inject(TranslocoService);
  protected readonly zoom = this.preferencesStore.zoom;
  protected readonly theme = this.preferencesStore.theme;
  protected readonly language = this.preferencesStore.language;
  protected readonly themes = this.themeRegistry.themes;
  protected readonly availableLangs = computed(() => this.transloco.getAvailableLangs() as LanguageOption[]);
  protected readonly zoomValues = ZOOM_VALUES;

  ngOnInit(): void {
    void this.themeRegistry.load();
  }

  protected themeName(id: string): string {
    return this.themes().find((t) => t.id === id)?.name ?? id;
  }

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
}
