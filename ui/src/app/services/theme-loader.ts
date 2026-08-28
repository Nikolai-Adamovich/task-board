import { Service } from '@angular/core';

const THEMES_DIR = '/themes';

/**
 * Responsible for applying a theme by dynamically loading its CSS stylesheet.
 * Does NOT know which themes exist — that is ThemeRegistry's job.
 */
@Service()
export class ThemeLoader {
  private currentThemeLink?: HTMLLinkElement;
  private loadToken = 0;

  /**
   * Load and apply a theme CSS file.
   * @param themeId The theme identifier (e.g., "light", "dark", "claude").
   */
  async loadTheme(themeId: string): Promise<void> {
    const token = ++this.loadToken;
    const newLink = document.createElement('link');

    newLink.rel = 'stylesheet';
    newLink.href = `${THEMES_DIR}/${themeId}.css`;
    newLink.dataset.theme = themeId;

    await new Promise<void>((resolve, reject) => {
      newLink.onload = () => resolve();
      newLink.onerror = () => reject(new Error(`Failed to load theme "${themeId}"`));

      document.head.appendChild(newLink);
    });

    if (token !== this.loadToken) {
      newLink.remove();
      return;
    }

    this.currentThemeLink?.remove();
    this.currentThemeLink = newLink;
  }
}
