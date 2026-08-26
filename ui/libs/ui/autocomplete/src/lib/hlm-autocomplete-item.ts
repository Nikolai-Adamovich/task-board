import { Component, inject } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCheck } from '@ng-icons/lucide';
import { BrnAutocompleteItem } from '@spartan-ng/brain/autocomplete';
import { classes } from '@spartan-ng/helm/utils';

@Component({
  selector: 'hlm-autocomplete-item',
  imports: [NgIcon],
  providers: [provideIcons({ lucideCheck })],
  hostDirectives: [{ directive: BrnAutocompleteItem, inputs: ['id', 'disabled', 'value'] }],
  host: { 'data-slot': 'autocomplete-item' },
  template: `
    <ng-content />
    @if (_active()) {
      <ng-icon
        name="lucideCheck"
        class="absolute end-2 flex items-center justify-center text-[length:--spacing(4)]"
        aria-hidden="true"
      />
    }
  `,
})
export class HlmAutocompleteItem {
  private readonly _brnAutocompleteItem = inject(BrnAutocompleteItem);

  protected readonly _active = this._brnAutocompleteItem.active;

  constructor() {
    classes(
      () =>
        'data-highlighted:bg-accent data-highlighted:text-accent-foreground not-data-[variant=destructive]:data-highlighted:**:text-accent-foreground gap-2 rounded-md py-1 ps-1.5 pe-8 text-sm relative flex w-full cursor-pointer items-center outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 data-disabled:cursor-not-allowed data-hidden:hidden [&_ng-icon]:pointer-events-none [&_ng-icon]:shrink-0',
    );
  }
}
