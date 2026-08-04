import { Component } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'ui-settings',
  imports: [TranslocoPipe],
  templateUrl: './settings.html',
})
export class Settings {}
