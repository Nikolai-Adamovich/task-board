import { Component } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'ui-docs',
  imports: [TranslocoPipe],
  templateUrl: './docs.html',
})
export class Docs {}
