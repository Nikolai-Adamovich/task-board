import { Service, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '@app/api-url.token';
import type { SupportRequest } from '@task-board/shared';

/**
 * Pure HTTP client for the support endpoint.
 */
@Service()
export class SupportClient {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  /** Submit a support message. */
  submit(data: SupportRequest & { website?: string; createdAt: number }): Observable<{ success: true }> {
    return this.http.post<{ success: true }>(`${this.apiBaseUrl}/support`, data);
  }
}
