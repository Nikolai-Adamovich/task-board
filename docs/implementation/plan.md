# Task Board MVP — Implementation Plan

> **Version:** 2.0.0 **Date:** 2026-07-28 **Status:** Approved **Reference:**
> [Technical Specification v2.0.0](../implementation/technical_specification.md) ·
> [Architecture v2.0.0](../implementation/architecture.md) · [Project Description](../project_description.md)

---

## Summary

- **Total tasks:** 80
- **Phases:** 9 (Phase 0–Phase 8)
- **First deployable vertical slice:** Tasks T-001 through T-053, T-054 through T-065, T-066 through T-071, T-074 (see
  [Vertical Slice Mapping](#vertical-slice-mapping))

---

## Phase 0: Project Scaffolding

### T-001: Initialize monorepo with npm workspaces

- **Goal:** Create the root `package.json` with npm workspaces pointing to `server`, `shared`, and `ui`.
- **Files to create:**
  - `package.json` (root)
  - `.gitignore`
- **Dependencies:** None
- **Acceptance criteria:**
  - `npm install` at the root installs all workspace packages without errors
  - `npm workspaces list` shows `server`, `shared`, `ui`

### T-002: Configure root TypeScript base config and tooling

- **Goal:** Create `tsconfig.base.json` (TypeScript 6.0.0 strict mode) with shared compiler options, a flat ESLint
  config (ESLint 9.x), and `.prettierrc`.
- **Files to create:**
  - `tsconfig.base.json`
  - `eslint.config.js` (flat config — no `.eslintrc.json`)
  - `.prettierrc`
  - `.editorconfig`
- **Dependencies:** T-001
- **Acceptance criteria:**
  - `tsc --noEmit` runs without errors (no source files yet, so just config validation)
  - ESLint 9.x flat config (`eslint.config.js`) and Prettier 3.x configs are valid and consistent
  - TypeScript compiler options target `6.0.0` with `strict: true`

### T-003: Set up development tooling (Husky, lint-staged, Commitlint)

- **Goal:** Configure Git hooks for linting, formatting, and conventional commits.
- **Files to create:**
  - `.husky/pre-commit`
  - `.husky/commit-msg`
  - `lint-staged.config.js`
  - `commitlint.config.js`
- **Dependencies:** T-002
- **Acceptance criteria:**
  - `npx husky install` succeeds and hooks are registered
  - A commit with a non-conventional message is blocked by Commitlint
  - lint-staged runs ESLint + Prettier on staged files

### T-004: Create directory structure for all three packages

- **Goal:** Create the empty directory skeletons for `server/`, `shared/`, and `ui/` with their `src/` subdirectories.
- **Files to create:**
  - `server/src/` (empty)
  - `shared/src/` (empty)
  - `ui/src/` (empty)
  - `docs/implementation/plan.md` (this file)
- **Dependencies:** T-001
- **Acceptance criteria:**
  - All directories exist and are tracked by git
  - Each package has `package.json` and `tsconfig.json` placeholders (can be empty)

---

## Phase 1: Shared Package

### T-005: Create shared package skeleton

- **Goal:** Create `shared/package.json`, `shared/tsconfig.json`, and `shared/src/index.ts` with barrel exports.
- **Files to create:**
  - `shared/package.json`
  - `shared/tsconfig.json`
  - `shared/src/index.ts`
- **Dependencies:** T-001, T-004
- **Acceptance criteria:**
  - `npm run build --workspace=shared` succeeds (even if empty)
  - `shared/src/index.ts` exports are resolvable

### T-006: Define auth schemas, types, and contracts

- **Goal:** Create Zod v4 schemas for auth (`LoginRequestSchema`, `RegisterRequestSchema`, `AuthResponseSchema`) using
  `z.interface()` for object schemas, derived TypeScript types, and API contracts.
- **Files to create:**
  - `shared/src/schemas/auth.ts`
  - `shared/src/types/auth.ts`
  - `shared/src/contracts/auth.contracts.ts`
- **Dependencies:** T-005
- **Acceptance criteria:**
  - `tsc --noEmit` passes in the shared package
  - All object schemas use `z.interface({...})` (Zod v4 preferred API over `z.object()`)
  - `AuthResponseSchema` parses a valid JWT payload shape
  - `LoginRequestSchema` and `RegisterRequestSchema` validate correctly

### T-007: Define tenant schemas, types, and contracts

- **Goal:** Create Zod v4 schemas for tenant CRUD (`CreateTenantSchema`, `TenantSchema`, `UpdateTenantSchema`,
  `TenantMemberSchema`) using `z.interface()`, derived types, and contracts.
- **Files to create:**
  - `shared/src/schemas/tenant.ts`
  - `shared/src/types/tenant.ts`
  - `shared/src/contracts/tenant.contracts.ts`
- **Dependencies:** T-005
- **Acceptance criteria:**
  - `tsc --noEmit` passes
  - All object schemas use `z.interface({...})` (Zod v4 preferred API)
  - `TenantSchema` includes `id`, `name`, `slug`, `createdAt`, `updatedAt`
  - `TenantMemberSchema` includes `userId`, `tenantId`, `role`

### T-008: Define user schemas, types, and contracts

- **Goal:** Create Zod v4 schemas for user (`UserSchema`, `CreateUserSchema`) using `z.interface()`, derived types, and
  contracts.
- **Files to create:**
  - `shared/src/schemas/user.ts`
  - `shared/src/types/user.ts`
  - `shared/src/contracts/user.contracts.ts`
- **Dependencies:** T-005
- **Acceptance criteria:**
  - `tsc --noEmit` passes
  - All object schemas use `z.interface({...})` (Zod v4 preferred API)
  - `UserSchema` includes `id`, `email`, `displayName`, `createdAt`, `updatedAt`

### T-009: Define project schemas, types, and contracts

- **Goal:** Create Zod v4 schemas for project CRUD (`CreateProjectSchema`, `ProjectSchema`, `UpdateProjectSchema`,
  `ProjectMemberSchema`) using `z.interface()`, derived types, and contracts.
- **Files to create:**
  - `shared/src/schemas/project.ts`
  - `shared/src/types/project.ts`
  - `shared/src/contracts/project.contracts.ts`
- **Dependencies:** T-005
- **Acceptance criteria:**
  - `tsc --noEmit` passes
  - All object schemas use `z.interface({...})` (Zod v4 preferred API)
  - `ProjectSchema` includes `tenantId`, `name`, `slug`, `description`
  - `ProjectMemberSchema` includes `userId`, `projectId`, `role`

### T-010: Define board schemas, types, and contracts

- **Goal:** Create Zod v4 schemas for board and column CRUD (`CreateBoardSchema`, `BoardSchema`, `UpdateBoardSchema`,
  `ColumnSchema`) using `z.interface()`, derived types, and contracts.
- **Files to create:**
  - `shared/src/schemas/board.ts`
  - `shared/src/types/board.ts`
  - `shared/src/contracts/board.contracts.ts`
- **Dependencies:** T-005
- **Acceptance criteria:**
  - `tsc --noEmit` passes
  - All object schemas use `z.interface({...})` (Zod v4 preferred API)
  - `CreateBoardSchema` includes `name`, `description`, `columnNames`
  - `ColumnSchema` includes `boardId`, `tenantId`, `name`, `position`, `isDefault`

### T-011: Define task schemas, types, and contracts

- **Goal:** Create Zod v4 schemas for task CRUD (`CreateTaskSchema`, `TaskSchema`, `UpdateTaskSchema`, `MoveTaskSchema`,
  `AssignTaskSchema`) using `z.interface()`, derived types, and contracts.
- **Files to create:**
  - `shared/src/schemas/task.ts`
  - `shared/src/types/task.ts`
  - `shared/src/contracts/task.contracts.ts`
- **Dependencies:** T-005
- **Acceptance criteria:**
  - `tsc --noEmit` passes
  - All object schemas use `z.interface({...})` (Zod v4 preferred API)
  - `MoveTaskSchema` includes `taskId`, `targetColumnId`, `targetSprintId` (optional)
  - `AssignTaskSchema` includes `taskId`, `assigneeIds`

### T-012: Define sprint schemas, types, and contracts

- **Goal:** Create Zod v4 schemas for sprint CRUD (`CreateSprintSchema`, `SprintSchema`, `UpdateSprintSchema`) using
  `z.interface()`, derived types, and contracts.
- **Files to create:**
  - `shared/src/schemas/sprint.ts`
  - `shared/src/types/sprint.ts`
  - `shared/src/contracts/sprint.contracts.ts`
- **Dependencies:** T-005
- **Acceptance criteria:**
  - `tsc --noEmit` passes
  - All object schemas use `z.interface({...})` (Zod v4 preferred API)
  - `SprintSchema` includes `tenantId`, `projectId`, `name`, `startDate`, `endDate`, `goal`, `status`, `taskIds`

### T-013: Define common schemas, types, and contracts

- **Goal:** Create shared Zod v4 schemas for error responses, pagination, and paginated responses using `z.interface()`,
  plus derived types and contracts.
- **Files to create:**
  - `shared/src/schemas/common.ts`
  - `shared/src/types/common.ts`
  - `shared/src/contracts/common.contracts.ts`
- **Dependencies:** T-005
- **Acceptance criteria:**
  - `tsc --noEmit` passes
  - All object schemas use `z.interface({...})` (Zod v4 preferred API)
  - `PaginatedResponseSchema(TaskSchema)` produces a valid paginated shape
  - `ErrorResponseSchema` includes `code`, `message`, `details`

### T-014: Define shared constants

- **Goal:** Create constants for roles, default column names, HTTP methods, and API paths.
- **Files to create:**
  - `shared/src/constants/roles.ts`
  - `shared/src/constants/columns.ts`
  - `shared/src/constants/http.ts`
  - `shared/src/constants/paths.ts`
- **Dependencies:** T-005
- **Acceptance criteria:**
  - `tsc --noEmit` passes
  - `DefaultColumnNames` equals `['Backlog', 'To Do', 'In Progress', 'Review', 'Done']`
  - `TenantRole` and `ProjectRole` enums match the spec

### T-015: Define shared validators

- **Goal:** Create reusable Zod validator helpers for UUID, slug, and pagination query params.
- **Files to create:**
  - `shared/src/validators/uuid.ts`
  - `shared/src/validators/slug.ts`
  - `shared/src/validators/pagination.ts`
- **Dependencies:** T-005
- **Acceptance criteria:**
  - `tsc --noEmit` passes
  - UUID validator rejects non-UUID strings
  - Slug validator rejects strings with uppercase or special chars

### T-016: Build and verify shared package

- **Goal:** Run `tsc --noEmit` across the shared package (TypeScript 6.0.0 strict mode) and verify zero type errors.
  Also run `npm run build` to confirm the package compiles. Verify all Zod v4 schemas use `z.interface()` and the barrel
  exports include schema, type, contract, constant, and validator modules.
- **Files to modify:**
  - `shared/package.json` (add build script; pin `zod@^4.0.0`)
  - `shared/tsconfig.json` (ensure strict mode with TypeScript 6.0.0)
- **Dependencies:** T-006 through T-015
- **Acceptance criteria:**
  - `tsc --noEmit` returns exit code 0
  - `npm run build --workspace=shared` succeeds
  - All barrel exports in `shared/src/index.ts` resolve without errors
  - All object schemas use `z.interface()` (Zod v4); no `z.object()` usage

---

## Phase 2: Backend Foundation

### T-017: Create server package skeleton

- **Goal:** Create `server/package.json`, `server/tsconfig.json`, `server/wrangler.toml`, and the `server/src/`
  directory structure.
- **Files to create:**
  - `server/package.json`
  - `server/tsconfig.json`
  - `server/wrangler.toml`
  - `server/src/index.ts` (placeholder)
  - `server/src/middleware/` (empty)
  - `server/src/routes/` (empty)
  - `server/src/services/` (empty)
  - `server/src/repositories/` (empty)
  - `server/src/db/` (empty)
  - `server/src/types/` (empty)
- **Dependencies:** T-001, T-004, T-016
- **Acceptance criteria:**
  - `npm run build --workspace=server` succeeds (placeholder compiles)
  - `wrangler.toml` has the correct `main` entry pointing to `src/index.ts`

### T-018: Set up MongoDB connection module

- **Goal:** Create `server/src/db/mongo.ts` that initializes a MongoDB client (Driver v7.0.0 — async-only, all
  operations return promises), exports a typed `getCollection<T>()` helper, and handles connection lifecycle.
- **Files to create:**
  - `server/src/db/mongo.ts`
  - `server/src/types/context.ts` (Hono context type extensions)
- **Dependencies:** T-017, T-016
- **Acceptance criteria:**
  - `getCollection<T>(name)` returns a typed `Collection<T>` (MongoDB Driver v7.0.0)
  - All driver operations use `await` (no callback APIs — v7 drops legacy callbacks entirely)
  - Context type extensions declare `userId`, `user`, `tenantId`, `userRole` on `ContextVariableMap`
  - Connection uses `MONGODB_URI` from environment variables

### T-019: Implement error handler middleware

- **Goal:** Create `server/src/middleware/error-handler.ts` that catches unhandled errors and returns standardized JSON
  error responses matching `ErrorResponseSchema`.
- **Files to create:**
  - `server/src/middleware/error-handler.ts`
- **Dependencies:** T-017, T-016
- **Acceptance criteria:**
  - Unhandled errors return `{ code, message, details }` with correct HTTP status
  - Known errors (NotFoundError, ForbiddenError, ValidationError) return appropriate codes and 4xx status
  - Does not leak stack traces in production

### T-020: Implement auth middleware (JWT verification)

- **Goal:** Create `server/src/middleware/auth.ts` that verifies the `Authorization: Bearer <token>` header, decodes the
  JWT, and sets `c.get('userId')` and `c.get('user')` on the Hono context.
- **Files to create:**
  - `server/src/middleware/auth.ts`
- **Dependencies:** T-017, T-016
- **Acceptance criteria:**
  - Missing or invalid `Authorization` header returns 401
  - Valid JWT sets `userId` and `user` on the context
  - Expired JWT returns 401
  - Uses `JWT_SECRET` from environment variables

### T-021: Implement tenant context middleware

- **Goal:** Create `server/src/middleware/tenant-context.ts` that reads `X-Tenant-Id` header, validates the user is a
  `TenantMember` of that tenant, and sets `c.get('tenantId')` on the context. Skipped for auth routes.
- **Files to create:**
  - `server/src/middleware/tenant-context.ts`
- **Dependencies:** T-020, T-018
- **Acceptance criteria:**
  - Missing `X-Tenant-Id` header returns 400
  - User not a member of the tenant returns 403
  - Valid tenant membership sets `tenantId` on context
  - Auth routes (`/auth/*`) skip this middleware

### T-022: Implement RBAC middleware

- **Goal:** Create `server/src/middleware/rbac.ts` that checks the user's role against the required permission for the
  route, using `RBACService`. Sets `c.get('userRole')` on the context.
- **Files to create:**
  - `server/src/middleware/rbac.ts`
- **Dependencies:** T-021, T-016
- **Acceptance criteria:**
  - Routes with insufficient role return 403
  - Tenant owners bypass all project-level restrictions
  - `userRole` is set on the context for downstream use

### T-023: Implement validation middleware

- **Goal:** Create `server/src/middleware/validation.ts` that validates request body, query params, and path params
  against Zod v4 schemas from the shared package using `z.interface().parse()` / `.safeParse()`. Returns 422 with
  structured validation errors on failure.
- **Files to create:**
  - `server/src/middleware/validation.ts`
- **Dependencies:** T-016
- **Acceptance criteria:**
  - Invalid request body returns 422 with structured validation error details (Zod v4 `.issues` format)
  - Valid requests pass through without modification
  - Uses Zod v4 schemas from the `shared` package (`z.interface().parse()` / `.safeParse()`)

### T-024: Create Hono app bootstrap with middleware pipeline

- **Goal:** Create `server/src/index.ts` that wires up the Hono 4.8.0 app with the full middleware pipeline and mounts
  all route modules.
- **Files to create:**
  - `server/src/index.ts` (full implementation)
- **Dependencies:** T-019, T-020, T-021, T-022, T-023
- **Acceptance criteria:**
  - `wrangler dev` starts the server without errors
  - Uses Hono 4.8.0 (`import { Hono } from "hono"`)
  - Middleware pipeline order is: ErrorHandler → Auth → TenantContext → RBAC → Validation → RouteHandler
  - Auth routes are mounted at `/api/v1/auth` and skip tenant/RBAC middleware
  - All other routes are mounted at `/api/v1/*` with the full middleware chain

### T-025: Create route aggregation index files

- **Goal:** Create `server/src/routes/index.ts` that re-exports all route modules for convenience.
- **Files to create:**
  - `server/src/routes/index.ts`
- **Dependencies:** T-024
- **Acceptance criteria:**
  - All route modules are exported from the index
  - No circular dependencies

---

## Phase 3: Tenant & User Management

### T-026: Implement tenant repository

- **Goal:** Create `server/src/repositories/tenant.repository.ts` with CRUD methods scoped by `tenantId`. Uses MongoDB
  Driver v7.0.0 (`Collection<T>` generic, async-only API).
- **Files to create:**
  - `server/src/repositories/tenant.repository.ts`
- **Dependencies:** T-018
- **Acceptance criteria:**
  - Repository receives a typed `Collection<TenantDocument>` via constructor injection
  - All operations use `await` with `findOne()`, `insertOne()`, `updateOne()`, `deleteOne()` (no callbacks — Driver v7
    drops legacy APIs)
  - `findById(tenantId, id)` returns a tenant or null
  - `findBySlug(tenantId, slug)` returns a tenant or null (unique within tenant)
  - `create(tenantId, input)` inserts a document with `tenantId` and a UUID `id`
  - `update(tenantId, id, input)` modifies and returns the updated tenant
  - `delete(tenantId, id)` removes the tenant
  - All queries include `tenantId` in the filter
  - Returns plain TypeScript domain objects (no MongoDB driver types leak to services)

### T-027: Implement tenant service

- **Goal:** Create `server/src/services/tenant.service.ts` with business logic for tenant CRUD and member management.
- **Files to create:**
  - `server/src/services/tenant.service.ts`
- **Dependencies:** T-026, T-016
- **Acceptance criteria:**
  - `createTenant(tenantId, input)` creates a tenant and returns the tenant object
  - `listTenants(tenantId)` returns all tenants the user belongs to
  - `getTenant(tenantId, id)` returns tenant details
  - `updateTenant(tenantId, id, input)` updates tenant (owner/admin only)
  - `deleteTenant(tenantId, id)` deletes tenant (owner only)
  - Business rules are enforced (e.g., slug uniqueness within tenant)

### T-028: Implement tenant routes

- **Goal:** Create `server/src/routes/tenants.ts` with all tenant endpoints (CRUD, member invite/update/remove).
- **Files to create:**
  - `server/src/routes/tenants.ts`
- **Dependencies:** T-027
- **Acceptance criteria:**
  - `GET /api/v1/tenants` lists tenants for the authenticated user
  - `POST /api/v1/tenants` creates a new tenant (user becomes owner)
  - `GET /api/v1/tenants/:tenantId` returns tenant details
  - `PATCH /api/v1/tenants/:tenantId` updates tenant
  - `DELETE /api/v1/tenants/:tenantId` deletes tenant
  - `POST /api/v1/tenants/:tenantId/members` invites a member
  - `PATCH /api/v1/tenants/:tenantId/members/:userId` updates member role
  - `DELETE /api/v1/tenants/:tenantId/members/:userId` removes a member

### T-029: Implement user repository

- **Goal:** Create `server/src/repositories/user.repository.ts` with methods for user lookup by email and by ID. Uses
  MongoDB Driver v7.0.0 async-only API.
- **Files to create:**
  - `server/src/repositories/user.repository.ts`
- **Dependencies:** T-018
- **Acceptance criteria:**
  - Repository receives a typed `Collection<UserDocument>` via constructor injection
  - All operations use `await` (Driver v7 async-only — no callbacks)
  - `findByEmail(email)` returns a user or null
  - `findById(id)` returns a user or null
  - `create(input)` inserts a user with hashed password and returns the user
  - All methods are scoped correctly (users are global, not tenant-scoped)

### T-030: Implement auth service (register, login, me)

- **Goal:** Create `server/src/services/auth.service.ts` with registration, login, and profile retrieval logic. JWT
  issuance with HS256.
- **Files to create:**
  - `server/src/services/auth.service.ts`
- **Dependencies:** T-029, T-027, T-016
- **Acceptance criteria:**
  - `register(input)` creates a user, hashes the password, auto-creates a tenant with the user as owner, and returns an
    `AuthResponse`
  - `login(input)` verifies credentials and returns a JWT
  - `me(userId)` returns the current user profile
  - JWT payload includes `sub`, `email`, `tenantId`, `tenantRole`
  - Token expiry is 24 hours

### T-031: Implement auth routes

- **Goal:** Create `server/src/routes/auth.ts` with register, login, and me endpoints.
- **Files to create:**
  - `server/src/routes/auth.ts`
- **Dependencies:** T-030
- **Acceptance criteria:**
  - `POST /api/v1/auth/register` returns 201 with user + JWT
  - `POST /api/v1/auth/login` returns 200 with JWT; 401 for invalid credentials
  - `GET /api/v1/auth/me` returns 200 with user profile; 401 for missing/invalid token
  - Auth routes skip tenant context and RBAC middleware

### T-032: Implement tenant member repository

- **Goal:** Create `server/src/repositories/tenant-member.repository.ts` for TenantMember CRUD scoped by tenantId. Uses
  MongoDB Driver v7.0.0 async-only API.
- **Files to create:**
  - `server/src/repositories/tenant-member.repository.ts`
- **Dependencies:** T-018
- **Acceptance criteria:**
  - Repository receives a typed `Collection<TenantMemberDocument>` via constructor injection
  - All operations use `await` (Driver v7 async-only — no callbacks)
  - `findByUserAndTenant(userId, tenantId)` returns a TenantMember or null
  - `findByTenant(tenantId)` returns all members for a tenant
  - `create(tenantId, input)` inserts a member record
  - `updateRole(tenantId, userId, role)` updates the member's role
  - `delete(tenantId, userId)` removes the member
  - All queries include `tenantId` in the filter

### T-033: Implement tenant member service logic

- **Goal:** Add tenant member management methods to `tenant.service.ts` (invite, update role, remove).
- **Files to modify:**
  - `server/src/services/tenant.service.ts`
- **Dependencies:** T-032, T-027
- **Acceptance criteria:**
  - `inviteMember(tenantId, userId, role)` adds a member to the tenant
  - `updateMemberRole(tenantId, userId, role)` changes the member's role
  - `removeMember(tenantId, userId)` removes the member
  - Only owner/admin can manage members
  - Owner cannot be removed from the tenant

### T-034: Wire tenant member operations into tenant routes

- **Goal:** Update `server/src/routes/tenants.ts` to use the tenant member service methods for the member endpoints.
- **Files to modify:**
  - `server/src/routes/tenants.ts`
- **Dependencies:** T-033
- **Acceptance criteria:**
  - All member endpoints (invite, update role, remove) work end-to-end
  - RBAC is enforced (owner/admin only for member management)
  - Responses conform to shared Zod schemas

---

## Phase 4: Projects & Boards

### T-035: Implement project repository

- **Goal:** Create `server/src/repositories/project.repository.ts` with CRUD methods scoped by tenantId. Uses MongoDB
  Driver v7.0.0 async-only API.
- **Files to create:**
  - `server/src/repositories/project.repository.ts`
- **Dependencies:** T-018
- **Acceptance criteria:**
  - Repository receives a typed `Collection<ProjectDocument>` via constructor injection
  - All operations use `await` (Driver v7 async-only — no callbacks)
  - `findById(tenantId, id)` returns a project or null
  - `findByTenant(tenantId)` returns all projects for the tenant
  - `findBySlug(tenantId, slug)` returns a project or null (unique within tenant)
  - `create(tenantId, input)` inserts a project with `tenantId` and a UUID `id`
  - `update(tenantId, id, input)` modifies and returns the updated project
  - `delete(tenantId, id)` removes the project
  - All queries include `tenantId` in the filter

### T-036: Implement project service

- **Goal:** Create `server/src/services/project.service.ts` with business logic for project CRUD and member management.
- **Files to create:**
  - `server/src/services/project.service.ts`
- **Dependencies:** T-035, T-016
- **Acceptance criteria:**
  - `listProjects(tenantId)` returns all projects in the tenant
  - `createProject(tenantId, input)` creates a project (admin+ only)
  - `getProject(tenantId, id)` returns project details
  - `updateProject(tenantId, id, input)` updates project (admin+ only)
  - `deleteProject(tenantId, id)` deletes project (admin+ only)
  - Business rules enforced (slug uniqueness within tenant)

### T-037: Implement project routes

- **Goal:** Create `server/src/routes/projects.ts` with all project endpoints (CRUD, member management).
- **Files to create:**
  - `server/src/routes/projects.ts`
- **Dependencies:** T-036
- **Acceptance criteria:**
  - `GET /api/v1/projects` lists projects in the active tenant
  - `POST /api/v1/projects` creates a project (admin+ only)
  - `GET /api/v1/projects/:projectId` returns project details
  - `PATCH /api/v1/projects/:projectId` updates project (admin+ only)
  - `DELETE /api/v1/projects/:projectId` deletes project (admin+ only)
  - Member endpoints (list, add, update role, remove) are functional

### T-038: Implement project member repository

- **Goal:** Create `server/src/repositories/project-member.repository.ts` for ProjectMember CRUD scoped by tenantId.
  Uses MongoDB Driver v7.0.0 async-only API.
- **Files to create:**
  - `server/src/repositories/project-member.repository.ts`
- **Dependencies:** T-018
- **Acceptance criteria:**
  - Repository receives a typed `Collection<ProjectMemberDocument>` via constructor injection
  - All operations use `await` (Driver v7 async-only — no callbacks)
  - `findByProjectAndUser(projectId, userId)` returns a ProjectMember or null
  - `findByProject(projectId)` returns all members for a project
  - `create(projectId, tenantId, input)` inserts a member record
  - `updateRole(projectId, userId, role)` updates the member's role
  - `delete(projectId, userId)` removes the member
  - All queries include `tenantId` in the filter

### T-039: Implement project member service logic

- **Goal:** Add project member management methods to `project.service.ts` (add, update role, remove).
- **Files to modify:**
  - `server/src/services/project.service.ts`
- **Dependencies:** T-038, T-036
- **Acceptance criteria:**
  - `addMember(projectId, tenantId, userId, role)` adds a member to the project
  - `updateMemberRole(projectId, tenantId, userId, role)` changes the member's role
  - `removeMember(projectId, tenantId, userId)` removes the member
  - Only project admin can manage members
  - Owner bypasses project-level restrictions

### T-040: Wire project member operations into project routes

- **Goal:** Update `server/src/routes/projects.ts` to use the project member service methods for the member endpoints.
- **Files to modify:**
  - `server/src/routes/projects.ts`
- **Dependencies:** T-039
- **Acceptance criteria:**
  - All member endpoints work end-to-end
  - RBAC is enforced (admin only for member management)
  - Responses conform to shared Zod schemas

### T-041: Implement board repository

- **Goal:** Create `server/src/repositories/board.repository.ts` with CRUD methods scoped by tenantId. Uses MongoDB
  Driver v7.0.0 async-only API.
- **Files to create:**
  - `server/src/repositories/board.repository.ts`
- **Dependencies:** T-018
- **Acceptance criteria:**
  - Repository receives a typed `Collection<BoardDocument>` via constructor injection
  - All operations use `await` (Driver v7 async-only — no callbacks)
  - `findById(tenantId, id)` returns a board or null
  - `findByProject(tenantId, projectId)` returns all boards for a project
  - `create(tenantId, input)` inserts a board with `tenantId` and a UUID `id`
  - `update(tenantId, id, input)` modifies and returns the updated board
  - `delete(tenantId, id)` removes the board
  - All queries include `tenantId` in the filter

### T-042: Implement board service

- **Goal:** Create `server/src/services/board.service.ts` with business logic for board CRUD and column management.
- **Files to create:**
  - `server/src/services/board.service.ts`
- **Dependencies:** T-041, T-016
- **Acceptance criteria:**
  - `listBoards(tenantId, projectId)` returns all boards for a project
  - `createBoard(tenantId, input)` creates a board with default columns (admin+ only)
  - `getBoard(tenantId, id)` returns board with columns
  - `updateBoard(tenantId, id, input)` updates board (admin+ only)
  - `deleteBoard(tenantId, id)` deletes board (admin+ only)
  - Default columns are created when a board is created

### T-043: Implement board routes

- **Goal:** Create `server/src/routes/boards.ts` with all board endpoints.
- **Files to create:**
  - `server/src/routes/boards.ts`
- **Dependencies:** T-042
- **Acceptance criteria:**
  - `GET /api/v1/boards?projectId=...` lists boards for a project
  - `POST /api/v1/boards` creates a board with columns (admin+ only)
  - `GET /api/v1/boards/:boardId` returns board with columns
  - `PATCH /api/v1/boards/:boardId` updates board (admin+ only)
  - `DELETE /api/v1/boards/:boardId` deletes board (admin+ only)

### T-044: Implement column repository

- **Goal:** Create `server/src/repositories/column.repository.ts` with CRUD methods scoped by tenantId. Uses MongoDB
  Driver v7.0.0 async-only API.
- **Files to create:**
  - `server/src/repositories/column.repository.ts`
- **Dependencies:** T-018
- **Acceptance criteria:**
  - Repository receives a typed `Collection<ColumnDocument>` via constructor injection
  - All operations use `await` (Driver v7 async-only — no callbacks)
  - `findById(tenantId, id)` returns a column or null
  - `findByBoard(tenantId, boardId)` returns all columns for a board, sorted by position
  - `create(tenantId, input)` inserts a column with `tenantId` and a UUID `id`
  - `update(tenantId, id, input)` modifies and returns the updated column
  - `delete(tenantId, id)` removes the column
  - `reorder(tenantId, boardId, columnIds)` updates positions for all columns in a board
  - All queries include `tenantId` in the filter

### T-045: Implement column service

- **Goal:** Create `server/src/services/column.service.ts` with business logic for column CRUD and reorder.
- **Files to create:**
  - `server/src/services/column.service.ts`
- **Dependencies:** T-044, T-016
- **Acceptance criteria:**
  - `listColumns(tenantId, boardId)` returns columns sorted by position
  - `createColumn(tenantId, boardId, input)` creates a column (admin+ only)
  - `updateColumn(tenantId, id, input)` updates column (admin+ only)
  - `deleteColumn(tenantId, id)` deletes column (admin+ only)
  - `reorderColumns(tenantId, boardId, columnIds)` reorders columns (admin+ only)

### T-046: Implement column routes

- **Goal:** Create `server/src/routes/columns.ts` with all column endpoints.
- **Files to create:**
  - `server/src/routes/columns.ts`
- **Dependencies:** T-045
- **Acceptance criteria:**
  - `GET /api/v1/boards/:boardId/columns` lists columns for a board
  - `POST /api/v1/boards/:boardId/columns` creates a column (admin+ only)
  - `PATCH /api/v1/boards/:boardId/columns/:columnId` updates column (admin+ only)
  - `DELETE /api/v1/boards/:boardId/columns/:columnId` deletes column (admin+ only)
  - `PATCH /api/v1/boards/:boardId/columns/reorder` reorders columns (admin+ only)

---

## Phase 5: Sprints & Collaboration

### T-047: Implement task repository

- **Goal:** Create `server/src/repositories/task.repository.ts` with CRUD methods scoped by tenantId, including
  filtering by project, board, column, sprint, and assignee. Uses MongoDB Driver v7.0.0 async-only API.
- **Files to create:**
  - `server/src/repositories/task.repository.ts`
- **Dependencies:** T-018
- **Acceptance criteria:**
  - Repository receives a typed `Collection<TaskDocument>` via constructor injection
  - All operations use `await` with `findOne()`, `insertOne()`, `updateOne()`, `deleteOne()`, `find()`, `aggregate()`
    (Driver v7 async-only — no callbacks)
  - `findById(tenantId, id)` returns a task or null
  - `findByBoardAndColumn(tenantId, boardId, columnId)` returns tasks sorted by position
  - `findBySprint(tenantId, sprintId)` returns tasks in a sprint
  - `findByProject(tenantId, projectId)` returns tasks for a project
  - `create(tenantId, input)` inserts a task with `tenantId`, UUID `id`, and position
  - `update(tenantId, id, input)` modifies and returns the updated task
  - `delete(tenantId, id)` removes the task
  - All queries include `tenantId` in the filter
  - Cross-tenant reference validation on write operations

### T-048: Implement task service (CRUD, move, assign)

- **Goal:** Create `server/src/services/task.service.ts` with business logic for task CRUD, status transitions (move),
  and assignment.
- **Files to create:**
  - `server/src/services/task.service.ts`
- **Dependencies:** T-047, T-016
- **Acceptance criteria:**
  - `listTasks(tenantId, params)` returns filtered, paginated tasks
  - `createTask(tenantId, input)` creates a task (member+ only)
  - `getTask(tenantId, id)` returns task details with assignees
  - `updateTask(tenantId, id, input)` updates task fields (member+ for own task; admin+ for any task)
  - `deleteTask(tenantId, id)` deletes task (admin+ only)
  - `moveTask(tenantId, input)` moves a task to a different column, validates column belongs to same board
  - `assignTask(tenantId, input)` updates assigneeIds
  - RBAC enforced: viewer cannot write, developer can write own/assigned tasks, admin can write any

### T-049: Implement task routes

- **Goal:** Create `server/src/routes/tasks.ts` with all task endpoints (CRUD, move, assign).
- **Files to create:**
  - `server/src/routes/tasks.ts`
- **Dependencies:** T-048
- **Acceptance criteria:**
  - `GET /api/v1/tasks` lists tasks with filters (projectId, boardId, columnId, sprintId, assigneeId)
  - `POST /api/v1/tasks` creates a task (member+ only)
  - `GET /api/v1/tasks/:taskId` returns task details
  - `PATCH /api/v1/tasks/:taskId` updates task
  - `DELETE /api/v1/tasks/:taskId` deletes task (admin+ only)
  - `PATCH /api/v1/tasks/:taskId/assign` assigns/unassigns users
  - `PATCH /api/v1/tasks/:taskId/move` moves task to a different column

### T-050: Implement sprint repository

- **Goal:** Create `server/src/repositories/sprint.repository.ts` with CRUD methods scoped by tenantId. Uses MongoDB
  Driver v7.0.0 async-only API.
- **Files to create:**
  - `server/src/repositories/sprint.repository.ts`
- **Dependencies:** T-018
- **Acceptance criteria:**
  - Repository receives a typed `Collection<SprintDocument>` via constructor injection
  - All operations use `await` (Driver v7 async-only — no callbacks)
  - `findById(tenantId, id)` returns a sprint or null
  - `findByProject(tenantId, projectId)` returns all sprints for a project
  - `create(tenantId, input)` inserts a sprint with `tenantId` and a UUID `id`
  - `update(tenantId, id, input)` modifies and returns the updated sprint
  - `delete(tenantId, id)` removes the sprint
  - `addTask(tenantId, sprintId, taskId)` adds a task to the sprint's taskIds
  - `removeTask(tenantId, sprintId, taskId)` removes a task from the sprint's taskIds
  - All queries include `tenantId` in the filter

### T-051: Implement sprint service (CRUD, add/remove tasks)

- **Goal:** Create `server/src/services/sprint.service.ts` with business logic for sprint CRUD and task assignment
  to/from sprints.
- **Files to create:**
  - `server/src/services/sprint.service.ts`
- **Dependencies:** T-050, T-016
- **Acceptance criteria:**
  - `listSprints(tenantId, projectId)` returns all sprints for a project
  - `createSprint(tenantId, input)` creates a sprint (admin+ only)
  - `getSprint(tenantId, id)` returns sprint details with tasks
  - `updateSprint(tenantId, id, input)` updates sprint (admin+ only)
  - `deleteSprint(tenantId, id)` deletes sprint (admin+ only)
  - `addTaskToSprint(tenantId, sprintId, taskId)` moves a task from backlog into the sprint
  - `removeTaskFromSprint(tenantId, sprintId, taskId)` moves a task back to backlog
  - Business rules enforced (only admin can create/manage sprints; task must belong to same project)

### T-052: Implement sprint routes

- **Goal:** Create `server/src/routes/sprints.ts` with all sprint endpoints (CRUD, add/remove tasks).
- **Files to create:**
  - `server/src/routes/sprints.ts`
- **Dependencies:** T-051
- **Acceptance criteria:**
  - `GET /api/v1/sprints?projectId=...` lists sprints for a project
  - `POST /api/v1/sprints` creates a sprint (admin+ only)
  - `GET /api/v1/sprints/:sprintId` returns sprint details with tasks
  - `PATCH /api/v1/sprints/:sprintId` updates sprint (admin+ only)
  - `DELETE /api/v1/sprints/:sprintId` deletes sprint (admin+ only)
  - `POST /api/v1/sprints/:sprintId/tasks` adds task(s) from backlog to sprint
  - `DELETE /api/v1/sprints/:sprintId/tasks/:taskId` removes task from sprint

### T-053: Implement RBAC service (permission matrix evaluation)

- **Goal:** Create `server/src/services/rbac.service.ts` that evaluates permissions based on the permission matrix from
  the spec. Supports tenant-level and project-level roles.
- **Files to create:**
  - `server/src/services/rbac.service.ts`
- **Dependencies:** T-016
- **Acceptance criteria:**
  - `can(tenantRole, projectRole, action)` returns `true` or `false` based on the permission matrix
  - Tenant owners bypass all project-level restrictions
  - Viewers cannot write (create, update, delete) any entity
  - Members can create/edit/move tasks only in projects where they are explicitly a member
  - All permission checks from the spec's matrix are correctly implemented

---

## Phase 6: Frontend Foundation

### T-054: Create Angular app skeleton

- **Goal:** Create `ui/package.json`, `ui/tsconfig.json`, `angular.json`, and the basic Angular 22.0.8 project structure
  with standalone component support, zoneless change detection, and Tailwind CSS v4.1.0 CSS-first configuration.
- **Files to create:**
  - `ui/package.json`
  - `ui/tsconfig.json`
  - `angular.json`
  - `ui/src/main.ts`
  - `ui/src/index.html`
  - `ui/src/styles.css` (Tailwind v4 CSS-first config with `@import "tailwindcss"` and `@theme` directive)
- **Dependencies:** T-001, T-016
- **Acceptance criteria:**
  - `npm run build --workspace=ui` succeeds (empty app)
  - Angular 22.0.8 standalone components are configured (no NgModules)
  - Zoneless change detection is active by default (no `zone.js` dependency)
  - Tailwind CSS v4.1.0 is configured via CSS-first approach (`@import "tailwindcss"` + `@theme { ... }` in
    `styles.css`; no `tailwind.config.js`)
  - Tailwind v4 auto-detects source files (no `content` config needed)
  - `ng serve` starts the dev server without errors

### T-055: Set up app shell (AppShellComponent, SidebarComponent, HeaderComponent)

- **Goal:** Create the root layout components: `AppShellComponent` (root layout with sidebar + header + router-outlet),
  `SidebarComponent` (navigation, tenant switcher, project list), and `HeaderComponent` (user menu, tenant indicator).
- **Files to create:**
  - `ui/src/app/shell/app-shell.component.ts`
  - `ui/src/app/shell/app-shell.component.html`
  - `ui/src/app/shell/app-shell.component.css`
  - `ui/src/app/shell/sidebar.component.ts`
  - `ui/src/app/shell/sidebar.component.html`
  - `ui/src/app/shell/sidebar.component.css`
  - `ui/src/app/shell/header.component.ts`
  - `ui/src/app/shell/header.component.html`
  - `ui/src/app/shell/header.component.css`
- **Dependencies:** T-054
- **Acceptance criteria:**
  - `AppShellComponent` renders sidebar, header, and `<router-outlet>`
  - `SidebarComponent` shows navigation links and project list
  - `HeaderComponent` shows user info and tenant indicator
  - All components are standalone (no NgModules)

### T-056: Configure standalone routing (app.routes.ts)

- **Goal:** Create `ui/src/app/app.routes.ts` with the full route configuration including functional guards
  (`CanActivateFn`) and functional resolvers using `resource()`.
- **Files to create:**
  - `ui/src/app/app.routes.ts`
- **Dependencies:** T-055
- **Acceptance criteria:**
  - Routes match the architecture spec: `/auth/login`, `/auth/register`, `/tenants/:tenantId/*`, `/dashboard`
  - `authGuard` (functional `CanActivateFn`) protects all app routes
  - `tenantGuard` (functional `CanActivateFn`) protects `/tenants/:tenantId/*`
  - `projectGuard` (functional `CanActivateFn`) protects `/tenants/:tenantId/projects/:projectId/*`
  - `projectResolver` (functional resolver using `resource()`) fetches project data before activating project routes

### T-057: Configure app providers (app.config.ts) with HTTP interceptors

- **Goal:** Create `ui/src/app/app.config.ts` that provides zoneless change detection, the router with component input
  binding, HttpClient with functional interceptors, and all feature services. No NgRx SignalStore — state is managed via
  plain signal-based services.
- **Files to create:**
  - `ui/src/app/app.config.ts`
- **Dependencies:** T-056
- **Acceptance criteria:**
  - Zoneless change detection is active by default (no `zone.js`)
  - `provideRouter(routes, withComponentInputBinding())` is configured
  - `provideHttpClient(withInterceptors([authInterceptor, tenantInterceptor, errorInterceptor]))` is configured
  - No `provideSignalStore()` — state stores are plain Angular services using signals
  - All services are provided at root level via `providedIn: 'root'`

### T-058: Implement auth interceptor (Bearer token)

- **Goal:** Create a functional HTTP interceptor `ui/src/app/interceptors/auth.interceptor.ts` that reads the JWT from
  `AuthStore` and attaches `Authorization: Bearer <token>` to outgoing requests.
- **Files to create:**
  - `ui/src/app/interceptors/auth.interceptor.ts`
- **Dependencies:** T-057, T-061
- **Acceptance criteria:**
  - Interceptor is a functional `HttpInterceptorFn` (not a class-based interceptor)
  - Every outgoing request includes `Authorization: Bearer <token>` header when user is authenticated
  - Requests to `/auth/*` do not include the header
  - Interceptor is registered in `app.config.ts`

### T-059: Implement tenant interceptor (X-Tenant-Id header)

- **Goal:** Create a functional HTTP interceptor `ui/src/app/interceptors/tenant.interceptor.ts` that reads the active
  tenant from `TenantService` and attaches `X-Tenant-Id` header to outgoing API requests.
- **Files to create:**
  - `ui/src/app/interceptors/tenant.interceptor.ts`
- **Dependencies:** T-057, T-062
- **Acceptance criteria:**
  - Interceptor is a functional `HttpInterceptorFn` (not a class-based interceptor)
  - Every outgoing API request includes `X-Tenant-Id` header when a tenant is active
  - Requests to `/auth/*` do not include the header
  - Interceptor is registered in `app.config.ts`

### T-060: Implement error interceptor

- **Goal:** Create a functional HTTP interceptor `ui/src/app/interceptors/error.interceptor.ts` that handles global
  error responses (401 → redirect to login, 403 → show permission denied, 422 → show validation errors).
- **Files to create:**
  - `ui/src/app/interceptors/error.interceptor.ts`
- **Dependencies:** T-057
- **Acceptance criteria:**
  - Interceptor is a functional `HttpInterceptorFn` (not a class-based interceptor)
  - 401 responses redirect to `/auth/login`
  - 403 responses show a permission-denied notification
  - 422 responses display validation error messages
  - Other errors show a generic error notification

### T-061: Implement AuthStore (signal-based)

- **Goal:** Create `ui/src/app/stores/auth.store.ts` as a plain Angular service (no NgRx) using `signal()` and
  `computed()` with `currentUser`, `isAuthenticated`, and `token` state, plus `login()` and `logout()` methods. Uses
  `inject()` for DI.
- **Files to create:**
  - `ui/src/app/stores/auth.store.ts`
- **Dependencies:** T-057
- **Acceptance criteria:**
  - AuthStore is a plain `@Injectable({ providedIn: 'root' })` service — no NgRx `signalStore`
  - `currentUser = signal<User | null>(null)` holds the current user or null
  - `isAuthenticated = computed(() => !!this.currentUser())` reflects auth state
  - `login(user, token)` updates all signals
  - `logout()` resets all signals and clears the stored JWT
  - Uses `inject(HttpClient)` for dependency injection

### T-062: Implement TenantService (signal-based, tenant switching)

- **Goal:** Create `ui/src/app/services/tenant.service.ts` as a plain Angular service using `signal()`, `computed()`,
  `linkedSignal()`, and `resource()` for reactive state management. No NgRx. Also create
  `ui/src/app/stores/tenant.store.ts`.
- **Files to create:**
  - `ui/src/app/services/tenant.service.ts`
  - `ui/src/app/stores/tenant.store.ts`
- **Dependencies:** T-057
- **Acceptance criteria:**
  - TenantService is a plain `@Injectable({ providedIn: 'root' })` service — no NgRx
  - `tenants = resource({ loader: () => this.fetchTenants() })` fetches tenant memberships reactively
  - `activeTenant = linkedSignal(() => this.tenants.value()?.[0] ?? null)` holds the active tenant (writable derived
    signal)
  - `setActiveTenant(tenant)` updates the active tenant via `linkedSignal.set()`
  - `tenantMembers` signal holds the user's tenant membership list
  - HTTP interceptor reads `activeTenant` and attaches `X-Tenant-Id` header
  - Uses `inject(HttpClient)` for dependency injection

### T-063: Implement authGuard, tenantGuard, projectGuard (functional guards)

- **Goal:** Create functional route guards (`CanActivateFn`) that protect routes based on authentication state, tenant
  membership, and project role. All guards are standalone functions using `inject()`.
- **Files to create:**
  - `ui/src/app/guards/auth.guard.ts`
  - `ui/src/app/guards/tenant.guard.ts`
  - `ui/src/app/guards/project.guard.ts`
- **Dependencies:** T-061, T-062
- **Acceptance criteria:**
  - `authGuard: CanActivateFn` — redirects to `/auth/login` if no authenticated user
  - `tenantGuard: CanActivateFn` — redirects if user is not a member of the active tenant
  - `projectGuard: CanActivateFn` — redirects if user has no project role
  - All guards are functional (not class-based) — e.g. `export const authGuard: CanActivateFn = () => { ... }`
  - All guards use `inject()` to resolve dependencies (AuthService, Router, TenantService)

### T-064: Implement login and register components

- **Goal:** Create `LoginComponent` and `RegisterComponent` with forms using Signal Forms, calling `AuthService` for
  registration and login.
- **Files to create:**
  - `ui/src/app/auth/login.component.ts`
  - `ui/src/app/auth/login.component.html`
  - `ui/src/app/auth/login.component.css`
  - `ui/src/app/auth/register.component.ts`
  - `ui/src/app/auth/register.component.html`
  - `ui/src/app/auth/register.component.css`
- **Dependencies:** T-063, T-061
- **Acceptance criteria:**
  - Login form submits email/password, calls `AuthService.login()`, stores JWT, redirects to dashboard
  - Register form submits name/email/password, calls `AuthService.register()`, stores JWT, redirects to dashboard
  - Validation errors are displayed inline
  - Signal Forms manage form state reactively

### T-065: Implement tenant switcher component

- **Goal:** Create `TenantSwitcherComponent` (dropdown) in the header that allows the user to switch the active tenant.
- **Files to create:**
  - `ui/src/app/shell/tenant-switcher.component.ts`
  - `ui/src/app/shell/tenant-switcher.component.html`
  - `ui/src/app/shell/tenant-switcher.component.css`
- **Dependencies:** T-062
- **Acceptance criteria:**
  - Dropdown shows all tenants the user belongs to
  - Selecting a tenant calls `TenantService.setActiveTenant(tenantId)`
  - Active tenant is highlighted in the dropdown
  - Switching tenant updates the `X-Tenant-Id` header for subsequent API calls

---

## Phase 7: Frontend Features

### T-066: Implement Angular services for API communication

- **Goal:** Create Angular injectable services (`AuthService`, `TenantService`, `ProjectService`, `BoardService`,
  `TaskService`, `SprintService`) that use `inject(HttpClient)` and return typed observables using shared package types.
  Data fetching uses `resource()` / `httpResource()` for reactive reads and direct `HttpClient` calls for mutations with
  signal-based loading/error state.
- **Files to create:**
  - `ui/src/app/services/auth.service.ts`
  - `ui/src/app/services/tenant.service.ts`
  - `ui/src/app/services/project.service.ts`
  - `ui/src/app/services/board.service.ts`
  - `ui/src/app/services/task.service.ts`
  - `ui/src/app/services/sprint.service.ts`
- **Dependencies:** T-057, T-016
- **Acceptance criteria:**
  - Services are plain `@Injectable({ providedIn: 'root' })` classes using `inject()` for DI (no constructor injection)
  - Read operations use `resource()` or `httpResource()` with signal integration for reactive data fetching
  - Mutation operations use direct `HttpClient` calls with signal-based `loading` / `error` state
  - Each service method returns a typed `Observable<T>` matching the shared contract
  - `X-Tenant-Id` header is attached to all API calls
  - `Authorization: Bearer <token>` header is attached to all authenticated API calls

### T-067: Implement project list/detail components

- **Goal:** Create `ProjectListComponent`, `ProjectDetailComponent`, and `ProjectMemberListComponent` with project CRUD
  operations.
- **Files to create:**
  - `ui/src/app/projects/project-list.component.ts`
  - `ui/src/app/projects/project-list.component.html`
  - `ui/src/app/projects/project-list.component.css`
  - `ui/src/app/projects/project-detail.component.ts`
  - `ui/src/app/projects/project-detail.component.html`
  - `ui/src/app/projects/project-detail.component.css`
  - `ui/src/app/projects/project-member-list.component.ts`
  - `ui/src/app/projects/project-member-list.component.html`
  - `ui/src/app/projects/project-member-list.component.css`
- **Dependencies:** T-066
- **Acceptance criteria:**
  - Project list shows all projects in the active tenant
  - Project creation modal/form works (admin+ only)
  - Project detail page shows project info and members
  - Project member management (add, update role, remove) works (admin+ only)
  - RBAC is enforced in the UI (admin-only actions hidden for non-admins)

### T-068: Implement board view component (Kanban with columns)

- **Goal:** Create `BoardViewComponent` that renders a Kanban board with columns and task cards, supporting
  drag-and-drop between columns.
- **Files to create:**
  - `ui/src/app/boards/board-view.component.ts`
  - `ui/src/app/boards/board-view.component.html`
  - `ui/src/app/boards/board-view.component.css`
- **Dependencies:** T-066
- **Acceptance criteria:**
  - Board view fetches board data with columns and tasks
  - Columns are rendered in order (by position)
  - Task cards are rendered within their respective columns
  - Drag-and-drop moves tasks between columns (calls `TaskService.moveTask()`)
  - Column creation is available (admin+ only)

### T-069: Implement column component with task cards

- **Goal:** Create `ColumnComponent` (renders a single column with its tasks) and `TaskCardComponent` (displays task
  summary).
- **Files to create:**
  - `ui/src/app/boards/column.component.ts`
  - `ui/src/app/boards/column.component.html`
  - `ui/src/app/boards/column.component.css`
  - `ui/src/app/boards/task-card.component.ts`
  - `ui/src/app/boards/task-card.component.html`
  - `ui/src/app/boards/task-card.component.css`
- **Dependencies:** T-068
- **Acceptance criteria:**
  - `ColumnComponent` renders column name and task cards
  - `TaskCardComponent` displays task title, priority, and assignees
  - Clicking a task card opens the task detail view
  - Drag-and-drop events are handled on the column component

### T-070: Implement task card component and task detail/form components

- **Goal:** Create `TaskDetailComponent`, `TaskFormComponent`, and `TaskListComponent` for task CRUD and assignment.
- **Files to create:**
  - `ui/src/app/tasks/task-detail.component.ts`
  - `ui/src/app/tasks/task-detail.component.html`
  - `ui/src/app/tasks/task-detail.component.css`
  - `ui/src/app/tasks/task-form.component.ts`
  - `ui/src/app/tasks/task-form.component.html`
  - `ui/src/app/tasks/task-form.component.css`
  - `ui/src/app/tasks/task-list.component.ts`
  - `ui/src/app/tasks/task-list.component.html`
  - `ui/src/app/tasks/task-list.component.css`
- **Dependencies:** T-066
- **Acceptance criteria:**
  - Task form uses Angular Signal Forms (not `FormGroup`/`FormControl`) for reactive form state
  - Task form supports create and edit with title, description, priority, assignee picker, sprint selector
  - Task detail shows full task info including assignees, status, and sprint
  - Task list supports filtering by project, board, column, sprint, assignee
  - Assignee picker allows adding/removing assignees
  - RBAC is enforced in the UI (viewer cannot create/edit/delete)

### T-071: Implement sprint list/detail/backlog components

- **Goal:** Create `SprintListComponent`, `SprintDetailComponent`, and `SprintBacklogComponent` for sprint CRUD and
  backlog → sprint movement.
- **Files to create:**
  - `ui/src/app/sprints/sprint-list.component.ts`
  - `ui/src/app/sprints/sprint-list.component.html`
  - `ui/src/app/sprints/sprint-list.component.css`
  - `ui/src/app/sprints/sprint-detail.component.ts`
  - `ui/src/app/sprints/sprint-detail.component.html`
  - `ui/src/app/sprints/sprint-detail.component.css`
  - `ui/src/app/sprints/sprint-backlog.component.ts`
  - `ui/src/app/sprints/sprint-backlog.component.html`
  - `ui/src/app/sprints/sprint-backlog.component.css`
- **Dependencies:** T-066
- **Acceptance criteria:**
  - Sprint list shows all sprints for a project
  - Sprint creation form works (admin+ only)
  - Sprint detail shows sprint info and tasks
  - Backlog view shows tasks not in any sprint
  - Moving tasks from backlog into sprint works (calls `SprintService.addTaskToSprint()`)
  - Removing tasks from sprint moves them back to backlog
  - RBAC is enforced in the UI (viewer cannot create/manage sprints)

### T-072: Implement dashboard component

- **Goal:** Create `DashboardComponent` that provides an overview of projects, boards, and recent activity.
- **Files to create:**
  - `ui/src/app/dashboard/dashboard.component.ts`
  - `ui/src/app/dashboard/dashboard.component.html`
  - `ui/src/app/dashboard/dashboard.component.css`
- **Dependencies:** T-066
- **Acceptance criteria:**
  - Dashboard shows a list of the user's tenants
  - Dashboard shows recent projects and boards for the active tenant
  - Dashboard shows recent task activity
  - Navigation from dashboard to tenant/project/board views works

### T-073: Implement shared UI components

- **Goal:** Create reusable shared UI components (`UiButtonComponent`, `UiModalComponent`, `UiSpinnerComponent`) using
  Spartan UI and Tailwind CSS.
- **Files to create:**
  - `ui/src/app/shared/ui-button.component.ts`
  - `ui/src/app/shared/ui-button.component.html`
  - `ui/src/app/shared/ui-button.component.css`
  - `ui/src/app/shared/ui-modal.component.ts`
  - `ui/src/app/shared/ui-modal.component.html`
  - `ui/src/app/shared/ui-modal.component.css`
  - `ui/src/app/shared/ui-spinner.component.ts`
  - `ui/src/app/shared/ui-spinner.component.html`
  - `ui/src/app/shared/ui-spinner.component.css`
- **Dependencies:** T-054
- **Acceptance criteria:**
  - `UiButtonComponent` supports variants (primary, secondary, danger, ghost) and sizes
  - `UiModalComponent` supports open/close state and slot-based content
  - `UiSpinnerComponent` shows a loading spinner
  - All components are standalone and use Spartan UI primitives (`@spartan-ng/brain` + `@spartan-ng/helm` v0.12.0) where
    applicable
  - Tailwind CSS v4.1.0 utility classes are used for styling (CSS-first config; no `tailwind.config.js`)

---

## Phase 8: Integration & Polish

### T-074: Connect frontend to backend (end-to-end API integration)

- **Goal:** Wire all Angular services to the Hono backend, verify the full auth → tenant → project → board → task →
  sprint flow works end-to-end.
- **Files to modify:**
  - All Angular services (T-066)
  - All Angular components (T-067 through T-072)
  - `ui/src/app/app.config.ts` (T-057) — ensure base URL is configurable
- **Dependencies:** T-049, T-052, T-066, T-067, T-068, T-069, T-070, T-071
- **Acceptance criteria:**
  - Full user journey works: register → create tenant → create project → create board → create task → move task → create
    sprint → add task to sprint
  - All API calls return expected data and update the UI correctly
  - Tenant isolation is verified (user from tenant A cannot see tenant B's data)
  - RBAC is verified in the UI (viewer cannot create/edit/delete; unauthorized actions are hidden)

### T-075: Write unit tests for shared package schemas and types

- **Goal:** Add Vitest 4.0.0 unit tests for all Zod v4 schemas in the shared package, verifying valid and invalid inputs
  with `z.interface()` schemas.
- **Files to create:**
  - `shared/src/schemas/auth.spec.ts`
  - `shared/src/schemas/tenant.spec.ts`
  - `shared/src/schemas/project.spec.ts`
  - `shared/src/schemas/board.spec.ts`
  - `shared/src/schemas/task.spec.ts`
  - `shared/src/schemas/sprint.spec.ts`
  - `shared/src/schemas/common.spec.ts`
  - `shared/src/validators/uuid.spec.ts`
  - `shared/src/validators/slug.spec.ts`
  - `shared/src/validators/pagination.spec.ts`
- **Dependencies:** T-016
- **Acceptance criteria:**
  - All schema tests pass (valid inputs parse, invalid inputs throw with Zod v4 `.issues` format)
  - Test coverage ≥ 80% on shared package
  - `npm test --workspace=shared` runs all tests (Vitest 4.0.0)

### T-076: Write unit tests for backend services and repositories

- **Goal:** Add Vitest unit tests for all backend services and repositories, mocking the MongoDB collection.
- **Files to create:**
  - `server/src/repositories/tenant.repository.spec.ts`
  - `server/src/repositories/user.repository.spec.ts`
  - `server/src/repositories/project.repository.spec.ts`
  - `server/src/repositories/board.repository.spec.ts`
  - `server/src/repositories/column.repository.spec.ts`
  - `server/src/repositories/task.repository.spec.ts`
  - `server/src/repositories/sprint.repository.spec.ts`
  - `server/src/repositories/tenant-member.repository.spec.ts`
  - `server/src/repositories/project-member.repository.spec.ts`
  - `server/src/services/auth.service.spec.ts`
  - `server/src/services/tenant.service.spec.ts`
  - `server/src/services/project.service.spec.ts`
  - `server/src/services/board.service.spec.ts`
  - `server/src/services/column.service.spec.ts`
  - `server/src/services/task.service.spec.ts`
  - `server/src/services/sprint.service.spec.ts`
  - `server/src/services/rbac.service.spec.ts`
- **Dependencies:** T-024, T-034, T-040, T-046, T-049, T-052
- **Acceptance criteria:**
  - All service and repository tests pass
  - Test coverage ≥ 80% on services and repositories
  - `npm test --workspace=server` runs all tests
  - Tenant isolation is tested (cross-tenant queries return empty/not found)
  - RBAC permission checks are tested for all roles

### T-077: Write E2E tests with Playwright 1.55.0 (critical user journeys)

- **Goal:** Add Playwright 1.55.0 E2E tests covering the critical user journeys from the technical specification.
- **Files to create:**
  - `ui/e2e/auth.spec.ts`
  - `ui/e2e/tenant.spec.ts`
  - `ui/e2e/project.spec.ts`
  - `ui/e2e/board.spec.ts`
  - `ui/e2e/task.spec.ts`
  - `ui/e2e/sprint.spec.ts`
  - `ui/e2e/rbac.spec.ts`
- **Dependencies:** T-074
- **Acceptance criteria:**
  - E2E tests cover: register → create tenant → create project → create board → create task → move task → create sprint
    → add task to sprint
  - E2E tests verify tenant isolation (user from tenant A cannot access tenant B's data)
  - E2E tests verify RBAC in the UI (viewer cannot create/edit/delete)
  - `npm run e2e --workspace=ui` runs all tests (Playwright 1.55.0)

### T-078: Set up CI/CD pipeline (GitHub Actions)

- **Goal:** Create `.github/workflows/deploy.yml` with build, test, lint, and deploy steps for all three packages.
- **Files to create:**
  - `.github/workflows/deploy.yml`
- **Dependencies:** T-075, T-076, T-077
- **Acceptance criteria:**
  - CI pipeline runs on push to `main` and pull requests
  - Build succeeds for all three packages (shared, server, ui)
  - Tests pass for all three packages
  - Linting passes for all three packages
  - Deployment steps are configured for Cloudflare Pages and Workers

### T-079: Configure deployment (Cloudflare Pages + Workers)

- **Goal:** Configure `wrangler.toml` for the server, set up Cloudflare Pages project configuration, and verify the
  deployment pipeline works.
- **Files to modify:**
  - `server/wrangler.toml`
  - `ui/angular.json` (build output configuration for Pages)
- **Dependencies:** T-078
- **Acceptance criteria:**
  - `wrangler deploy` deploys the Hono API to Cloudflare Workers
  - `wrangler pages deploy ui/dist` deploys the Angular SPA to Cloudflare Pages
  - SPA fallback is configured (all non-API routes → index.html)
  - Environment variables (`MONGODB_URI`, `JWT_SECRET`, `CORS_ORIGIN`) are configured as Cloudflare secrets

### T-080: Run full test suite, linting, type checking, and build verification

- **Goal:** Run the complete quality gate suite across the entire monorepo and fix any issues.
- **Files to modify:**
  - Various (fix any issues found)
- **Dependencies:** T-075, T-076, T-077, T-078, T-079
- **Acceptance criteria:**
  - `npm run build` succeeds for all workspaces
  - `npm test` passes for all workspaces (≥ 80% coverage on services/repositories)
  - `npm run lint` passes with zero errors
  - `tsc --noEmit` passes across the entire monorepo (zero TypeScript errors)
  - All Playwright E2E tests pass
  - The full user journey (register → create tenant → create project → create board → create task → move task → create
    sprint → add task to sprint) works end-to-end

---

## Vertical Slice Mapping

The first deployable vertical slice delivers the **core Kanban flow** end-to-end: auth → tenant → project → board →
tasks → sprints, with RBAC enforced throughout.

### Backend vertical slice tasks

| Step | Feature                            | Tasks                                         |
| ---- | ---------------------------------- | --------------------------------------------- |
| 1    | **Auth**                           | T-029, T-030, T-031                           |
| 2    | **Tenant context**                 | T-026, T-027, T-028, T-032, T-033, T-034      |
| 3    | **Project CRUD**                   | T-035, T-036, T-037, T-038, T-039, T-040      |
| 4    | **Board + Columns**                | T-041, T-042, T-043, T-044, T-045, T-046      |
| 5    | **Task CRUD + Move**               | T-047, T-048, T-049                           |
| 6    | **Sprint CRUD + Backlog → Sprint** | T-050, T-051, T-052                           |
| 7    | **RBAC enforcement**               | T-053 (RBAC service), T-022 (RBAC middleware) |

### Frontend vertical slice tasks

| Step | Feature                            | Tasks                                                                         |
| ---- | ---------------------------------- | ----------------------------------------------------------------------------- |
| 1    | **Auth pages**                     | T-064                                                                         |
| 2    | **Tenant context**                 | T-061, T-062, T-065                                                           |
| 3    | **Project CRUD**                   | T-067                                                                         |
| 4    | **Board + Columns**                | T-068, T-069                                                                  |
| 5    | **Task CRUD + Move**               | T-070                                                                         |
| 6    | **Sprint CRUD + Backlog → Sprint** | T-071                                                                         |
| 7    | **RBAC in UI**                     | T-063 (guards), T-073 (shared UI), T-066 (services with RBAC-aware rendering) |

### Foundation tasks (required before the slice)

| Category            | Tasks               |
| ------------------- | ------------------- |
| Scaffolding         | T-001 through T-004 |
| Shared package      | T-005 through T-016 |
| Backend foundation  | T-017 through T-025 |
| Frontend foundation | T-054 through T-060 |

### Integration task

| Task  | Description                                                     |
| ----- | --------------------------------------------------------------- |
| T-074 | Connect frontend to backend and verify the full end-to-end flow |

---

## Execution Order Summary

The tasks are ordered for execution as follows:

1. **Phase 0** (T-001–T-004): Scaffold the monorepo, tooling, and directory structure
2. **Phase 1** (T-005–T-016): Build the shared package (types, schemas, contracts, validators)
3. **Phase 2** (T-017–T-025): Set up the backend foundation (server skeleton, MongoDB, middleware pipeline, Hono
   bootstrap)
4. **Phase 3** (T-026–T-034): Implement tenant & user management (auth, tenant CRUD, member management)
5. **Phase 4** (T-035–T-046): Implement projects & boards (project CRUD, board + column CRUD)
6. **Phase 5** (T-047–T-053): Implement sprints & collaboration (task CRUD, sprint CRUD, RBAC service)
7. **Phase 6** (T-054–T-065): Build the frontend foundation (Angular app shell, routing, interceptors, stores, guards,
   auth pages)
8. **Phase 7** (T-066–T-073): Build frontend features (services, project/board/task/sprint UI, dashboard, shared
   components)
9. **Phase 8** (T-074–T-080): Integration, testing, CI/CD, deployment, and hardening
