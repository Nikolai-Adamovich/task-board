import { NotFoundError } from '../errors/app-error.js';

/** Minimal project repository interface needed to resolve an entity's tenant. */
export interface TenantAssertProjectRepo {
  findById(id: string): Promise<{ tenantId: string } | null>;
}

/**
 * M-02: assert that an entity addressed by a bare id belongs to the caller's
 * tenant. Entities only carry `projectId`, so the tenant is resolved through
 * the owning project.
 *
 * On mismatch (or an unresolvable project) throws 404 — deliberately NOT 403 —
 * so the response does not leak the existence of a cross-tenant resource.
 */
export async function assertTenantEntity(
  projectRepo: TenantAssertProjectRepo | undefined,
  projectId: string,
  tenantId: string,
  label: string,
): Promise<void> {
  const project = projectRepo ? await projectRepo.findById(projectId) : null;

  if (!project || project.tenantId !== tenantId) {
    throw new NotFoundError(`${label} not found`);
  }
}
