import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'ui-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
})
export class App {}
