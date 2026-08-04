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
          { id: 'de', label: 'Deutsch' },
          { id: 'fr', label: 'Français' },
          { id: 'es', label: 'Español' },
          { id: 'pt', label: 'Português' },
          { id: 'it', label: 'Italiano' },
          { id: 'pl', label: 'Polski' },
          { id: 'ru', label: 'Русский' },
          { id: 'ja', label: '日本語' },
          { id: 'zh-Hans', label: '简体中文' },
          { id: 'ko', label: '한국어' },
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
