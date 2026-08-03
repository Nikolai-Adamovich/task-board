import { type ApplicationConfig } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideSpartanHlm } from '@spartan-ng/helm/utils';
import { provideTransloco } from '@jsverse/transloco';
import { TranslocoHttpLoader } from './transloco-loader';
import { routes } from './app.routes';
import { authInterceptor } from './interceptors/auth.interceptor';
import { tenantInterceptor } from './interceptors/tenant.interceptor';
import { errorInterceptor } from './interceptors/error.interceptor';
import { environment } from '../environments/environment';
import { API_BASE_URL } from './api-url.token';

export const appConfig: ApplicationConfig = {
  providers: [
    provideSpartanHlm(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor, tenantInterceptor, errorInterceptor])),
    { provide: API_BASE_URL, useValue: environment.apiBaseUrl },
    provideTransloco({
      config: {
        prodMode: environment.production,
        availableLangs: [
          { id: 'en', label: 'English' },
          { id: 'pl', label: 'Polski' },
          { id: 'de', label: 'Deutsch' },
          { id: 'fr', label: 'Français' },
          { id: 'ru', label: 'Русский' },
        ],
        reRenderOnLangChange: true,
        fallbackLang: 'en',
        defaultLang: 'en',
        missingHandler: {
          useFallbackTranslation: true,
          logMissingKey: !environment.production,
        },
      },
      loader: TranslocoHttpLoader,
    }),
  ],
};
