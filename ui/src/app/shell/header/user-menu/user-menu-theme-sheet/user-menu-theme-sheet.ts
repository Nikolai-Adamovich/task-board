import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, model, signal } from '@angular/core';
import { ExpandState } from '@task-board/shared';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmSheetImports } from '@spartan-ng/helm/sheet';
import { PreferencesStore } from '@stores/preferences-store';
import { ThemeRegistry } from '@services/theme-registry';

/** Minimum button width in pixels (w-46 = 11.5rem = 184px) */
const MIN_BUTTON_WIDTH = 184;
/** Horizontal gap between grid items in pixels (gap-x-6 = 1.5rem = 24px) */
const GRID_GAP_X = 24;

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'ui-user-menu-theme-sheet',
  standalone: true,
  imports: [HlmSheetImports, HlmButtonImports, TranslocoPipe],
  templateUrl: './user-menu-theme-sheet.html',
})
export class UserMenuThemeSheet {
  private readonly destroyRef = inject(DestroyRef);
  protected readonly preferencesStore = inject(PreferencesStore);
  protected readonly themeRegistry = inject(ThemeRegistry);
  protected readonly open = model<ExpandState>(ExpandState.Closed);
  /** Minimum column width for CSS auto-fill grid */
  protected readonly minColumnWidth = `${MIN_BUTTON_WIDTH}px`;
  /** Currently focused theme during keyboard navigation (not yet applied) */
  protected readonly focusedTheme = signal<string | null>(null);

  constructor() {
    // Load manifest only when the sheet is actually opened by the user.
    effect(() => {
      if (this.open() === ExpandState.Open) {
        this.themeRegistry.load();
      }
    });

    // Commit pending theme to backend when the sheet is closed.
    effect(() => {
      if (this.open() === ExpandState.Closed) {
        this.preferencesStore.commitTheme();
      }
    });

    // Safety net: commit on component destroy (e.g. navigation while sheet is open).
    this.destroyRef.onDestroy(() => this.preferencesStore.commitTheme());
  }

  protected selectTheme(themeId: string): void {
    if (themeId !== this.preferencesStore.theme()) {
      this.preferencesStore.setThemeLocal(themeId);
    }
    this.focusedTheme.set(null);
  }

  /** Get the theme that should be visually highlighted (focused during navigation, or selected) */
  protected getHighlightedTheme(): string {
    return this.focusedTheme() ?? this.preferencesStore.theme();
  }

  /**
   * Compute the current number of columns from the grid DOM layout.
   * Used for keyboard navigation (ArrowUp/ArrowDown).
   */
  private computeColumns(gridEl: HTMLElement): number {
    const firstButton = gridEl.querySelector<HTMLElement>('button[data-theme]');

    if (!firstButton) return 1;

    const buttonWidth = firstButton.getBoundingClientRect().width;

    return Math.max(1, Math.floor((gridEl.clientWidth + GRID_GAP_X) / (buttonWidth + GRID_GAP_X)));
  }

  protected onThemeKeydown(event: KeyboardEvent): void {
    const themes = this.themeRegistry.themes();
    const currentHighlighted = this.getHighlightedTheme();
    const currentIndex = themes.findIndex((t) => t.id === currentHighlighted);
    const grid = event.currentTarget as HTMLElement;
    const cols = this.computeColumns(grid);
    const rows = Math.ceil(themes.length / cols);
    let nextIndex = currentIndex;

    if (event.key === 'ArrowRight') {
      const col = currentIndex % cols;

      if (col < cols - 1 && currentIndex + 1 < themes.length) {
        nextIndex = currentIndex + 1;
      }
    } else if (event.key === 'ArrowLeft') {
      const col = currentIndex % cols;

      if (col > 0) {
        nextIndex = currentIndex - 1;
      }
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();

      const row = Math.floor(currentIndex / cols);

      if (row < rows - 1) {
        nextIndex = Math.min(currentIndex + cols, themes.length - 1);
      }
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();

      const row = Math.floor(currentIndex / cols);

      if (row > 0) {
        nextIndex = currentIndex - cols;
      }
    } else if (event.key === 'Enter' || event.key === ' ') {
      // Don't scroll the block when space is pressed
      event.preventDefault();
      this.selectTheme(currentHighlighted);
      return;
    } else if (event.key === 'Escape') {
      // Cancel navigation, reset focus to current theme
      this.focusedTheme.set(null);
      return;
    } else {
      return;
    }

    const nextTheme = themes[nextIndex];

    if (nextTheme) {
      this.focusedTheme.set(nextTheme.id);

      const focusedButton = grid.querySelector(`[data-theme="${nextTheme.id}"]`);

      focusedButton?.scrollIntoView({ block: 'end', behavior: 'smooth' });
    }
  }
}
