import { ActivatedRoute } from '@angular/router';

/**
 * Find the `tenantId` path parameter by walking **up** the route tree.
 *
 * Path params are NOT inherited downwards by default (`paramsInheritanceStrategy:
 * 'emptyOnly'`), so each ancestor segment must be checked individually — walking
 * to the root and reading its paramMap would return nothing.
 *
 * All tenant-scoped routes live under `/tenants/:tenantId`.
 */
export function getTenantId(route: ActivatedRoute): string {
  let current: ActivatedRoute | null = route;

  while (current) {
    const tenantId = current.snapshot.paramMap.get('tenantId');

    if (tenantId) return tenantId;

    current = current.parent;
  }

  return '';
}
