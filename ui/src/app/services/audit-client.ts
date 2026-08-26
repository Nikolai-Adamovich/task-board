import { Service, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '@app/api-url.token';
import type { AuditEvent, AuditEntityType, PaginatedResponse } from '@task-board/shared';

/** R3-P7: list filters — all optional, URL-synced by the AuditLogViewer. */
export interface AuditListParams {
  page?: number;
  limit?: number;
  entityType?: AuditEntityType;
  action?: 'CREATED' | 'UPDATED' | 'DELETED';
  /** Actor user id */
  actorId?: string;
  /** Time sort direction — server default is desc (newest first) */
  sort?: 'asc' | 'desc';
}

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

  private buildParams(params: AuditListParams): HttpParams {
    let httpParams = new HttpParams()
      .set('page', (params.page ?? 1).toString())
      .set('limit', (params.limit ?? 20).toString());

    if (params.entityType) httpParams = httpParams.set('entityType', params.entityType);
    if (params.action) httpParams = httpParams.set('action', params.action);
    if (params.actorId) httpParams = httpParams.set('actorId', params.actorId);
    if (params.sort) httpParams = httpParams.set('sort', params.sort);

    return httpParams;
  }

  /** List audit events for a project (paginated, enriched with human-readable labels) */
  listByProject(projectId: string, params: AuditListParams = {}): Observable<PaginatedResponse<AuditEvent>> {
    return this.http.get<PaginatedResponse<AuditEvent>>(`${this.apiBaseUrl}/projects/${projectId}/audit`, {
      params: this.buildParams(params),
    });
  }

  /** List audit events for a tenant (paginated, enriched with human-readable labels) */
  listByTenant(tenantId: string, params: AuditListParams = {}): Observable<PaginatedResponse<AuditEvent>> {
    return this.http.get<PaginatedResponse<AuditEvent>>(`${this.apiBaseUrl}/tenants/${tenantId}/audit`, {
      params: this.buildParams(params),
    });
  }
}
