/**
 * Ambient declarations for imports kept lean on purpose.
 *
 * - `lowlight`: the tsconfig `paths` alias redirects the bare specifier to
 *   `lowlight/lib/index.js`, skipping the entry's `all`/`common` re-exports
 *   (182 highlight.js grammars, ~1 MB). The mapped `.js` file has no resolvable
 *   types, so the minimal surface used by the milkdown editor is declared here.
 * - `highlight.js/lib/languages/*`: the `./lib/languages/*` export condition
 *   has no `types` entry, so curated grammar imports need a declaration.
 */
declare module 'lowlight' {
  export interface Lowlight {
    highlight(language: string, value: string): import('hast').Root;
    highlightAuto(value: string): import('hast').Root;
    listLanguages(): string[];
    register(grammars: Record<string, import('highlight.js').LanguageFn>): void;
    registered(aliasOrName: string): boolean;
  }
  export function createLowlight(grammars?: Record<string, import('highlight.js').LanguageFn>): Lowlight;
}

declare module 'highlight.js/lib/languages/*' {
  const grammar: import('highlight.js').LanguageFn;

  export default grammar;
}
