import { type ApplicationConfig, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideSpartanHlm } from '@spartan-ng/helm/utils';
import { routes } from './app.routes';
import { authInterceptor } from './interceptors/auth.interceptor';
import { tenantInterceptor } from './interceptors/tenant.interceptor';
import { errorInterceptor } from './interceptors/error.interceptor';
import { environment } from '../environments/environment';
import { API_BASE_URL } from './api-url.token';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideSpartanHlm(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor, tenantInterceptor, errorInterceptor])),
    { provide: API_BASE_URL, useValue: environment.apiBaseUrl },
  ],
};
