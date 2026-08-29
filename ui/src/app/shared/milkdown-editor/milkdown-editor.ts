import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
  effect,
  inject,
  input,
  output,
  signal,
  afterNextRender,
  PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideBold,
  lucideItalic,
  lucideStrikethrough,
  lucideCode,
  lucideLink,
  lucideList,
  lucideListOrdered,
  lucideListChecks,
  lucideQuote,
  lucideMinus,
  lucideHeading,
  lucideEye,
  lucideFileText,
} from '@ng-icons/lucide';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { HlmTextareaImports } from '@spartan-ng/helm/textarea';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmTooltipImports } from '@spartan-ng/helm/tooltip';
import { injectToasts } from '@app/shared/utils/toast-utils';
import { getErrorMessage } from '@app/shared/utils/error-utils';

/** Commands invocable from the toolbar */
type ToolbarCommand =
  | 'strong'
  | 'emphasis'
  | 'strikethrough'
  | 'inlineCode'
  | 'bulletList'
  | 'orderedList'
  | 'taskList'
  | 'blockquote'
  | 'codeBlock'
  | 'hr';

interface EditorBundle {
  action: (fn: unknown) => unknown;
  destroy: () => Promise<void>;
}

/** highlight.js grammars registered for code-block highlighting (order matches the imports in `initMilkdown`) */
const HIGHLIGHT_LANGUAGES = [
  'javascript',
  'typescript',
  'json',
  'bash',
  'python',
  'xml',
  'css',
  'sql',
  'yaml',
  'diff',
  'markdown',
  'plaintext',
] as const;

/**
 * Reusable WYSIWYG Markdown editor powered by Milkdown.
 *
 * - WYSIWYG mode: Milkdown (lazy-loaded) with a formatting toolbar.
 * - Raw mode: plain textarea showing the underlying markdown.
 * - Falls back to the textarea automatically if Milkdown fails to load.
 *
 * The value is always markdown (`contentChange` emits on every change),
 * so the backend keeps storing a plain markdown text field.
 */
@Component({
  selector: 'ui-milkdown-editor',
  imports: [TranslocoPipe, NgIcon, HlmSpinnerImports, HlmTextareaImports, HlmButtonImports, HlmTooltipImports],
  providers: [
    provideIcons({
      lucideBold,
      lucideItalic,
      lucideStrikethrough,
      lucideCode,
      lucideLink,
      lucideList,
      lucideListOrdered,
      lucideListChecks,
      lucideQuote,
      lucideMinus,
      lucideHeading,
      lucideEye,
      lucideFileText,
    }),
  ],
  templateUrl: './milkdown-editor.html',
  styleUrl: './milkdown-editor.css',
  encapsulation: ViewEncapsulation.None,
})
export class MilkdownEditor implements OnInit, OnDestroy {
  private readonly elRef = inject(ElementRef<HTMLElement>);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly notify = injectToasts();
  /** Markdown content input */
  readonly content = input<string>('');
  /** Whether the editor is read-only (hides toolbar, disables editing) */
  readonly readOnly = input<boolean>(false);
  /** Emits updated markdown whenever the editor content changes */
  readonly contentChange = output<string>();
  /** Emits `true` once the editor (or its fallback) is ready to be shown */
  readonly readyChange = output<boolean>();
  protected readonly editorReady = signal(false);
  protected readonly fallbackMode = signal(false);
  protected readonly fallbackContent = signal('');
  /** `'wysiwyg'` (Milkdown) or `'raw'` (markdown textarea) */
  protected readonly mode = signal<'wysiwyg' | 'raw'>('wysiwyg');
  private editorInstance: EditorBundle | null = null;
  private callCommandFn: ((key: unknown, payload?: unknown) => unknown) | null = null;
  private commands: Record<string, { key: unknown }> = {};
  /** Lazily-loaded `replaceAll` macro for in-place content updates */
  private replaceAllFn: ((markdown: string, flush?: boolean) => unknown) | null = null;
  /** Bumped on every teardown — invalidates any in-flight async initialization */
  private initEpoch = 0;
  /** Latest markdown emitted by the editor (may differ from input due to cleanup) */
  private lastMarkdown = '';
  /** Flag to suppress the content-change effect when the editor itself is the source */
  private suppressContentEffect = false;

  constructor() {
    // Watch for external content changes (e.g., after form submit clears the value)
    effect(() => {
      const newContent = this.content() ?? '';

      // Skip if the change came from the editor itself
      if (this.suppressContentEffect) {
        this.suppressContentEffect = false;
        return;
      }

      // Only apply if the editor is ready and content truly changed externally
      if (this.editorReady() && this.lastMarkdown !== newContent && this.replaceAllFn) {
        this.lastMarkdown = newContent;
        this.fallbackContent.set(newContent);
        // Update content in place via the `replaceAll` macro — no destroy/recreate
        this.editorInstance?.action(this.replaceAllFn(newContent));
      }
    });

    // Only initialize Milkdown in the browser (not SSR)
    afterNextRender(() => {
      if (isPlatformBrowser(this.platformId)) {
        const initial = this.content() ?? '';

        this.lastMarkdown = initial;
        void this.initMilkdown();
      }
    });
  }

  ngOnDestroy(): void {
    // Invalidate any in-flight initialization before tearing down
    this.initEpoch++;
    void this.editorInstance?.destroy();
    this.editorInstance = null;
  }

  /** Sync the raw-textarea value with the input on creation */
  ngOnInit(): void {
    this.fallbackContent.set(this.content() ?? '');
    this.lastMarkdown = this.content() ?? '';
  }

  // ─── Toolbar ───────────────────────────────────────────────────────────────

  protected runCommand(name: ToolbarCommand): void {
    const { editorInstance, callCommandFn, commands } = this;

    if (!editorInstance || !callCommandFn || !commands[name]) return;

    editorInstance.action(callCommandFn(commands[name].key));
  }

  protected runHeading(level: number): void {
    const { editorInstance, callCommandFn, commands } = this;

    if (!editorInstance || !callCommandFn || !commands['heading']) return;

    editorInstance.action(callCommandFn(commands['heading'].key, level));
  }

  /** Insert a link via prompt */
  protected insertLink(): void {
    const url = prompt('Enter URL:');

    if (!url) return;

    const { editorInstance, callCommandFn } = this;

    if (!editorInstance || !callCommandFn) return;

    const linkCmd = this.commands['link'];

    if (linkCmd) {
      editorInstance.action(callCommandFn(linkCmd.key, { href: url }));
    }
  }

  /** Toggle between WYSIWYG and raw markdown editing */
  protected toggleMode(): void {
    if (this.mode() === 'wysiwyg') {
      // Keep the current markdown before tearing the editor down
      this.fallbackContent.set(this.lastMarkdown);
      this.destroyEditor();
      this.mode.set('raw');
    } else {
      this.mode.set('wysiwyg');
      // Recreate the editor seeded with the raw markdown
      void this.initMilkdown(this.fallbackContent());
    }
  }

  // ─── Raw / fallback textarea ───────────────────────────────────────────────

  protected onRawInput(event: Event): void {
    const value = (event.target as HTMLTextAreaElement).value;

    this.fallbackContent.set(value);
    this.lastMarkdown = value;
    this.suppressContentEffect = true;
    this.contentChange.emit(value);
  }

  // ─── Internals ─────────────────────────────────────────────────────────────

  private enterFallbackMode(): void {
    this.fallbackMode.set(true);
    // The textarea fallback is immediately usable — count it as ready
    this.readyChange.emit(true);
  }

  private destroyEditor(): void {
    // Invalidate any in-flight initialization before tearing down
    this.initEpoch++;
    void this.editorInstance?.destroy();
    this.editorInstance = null;
    this.editorReady.set(false);
  }

  private async initMilkdown(seed?: string): Promise<void> {
    // Snapshot the epoch — if the editor is torn down while modules load, bail out
    const epoch = this.initEpoch;
    const isStale = () => epoch !== this.initEpoch;

    try {
      const [
        { Editor, rootCtx, defaultValueCtx, editorViewOptionsCtx },
        commonmarkPreset,
        gfmPreset,
        { listener, listenerCtx },
        { callCommand },
        { history },
        { highlight, highlightPluginConfig },
      ] = await Promise.all([
        import('@milkdown/kit/core'),
        import('@milkdown/kit/preset/commonmark'),
        import('@milkdown/kit/preset/gfm'),
        import('@milkdown/kit/plugin/listener'),
        import('@milkdown/kit/utils'),
        import('@milkdown/kit/plugin/history'),
        // Not part of @milkdown/kit — kept as a direct dependency
        import('@milkdown/plugin-highlight'),
      ]);

      if (isStale()) return;

      // Lazy-load lowlight with a curated grammar set. The `common` preset bundles
      // all 37 highlight.js grammars (~900 kB raw); this dozen covers real usage
      // in task descriptions and comments at a fraction of the size.
      const [{ createLowlight }, ...grammarImports] = await Promise.all([
        import('lowlight'),
        import('highlight.js/lib/languages/javascript'),
        import('highlight.js/lib/languages/typescript'),
        import('highlight.js/lib/languages/json'),
        import('highlight.js/lib/languages/bash'),
        import('highlight.js/lib/languages/python'),
        import('highlight.js/lib/languages/xml'),
        import('highlight.js/lib/languages/css'),
        import('highlight.js/lib/languages/sql'),
        import('highlight.js/lib/languages/yaml'),
        import('highlight.js/lib/languages/diff'),
        import('highlight.js/lib/languages/markdown'),
        import('highlight.js/lib/languages/plaintext'),
      ]);
      const lowlight = createLowlight(
        Object.fromEntries(grammarImports.map((m, i) => [HIGHLIGHT_LANGUAGES[i], m.default])),
      );
      const { createParser } = await import('@milkdown/plugin-highlight/lowlight');
      // A fence with an unregistered language (e.g. ```rust) must degrade to
      // plain text instead of throwing inside the highlighter.
      const highlightParser = createParser({
        highlight: (language, code) => {
          try {
            return lowlight.highlight(language, code);
          } catch {
            return lowlight.highlight('plaintext', code);
          }
        },
        highlightAuto: (code) => lowlight.highlightAuto(code),
      });
      const { replaceAll } = await import('@milkdown/kit/utils');

      if (isStale()) return;

      const host = this.elRef.nativeElement.querySelector('.milkdown-host') as HTMLElement | null;

      if (!host) {
        this.enterFallbackMode();
        return;
      }

      const editor = await Editor.make()
        .config((ctx) => {
          ctx.set(rootCtx, host);
          ctx.set(defaultValueCtx, seed ?? this.content() ?? '');
          ctx.get(listenerCtx).markdownUpdated((_ctx, markdown) => {
            // Clean up HTML artifacts that Milkdown may emit
            const cleaned = markdown.replace(/<br\s*\/?>/g, '').replace(/\n{3,}/g, '\n\n');

            this.lastMarkdown = cleaned;
            this.suppressContentEffect = true;
            this.contentChange.emit(cleaned);
          });
          // Configure highlight plugin for syntax highlighting in code blocks
          ctx.set(highlightPluginConfig.key, { parser: highlightParser });
          // Read-only mode at the ProseMirror level — no DOM hacks needed
          if (this.readOnly()) {
            ctx.update(editorViewOptionsCtx, (prev) => ({ ...prev, editable: () => false }));
          }
        })
        .use(commonmarkPreset.commonmark)
        .use(gfmPreset.gfm)
        .use(listener)
        .use(history)
        .use(highlight)
        .create();

      if (isStale()) {
        await editor.destroy();
        return;
      }

      this.commands = {
        strong: commonmarkPreset.toggleStrongCommand,
        emphasis: commonmarkPreset.toggleEmphasisCommand,
        strikethrough: gfmPreset.toggleStrikethroughCommand,
        inlineCode: commonmarkPreset.toggleInlineCodeCommand,
        bulletList: commonmarkPreset.wrapInBulletListCommand,
        orderedList: commonmarkPreset.wrapInOrderedListCommand,
        blockquote: commonmarkPreset.wrapInBlockquoteCommand,
        codeBlock: commonmarkPreset.createCodeBlockCommand,
        heading: commonmarkPreset.wrapInHeadingCommand,
        hr: commonmarkPreset.insertHrCommand,
      };
      this.callCommandFn = callCommand as (key: unknown, payload?: unknown) => unknown;
      this.replaceAllFn = replaceAll as (markdown: string, flush?: boolean) => unknown;
      this.editorInstance = {
        action: (fn: unknown) => editor.action(fn as never),
        destroy: async () => {
          await editor.destroy();
        },
      };
      this.editorReady.set(true);
      this.readyChange.emit(true);
    } catch (err) {
      // Milkdown failed to load — surface a toast and fall back to the textarea
      this.notify.error(getErrorMessage(err));
      this.enterFallbackMode();
    }
  }
}
