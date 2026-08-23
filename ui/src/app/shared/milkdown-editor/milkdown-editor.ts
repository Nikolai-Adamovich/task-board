import {
  Component,
  ElementRef,
  OnInit,
  OnDestroy,
  inject,
  input,
  output,
  signal,
  afterNextRender,
  PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { HlmTextareaImports } from '@spartan-ng/helm/textarea';

/**
 * Reusable WYSIWYG Markdown editor powered by Milkdown.
 *
 * Uses dynamic import (lazy-loaded) to avoid adding Milkdown to the main bundle.
 * Falls back to a plain textarea if Milkdown fails to load.
 *
 * TODO: Replace textarea fallback with full Milkdown integration once
 * build pipeline is verified to handle the dynamic imports correctly.
 */
@Component({
  selector: 'ui-milkdown-editor',
  imports: [TranslocoPipe, HlmSpinnerImports, HlmTextareaImports],
  templateUrl: './milkdown-editor.html',
})
export class MilkdownEditor implements OnInit, OnDestroy {
  private readonly elRef = inject(ElementRef<HTMLElement>);
  private readonly platformId = inject(PLATFORM_ID);
  /** Markdown content input */
  readonly content = input<string>('');
  /** Emits updated markdown whenever the editor content changes */
  readonly contentChange = output<string>();
  protected readonly loading = signal(true);
  protected readonly editorReady = signal(false);
  protected readonly fallbackMode = signal(false);
  protected readonly fallbackContent = signal('');
  private destroyFn: (() => void) | null = null;

  constructor() {
    // Only initialize Milkdown in the browser (not SSR)
    afterNextRender(() => {
      if (isPlatformBrowser(this.platformId)) {
        this.initMilkdown();
      }
    });
  }

  ngOnInit(): void {
    // If not browser, enter fallback mode immediately
    if (!isPlatformBrowser(this.platformId)) {
      this.enterFallbackMode();
    }
    this.fallbackContent.set(this.content() ?? '');
  }

  ngOnDestroy(): void {
    this.destroyFn?.();
  }

  /** Handle textarea input in fallback mode */
  protected onFallbackInput(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    const value = textarea.value;

    this.fallbackContent.set(value);
    this.contentChange.emit(value);
  }

  private async initMilkdown(): Promise<void> {
    try {
      const [{ Editor, rootCtx, defaultValueCtx }, { commonmark }, { listener, listenerCtx }] = await Promise.all([
        import('@milkdown/core'),
        import('@milkdown/preset-commonmark'),
        import('@milkdown/plugin-listener'),
      ]);
      const host = this.elRef.nativeElement.querySelector('.milkdown-host') as HTMLElement | null;

      if (!host) {
        this.enterFallbackMode();
        return;
      }

      const editor = await Editor.make()
        .config((ctx) => {
          ctx.set(rootCtx, host);
          ctx.set(defaultValueCtx, this.content() ?? '');
          ctx.get(listenerCtx).markdownUpdated((_ctx, markdown) => {
            this.contentChange.emit(markdown);
          });
        })
        .use(commonmark)
        .use(listener)
        .create();

      this.destroyFn = () => {
        editor.destroy();
      };
      this.editorReady.set(true);
    } catch {
      // Milkdown failed to load — fall back to textarea
      this.enterFallbackMode();
    } finally {
      this.loading.set(false);
    }
  }

  private enterFallbackMode(): void {
    this.fallbackMode.set(true);
    this.loading.set(false);
  }
}
