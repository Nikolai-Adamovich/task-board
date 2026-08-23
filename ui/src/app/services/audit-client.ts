import { Service, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '@app/api-url.token';
import type { AuditEvent, AuditEntityType, PaginatedResponse } from '@task-board/shared';

/**
 * Pure HTTP client for audit endpoints — no state management.
 * All methods return Observables; the AuditLogViewer handles orchestration.
 *
 * NOTE: Audit responses are paginated — the full envelope { data, pagination }
 * is kept as-is per the project convention.
 */
@Service()
export class AuditClient {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  /** List audit events for a project (paginated, optionally filtered by entity type) */
  listByProject(
    projectId: string,
    page = 1,
    limit = 20,
    entityType?: AuditEntityType,
  ): Observable<PaginatedResponse<AuditEvent>> {
    let params = new HttpParams().set('page', page.toString()).set('limit', limit.toString());

    if (entityType) {
      params = params.set('entityType', entityType);
    }

    return this.http.get<PaginatedResponse<AuditEvent>>(`${this.apiBaseUrl}/projects/${projectId}/audit`, {
      params,
    });
  }

  /** List audit events for a tenant (paginated, optionally filtered by entity type) */
  listByTenant(
    tenantId: string,
    page = 1,
    limit = 20,
    entityType?: AuditEntityType,
  ): Observable<PaginatedResponse<AuditEvent>> {
    let params = new HttpParams().set('page', page.toString()).set('limit', limit.toString());

    if (entityType) {
      params = params.set('entityType', entityType);
    }

    return this.http.get<PaginatedResponse<AuditEvent>>(`${this.apiBaseUrl}/tenants/${tenantId}/audit`, {
      params,
    });
  }
}
