import { CdkMenuTrigger } from '@angular/cdk/menu';
import { computed, Directive, effect, forwardRef, inject, input } from '@angular/core';
import { createMenuPosition, MENU_SIDE, type MenuAlign, type MenuSide } from '@spartan-ng/brain/core';
import { injectHlmDropdownMenuConfig } from './hlm-dropdown-menu-token';

@Directive({
  selector: '[hlmDropdownMenuTrigger]',
  providers: [{ provide: MENU_SIDE, useExisting: forwardRef(() => HlmDropdownMenuTrigger) }],
  hostDirectives: [
    {
      directive: CdkMenuTrigger,
      inputs: ['cdkMenuTriggerFor: hlmDropdownMenuTrigger', 'cdkMenuTriggerData: hlmDropdownMenuTriggerData'],
      outputs: ['cdkMenuOpened: hlmDropdownMenuOpened', 'cdkMenuClosed: hlmDropdownMenuClosed'],
    },
  ],
  host: { 'data-slot': 'dropdown-menu-trigger' },
})
export class HlmDropdownMenuTrigger {
  private readonly _cdkTrigger = inject(CdkMenuTrigger, { host: true });
  private readonly _config = injectHlmDropdownMenuConfig();

  /** P13 (item 31b): programmatic open/close for keyboard-shortcut coordination. */
  public toggle(): void {
    this._cdkTrigger.toggle();
  }

  /** P13b: open the menu (no-op when already open — CDK guards internally). */
  public open(): void {
    this._cdkTrigger.open();
  }

  /** P13b: close the menu (no-op when already closed). */
  public close(): void {
    this._cdkTrigger.close();
  }

  /** P13b: actual overlay state — callers must branch on this instead of blind-toggling. */
  public isOpen(): boolean {
    return this._cdkTrigger.isOpen();
  }

  /**
   * P13b: open the menu AND move focus into it. CDK only focuses the first item
   * when the trigger is activated via click/keydown (`_handleClick` /
   * `_toggleOnKeydown`); a programmatic `open()` attaches the overlay without
   * focusing, which left the menu keyboard-inert. The menu content renders in
   * the overlay after attach, so poll briefly for the `CdkMenu` to register
   * with this trigger before focusing its first item.
   */
  public openFocused(attempts = 10): void {
    this.open();

    if (attempts <= 0) return;

    setTimeout(() => {
      if (!this.isOpen()) return;

      const menu = this._cdkTrigger.getMenu();

      if (menu) menu.focusFirstItem('keyboard');
      else this.openFocused(attempts - 1);
    });
  }

  public readonly align = input<MenuAlign>(this._config.align);
  public readonly side = input<MenuSide>(this._config.side);
  public readonly disableHoverOpen = input(false);

  private readonly _menuPosition = computed(() => createMenuPosition(this.align(), this.side()));

  constructor() {
    // CDK sets transform-origin on the menu content from the resolved position; the content reads it to
    // animate from the anchored corner and to derive its data-side. Cast tolerates @angular/cdk < 21.2
    // (we still support >=21.0), where the property is absent and the assignment is a harmless no-op.
    (this._cdkTrigger as { transformOriginSelector?: string }).transformOriginSelector = '[data-slot="dropdown-menu"]';

    effect(() => {
      this._cdkTrigger.menuPosition = this._menuPosition();
      this.disableHoverOpen() && (this._cdkTrigger as any)._cleanupMouseenter?.();
    });
  }
}
