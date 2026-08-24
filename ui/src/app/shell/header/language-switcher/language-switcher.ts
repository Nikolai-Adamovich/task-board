import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCheck, lucideGlobe } from '@ng-icons/lucide';
import { HlmDropdownMenuItem, HlmDropdownMenu } from '@spartan-ng/helm/dropdown-menu';
import { PreferencesStore } from '@stores/preferences-store';

export interface LanguageOption {
  id: string;
  label: string;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'ui-language-switcher',
  imports: [NgIcon, HlmDropdownMenuItem, HlmDropdownMenu],
  providers: [provideIcons({ lucideGlobe, lucideCheck })],
  templateUrl: './language-switcher.html',
  host: {
    class: 'contents',
  },
})
export class LanguageSwitcher {
  private readonly transloco = inject(TranslocoService);
  private readonly preferencesStore = inject(PreferencesStore);
  protected readonly availableLangs = computed(() => this.transloco.getAvailableLangs() as LanguageOption[]);
  protected readonly activeLang = computed(() => this.transloco.getActiveLang());

  protected switchLanguage(lang: string): void {
    this.transloco.setActiveLang(lang);
    this.preferencesStore.setLanguage(lang);
  }
}
