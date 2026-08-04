import { Service, signal } from '@angular/core';
import type { ThemeManifestItem } from '@task-board/shared';

const MANIFEST_URL = '/themes/manifest.json';

/**
 * Responsible for discovering available themes by lazily loading
 * the generated manifest.json from /themes/.
 *
 * Caches the result in memory — subsequent calls reuse the cached data.
 * Theme loading (applying CSS) is a separate concern handled by ThemeLoader.
 */
@Service()
export class ThemeRegistry {
  private readonly _themes = signal<ThemeManifestItem[]>([]);
  private loading: Promise<void> | null = null;
  /** Read-only signal of available themes. Empty until the manifest is loaded. */
  readonly themes = this._themes.asReadonly();

  /**
   * Load the theme manifest from the server.
   * Idempotent — calling multiple times only fetches once.
   */
  async load(): Promise<void> {
    if (this._themes().length > 0) return;

    if (this.loading) return this.loading;

    this.loading = this.fetchManifest();

    return this.loading;
  }

  /**
   * Find a theme by its id.
   * Returns undefined if the manifest hasn't been loaded or the theme doesn't exist.
   */
  findById(id: string): ThemeManifestItem | undefined {
    return this._themes().find((t) => t.id === id);
  }

  private async fetchManifest(): Promise<void> {
    try {
      const response = await fetch(MANIFEST_URL);

      if (!response.ok) {
        console.warn(`ThemeRegistry: failed to fetch manifest (${response.status})`);

        return;
      }

      const data: ThemeManifestItem[] = await response.json();

      this._themes.set(data);
    } catch (err) {
      console.warn('ThemeRegistry: failed to load theme manifest', err);
    }
  }
}
