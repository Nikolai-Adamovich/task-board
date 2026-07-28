import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Header } from '../header/header';
import { Sidebar } from '../sidebar/sidebar';

@Component({
  selector: 'ui-shell',
  imports: [RouterOutlet, Header, Sidebar],
  templateUrl: './app-shell.html',
})
export class AppShell {}
