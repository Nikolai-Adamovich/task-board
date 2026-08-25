import { provideBrowserGlobalErrorListeners } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, {
  providers: [provideBrowserGlobalErrorListeners(), appConfig.providers],
}).catch((err) => console.error(err));
