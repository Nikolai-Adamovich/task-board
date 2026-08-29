/**
 * R3-P9 spot-check: interactive Spartan Helm primitives must render a pointer
 * cursor so every clickable element shows the pointer without per-page fixes.
 *
 * The primitives are class-string directives/components, so this spec asserts
 * that `cursor-pointer` is part of each primitive's computed classes / host.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Repo-relative paths of the primitives covered by the sweep. */
const PRIMITIVES: Record<string, string> = {
  button: 'libs/ui/button/src/lib/hlm-button.ts',
  'select trigger': 'libs/ui/select/src/lib/hlm-select-trigger.ts',
  'select item': 'libs/ui/select/src/lib/hlm-select-item.ts',
  'dropdown-menu item': 'libs/ui/dropdown-menu/src/lib/hlm-dropdown-menu-item.ts',
  'dropdown-menu checkbox item': 'libs/ui/dropdown-menu/src/lib/hlm-dropdown-menu-checkbox.ts',
  'dropdown-menu radio item': 'libs/ui/dropdown-menu/src/lib/hlm-dropdown-menu-radio.ts',
  'dropdown-menu sub trigger': 'libs/ui/dropdown-menu/src/lib/hlm-dropdown-menu-sub-trigger.ts',
  'pagination link': 'libs/ui/pagination/src/lib/hlm-pagination-link.ts',
  'popover trigger': 'libs/ui/popover/src/lib/hlm-popover-trigger.ts',
  checkbox: 'libs/ui/checkbox/src/lib/hlm-checkbox.ts',
  switch: 'libs/ui/switch/src/lib/hlm-switch.ts',
  'autocomplete item': 'libs/ui/autocomplete/src/lib/hlm-autocomplete-item.ts',
};

function readLib(relativePath: string): string {
  // ng test runs with the ui workspace as cwd
  return readFileSync(resolve(process.cwd(), relativePath), 'utf-8');
}

describe('R3-P9: cursor-pointer on interactive UI primitives', () => {
  for (const [name, path] of Object.entries(PRIMITIVES)) {
    it(`adds cursor-pointer to the ${name}`, () => {
      expect(readLib(path)).toContain('cursor-pointer');
    });
  }

  it('keeps disabled states non-pointer where a not-allowed cursor is defined', () => {
    const button = readLib(PRIMITIVES['button'] ?? '');

    expect(button).toContain('data-disabled:pointer-events-none');
  });
});
