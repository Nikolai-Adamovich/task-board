import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Sidebar } from '../sidebar/sidebar';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'ui-shell',
  imports: [RouterOutlet, Sidebar],
  templateUrl: './app-shell.html',
})
export class AppShell {}
