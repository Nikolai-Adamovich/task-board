import { Component, inject } from '@angular/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { PreferencesStore } from '@stores/preferences-store';
import { getNextZoom } from '../../zoom.util';

@Component({
  selector: 'ui-user-menu-zoom-controls',
  standalone: true,
  imports: [HlmButtonImports],
  templateUrl: './user-menu-zoom-controls.html',
})
export class UserMenuZoomControls {
  protected readonly preferencesStore = inject(PreferencesStore);

  protected zoomOut(): void {
    this.preferencesStore.setZoom(getNextZoom(this.preferencesStore.zoom(), 'out'));
  }

  protected zoomIn(): void {
    this.preferencesStore.setZoom(getNextZoom(this.preferencesStore.zoom(), 'in'));
  }
}
