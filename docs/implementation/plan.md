# Task Board MVP — Implementation Plan

> **Version:** 4.0.0 **Date:** 2026-07-30 **Status:** Approved **Reference:**
> [Technical Specification v4.0.0](../implementation/technical_specification.md) ·
> [Architecture v4.0.0](../implementation/architecture.md) · [Project Description](../project_description.md)

---

## Summary

- **Total tasks:** 148
- **Phases:** 12 (Phase 0–Phase 11)
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

- **Goal:** Create `ui/src/app/stores/auth-store.ts` as a plain Angular service (no NgRx) using `signal()` with
  `currentUser` and `token` state, plus `login()`, `logout()` and `fetchCurrentUser()` methods. Uses `inject()` for DI.
- **Files to create:**
  - `ui/src/app/stores/auth-store.ts`
- **Dependencies:** T-057
- **Acceptance criteria:**
  - AuthStore is a plain `@Service()` service — no NgRx `signalStore`
  - `currentUser = signal<User | null>(null)` holds the current user or null
  - `token = signal<string | null>(null)` holds the JWT (restored from localStorage in constructor)
  - Auth state is determined by `currentUser()` (loaded) or `token()` (awaiting validation) — no `isAuthenticated`
    computed signal
  - `fetchCurrentUser()` returns `Observable<User>` — the `authGuard` awaits this to validate the token before allowing
    navigation
  - `login()` and `logout()` manage state and localStorage
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

## Phase 9: Missing UI Features

> **Reference:** [Technical Specification §12](technical_specification.md:1120) ·
> [Architecture §11](architecture.md:1300)

This phase implements three UI feature areas that have working backend endpoints but no Angular frontend: tenant
settings, tenant member management, and project member management.

### T-081: Add GET /tenants/:tenantId/members route to server

- **Goal:** Add the missing `GET /:tenantId/members` endpoint to the tenant routes file. The service method
  `TenantService.getTenantMembers()` and the shared contract `tenantContracts.listMembers` already exist.
- **Files to modify:**
  - [`server/src/routes/tenants.ts`](server/src/routes/tenants.ts:94)
- **Dependencies:** None
- **Acceptance criteria:**
  - `GET /api/v1/tenants/:tenantId/members` returns `{ data: TenantMember[], total: number }`
  - Any authenticated tenant member can view the list (no owner/admin restriction)
  - Route is registered **before** `POST /:tenantId/members` to avoid path parameter collision
  - Manual `curl` test confirms 200 with member data

### T-082: Add tenantRole computed signal to AuthStore

- **Goal:** Add a `tenantRole` computed signal to [`AuthStore`](ui/src/app/stores/auth-store.ts:13) that decodes the JWT
  payload to extract the current user's tenant role.
- **Files to modify:**
  - [`ui/src/app/stores/auth-store.ts`](ui/src/app/stores/auth-store.ts:13)
- **Dependencies:** None
- **Acceptance criteria:**
  - `readonly tenantRole = computed(() => ...)` returns `TenantRole | null`
  - Signal decodes JWT payload via `atob(token.split('.')[1])` and extracts `tenantRole`
  - Signal returns `null` when no token is stored
  - Signal updates reactively when token changes (e.g., after login/logout)
  - `TenantRole` type is imported from `@task-board/shared`

### T-083: Extend TenantClient with tenant update/delete methods

- **Goal:** Add [`updateTenant()`](ui/src/app/services/tenant-client.ts:13) and
  [`deleteTenant()`](ui/src/app/services/tenant-client.ts:13) methods to
  [`TenantClient`](ui/src/app/services/tenant-client.ts:13), plus post-mutation signal updates.
- **Files to modify:**
  - [`ui/src/app/services/tenant-client.ts`](ui/src/app/services/tenant-client.ts:13)
- **Dependencies:** None
- **Acceptance criteria:**
  - `updateTenant(tenantId: string, data: UpdateTenant): Observable<Tenant>` calls `PATCH /tenants/:tenantId`
  - `deleteTenant(tenantId: string): Observable<void>` calls `DELETE /tenants/:tenantId`
  - `UpdateTenant` and `Tenant` types imported from `@task-board/shared`
  - After `updateTenant` succeeds, `tenants` and `activeTenant` signals are updated to reflect new name/slug
  - After `deleteTenant` succeeds, tenant is removed from `tenants` signal; `activeTenant` is cleared if it was the
    deleted tenant

### T-084: Extend TenantClient with tenant member methods

- **Goal:** Add [`listMembers()`](ui/src/app/services/tenant-client.ts:13),
  [`inviteMember()`](ui/src/app/services/tenant-client.ts:13),
  [`updateMemberRole()`](ui/src/app/services/tenant-client.ts:13), and
  [`removeMember()`](ui/src/app/services/tenant-client.ts:13) methods to
  [`TenantClient`](ui/src/app/services/tenant-client.ts:13).
- **Files to modify:**
  - [`ui/src/app/services/tenant-client.ts`](ui/src/app/services/tenant-client.ts:13)
- **Dependencies:** None
- **Acceptance criteria:**
  - `listMembers(tenantId): Observable<{ data: TenantMember[] }>` calls `GET /tenants/:tenantId/members`
  - `inviteMember(tenantId, email, role): Observable<TenantMember>` calls `POST /tenants/:tenantId/members` with
    `{ email, role }`
  - `updateMemberRole(tenantId, userId, role): Observable<TenantMember>` calls
    `PATCH /tenants/:tenantId/members/:userId` with `{ role }`
  - `removeMember(tenantId, userId): Observable<void>` calls `DELETE /tenants/:tenantId/members/:userId`
  - `TenantMember` and `TenantRole` types imported from `@task-board/shared`

### T-085: Create TenantSettingsComponent

- **Goal:** Create the tenant settings page with editable name/slug form (owner/admin) and danger zone delete section
  (owner only), following the design in [§12.2.4](technical_specification.md:1362).
- **Files to create:**
  - `ui/src/app/features/tenants/tenant-settings/tenant-settings.ts`
  - `ui/src/app/features/tenants/tenant-settings/tenant-settings.html`
- **Dependencies:** T-082, T-083
- **Acceptance criteria:**
  - Selector: `ui-tenant-settings`; standalone component
  - Page displays editable name and slug fields pre-populated from `TenantClient.activeTenant()`
  - "Save" button calls `TenantClient.updateTenant()` — visible only for owner/admin
  - "Danger Zone" section with "Delete Tenant" button — visible only for owner
  - Delete confirmation dialog requires typing the tenant name to confirm
  - After successful delete, redirects to `/dashboard`
  - Members see read-only view (inputs disabled, no save/delete buttons)
  - RBAC via `computed()` signals reading `AuthStore.tenantRole()`
  - Uses Spartan UI: `HlmButtonImports`, `HlmDialogImports`, `HlmFieldImports`, `HlmInputImports`, `HlmSpinnerImports`
  - Error states displayed inline (422 slug conflict)
  - Angular 22 patterns: signals, `@if`/`@for`, `inject()`, `FormsModule` with `ngModel`

### T-086: Create TenantMemberListComponent

- **Goal:** Create the tenant member list page with invite dialog, inline role editing, and remove confirmation,
  following the design in [§12.1.4](technical_specification.md:1186).
- **Files to create:**
  - `ui/src/app/features/tenants/tenant-member-list/tenant-member-list.ts`
  - `ui/src/app/features/tenants/tenant-member-list/tenant-member-list.html`
- **Dependencies:** T-082, T-084
- **Acceptance criteria:**
  - Selector: `ui-tenant-member-list`; standalone component
  - Member list displays avatar fallback, userId, and role for each member
  - "Invite Member" button (owner/admin) opens dialog with email input and role `NativeSelect`
  - Invite submits `POST /tenants/:tenantId/members` via `TenantClient.inviteMember()`; list refreshes on success
  - Inline role change via `NativeSelect` dropdown — owner/admin only, disabled for the owner row
  - "Remove" button with confirmation dialog — owner/admin only, disabled for the owner row
  - Members see read-only view (role badge, no action buttons)
  - Error states displayed inline (422 validation, 409 duplicate)
  - Uses Spartan UI: `HlmButtonImports`, `HlmDialogImports`, `HlmFieldImports`, `HlmInputImports`,
    `HlmNativeSelectImports`, `HlmBadgeImports`, `HlmAvatarImports`, `HlmSpinnerImports`
  - Angular 22 patterns: signals, `@if`/`@for`, `computed()`, `inject()`, `FormsModule` with `ngModel`

### T-087: Add tenant settings routes and sidebar Settings link

- **Goal:** Wire tenant settings and member list routes into [`app.routes.ts`](ui/src/app/app.routes.ts:26), and add a
  "Settings" navigation link to [`sidebar.html`](ui/src/app/shell/sidebar/sidebar.html:1).
- **Files to modify:**
  - [`ui/src/app/app.routes.ts`](ui/src/app/app.routes.ts:26)
  - [`ui/src/app/shell/sidebar/sidebar.html`](ui/src/app/shell/sidebar/sidebar.html:1)
- **Dependencies:** T-085, T-086
- **Acceptance criteria:**
  - `/tenants/:tenantId/settings` lazy-loads `TenantSettings` component
  - `/tenants/:tenantId/settings/members` lazy-loads `TenantMemberList` component
  - Both routes are children of the existing `tenants/:tenantId` route in `app.routes.ts`
  - Sidebar shows "Settings" link with `i-lucide-settings` icon inside the `@if (tenantService.activeTenant())` block
  - Link navigates to `/tenants/:tenantId/settings` using `routerLink`
  - Link uses `routerLinkActive` for active state styling consistent with Projects/Sprints links
  - No additional guards needed — RBAC enforced inside components via computed signals

### T-088: Extend ProjectDetailComponent with member management controls

- **Goal:** Add "Add Member" dialog, inline role editing, and remove button to the members section of
  [`ProjectDetail`](ui/src/app/features/projects/project-detail/project-detail.ts:38), following the design in
  [§12.3.3](technical_specification.md:1507).
- **Files to modify:**
  - [`ui/src/app/features/projects/project-detail/project-detail.ts`](ui/src/app/features/projects/project-detail/project-detail.ts:38)
  - [`ui/src/app/features/projects/project-detail/project-detail.html`](ui/src/app/features/projects/project-detail/project-detail.html:54)
- **Dependencies:** T-081, T-082, T-084
- **Acceptance criteria:**
  - "Add Member" button visible only for project admins (`canManageProjectMembers` computed signal)
  - Add-member dialog shows tenant member list (from `TenantClient.listMembers()`) as user picker dropdown + role
    `NativeSelect`
  - Submitting calls `ProjectClient.addMember(projectId, userId, role)`; member list refreshes on success
  - Inline role change via `NativeSelect` dropdown — project admin only
  - "Remove" button with confirmation dialog — project admin only
  - Non-admin users see read-only member list (existing behavior preserved)
  - New signals: `showAddMember`, `addingMember`, `selectedUserId`, `selectedRole`
  - New computed: `canManageProjectMembers`, `currentUserProjectRole`
  - `HlmNativeSelectImports` added to component imports
  - Error states displayed inline (409 duplicate, 403 last admin)

### T-089: Unit tests for TenantClient and AuthStore extensions

- **Goal:** Add unit tests for the six new [`TenantClient`](ui/src/app/services/tenant-client.ts:13) methods and the
  [`AuthStore.tenantRole`](ui/src/app/stores/auth-store.ts:13) computed signal.
- **Files to create:**
  - `ui/src/app/services/tenant-client.spec.ts`
- **Files to modify:**
  - [`ui/src/app/stores/auth-store.spec.ts`](ui/src/app/stores/auth-store.spec.ts)
- **Dependencies:** T-082, T-083, T-084
- **Acceptance criteria:**
  - Tests cover all 6 new TenantClient methods: `listMembers`, `inviteMember`, `updateMemberRole`, `removeMember`,
    `updateTenant`, `deleteTenant`
  - Each test verifies correct HTTP method, URL, and request body
  - Tests verify signal updates (`tenants`, `activeTenant`) after successful mutations
  - Tests verify `deleteTenant` clears `activeTenant` when the deleted tenant was active
  - AuthStore tests cover `tenantRole`: valid token → extracts role, null token → returns null, invalid token → returns
    null
  - Coverage ≥ 80% on new code

### T-090: Unit tests for TenantSettingsComponent

- **Goal:** Add unit tests for
  [`TenantSettingsComponent`](ui/src/app/features/tenants/tenant-settings/tenant-settings.ts) covering RBAC visibility,
  form submission, and delete flow.
- **Files to create:**
  - `ui/src/app/features/tenants/tenant-settings/tenant-settings.spec.ts`
- **Dependencies:** T-085
- **Acceptance criteria:**
  - Tests verify form fields are pre-populated from `activeTenant()`
  - Tests verify "Save" button calls `updateTenant()` for owner and admin roles
  - Tests verify "Save" button is hidden/disabled for tenant members
  - Tests verify "Delete Tenant" button is visible only for owner
  - Tests verify delete confirmation requires typing exact tenant name
  - Tests verify read-only mode for tenant members (inputs disabled)
  - Coverage ≥ 80%

### T-091: Unit tests for TenantMemberListComponent

- **Goal:** Add unit tests for
  [`TenantMemberListComponent`](ui/src/app/features/tenants/tenant-member-list/tenant-member-list.ts) covering the
  invite, role change, and remove flows.
- **Files to create:**
  - `ui/src/app/features/tenants/tenant-member-list/tenant-member-list.spec.ts`
- **Dependencies:** T-086
- **Acceptance criteria:**
  - Tests verify member list renders correctly with avatar, userId, and role
  - Tests verify "Invite Member" button is visible for owner/admin, hidden for members
  - Tests verify invite dialog submits with email and role
  - Tests verify inline role change calls `updateMemberRole()`
  - Tests verify "Remove" button calls `removeMember()` after confirmation
  - Tests verify owner row has no edit/remove controls
  - Tests verify read-only view for tenant members
  - Coverage ≥ 80%

### T-092: Unit tests for ProjectDetailComponent member management

- **Goal:** Add unit tests for the new member management controls in
  [`ProjectDetailComponent`](ui/src/app/features/projects/project-detail/project-detail.ts:38).
- **Files to create:**
  - `ui/src/app/features/projects/project-detail/project-detail.spec.ts`
- **Dependencies:** T-088
- **Acceptance criteria:**
  - Tests verify "Add Member" button visibility based on project role
  - Tests verify add-member dialog shows tenant members as user picker options
  - Tests verify add-member submits with selected userId and role
  - Tests verify inline role change calls `updateMemberRole()`
  - Tests verify "Remove" calls `removeMember()` after confirmation
  - Tests verify non-admin users see read-only member list
  - Coverage ≥ 80%

### T-093: E2E tests for tenant settings, tenant members, and project members

- **Goal:** Add Playwright 1.55.0 E2E tests covering the three new UI feature areas.
- **Files to create:**
  - `ui/e2e/tenant-settings.spec.ts`
  - `ui/e2e/tenant-members.spec.ts`
  - `ui/e2e/project-members.spec.ts`
- **Dependencies:** T-087, T-088
- **Acceptance criteria:**
  - E2E: tenant owner can navigate to settings, edit name/slug, and save
  - E2E: tenant owner can invite a member by email, change their role, and remove them
  - E2E: tenant delete flow works with name confirmation and redirects to dashboard
  - E2E: project admin can add a tenant member to the project, change role, and remove
  - E2E: non-admin users see read-only views on settings and member pages
  - `npx playwright test` passes for all three spec files

### T-094: Full integration verification of new UI features

- **Goal:** Run the complete quality gate suite across the entire monorepo and verify all new features work end-to-end.
  Fix any issues found.
- **Files to modify:**
  - Various (fix any issues found during verification)
- **Dependencies:** T-089, T-090, T-091, T-092, T-093
- **Acceptance criteria:**
  - `npm run build` succeeds for all workspaces (shared, server, ui)
  - `npm test` passes for all workspaces (≥ 80% coverage on new code)
  - `npm run lint` passes with zero errors
  - `tsc --noEmit` passes across the entire monorepo (zero TypeScript errors)
  - Full user journey works end-to-end: register → create tenant → open settings → edit name → invite member → create
    project → add project member → change project member role → remove project member → remove tenant member → delete
    tenant

---

## Phase 10: User Workflow Rework

> Implements v3.0.0 changes: registration no longer auto-creates a tenant, subscription tiers (free/premium) with
> limits, and email-based invitation system supporting unregistered users. See
> [Technical Specification §13–14](technical_specification.md:1812) and [Architecture §7](architecture.md:1097).

### T-095: Add MemberStatus and SubscriptionTier constants to shared package

- **Goal:** Add the two new constant arrays to [`shared/src/constants/roles.ts`](shared/src/constants/roles.ts:1) and
  export them from the barrel file.
- **Files to modify:**
  - [`shared/src/constants/roles.ts`](shared/src/constants/roles.ts:1)
  - [`shared/src/index.ts`](shared/src/index.ts:1)
- **Dependencies:** T-016 (shared package skeleton)
- **Acceptance criteria:**
  - `MemberStatus` is `['active', 'pending', 'declined'] as const`
  - `SubscriptionTier` is `['free', 'premium'] as const`
  - Both are exported from [`shared/src/index.ts`](shared/src/index.ts:1)
  - `tsc --noEmit` passes in the shared package

### T-096: Update shared tenant schemas and types for subscription and invitation

- **Goal:** Add `subscription` field to [`TenantSchema`](shared/src/schemas/tenant.ts:8), update
  [`TenantMemberSchema`](shared/src/schemas/tenant.ts:68) with new fields (nullable `userId`, `status`, `invitedEmail`,
  `invitationToken`, `invitedAt`), add [`InviteMemberSchema`](shared/src/schemas/tenant.ts) for the invite-by-email
  body, and update derived types.
- **Files to modify:**
  - [`shared/src/schemas/tenant.ts`](shared/src/schemas/tenant.ts:1)
  - [`shared/src/types/tenant.ts`](shared/src/types/tenant.ts:1)
- **Dependencies:** T-095
- **Acceptance criteria:**
  - `TenantSchema` includes `subscription: z.enum(SubscriptionTier)`
  - `TenantMemberSchema` includes `status`, `invitedEmail` (nullable), `invitationToken` (nullable), `invitedAt`
    (nullable), and `userId` is nullable (`z.uuid().nullable()`)
  - `InviteMemberSchema` validates `{ email: z.email(), role: z.enum(TenantRole) }`
  - `CreateTenantSchema` includes optional `subscription` field with default `'free'`
  - All derived types (`Tenant`, `TenantMember`, `InviteMember`, `CreateTenant`) are correct
  - `tsc --noEmit` passes in the shared package

### T-097: Add invitation schemas and types to shared auth package

- **Goal:** Add [`AcceptInvitationSchema`](shared/src/schemas/auth.ts) and
  [`InvitationDetailsSchema`](shared/src/schemas/auth.ts) to the auth schemas, update derived types.
- **Files to modify:**
  - [`shared/src/schemas/auth.ts`](shared/src/schemas/auth.ts:1)
  - [`shared/src/types/auth.ts`](shared/src/types/auth.ts:1)
- **Dependencies:** T-096
- **Acceptance criteria:**
  - `AcceptInvitationSchema` validates `{ token: z.string().min(1) }`
  - `InvitationDetailsSchema` validates `{ tenantName, invitedEmail, role, status }`
  - `AuthResponseSchema` is unchanged (still returns `{ token, user }`)
  - Derived types `AcceptInvitation` and `InvitationDetails` are exported
  - `tsc --noEmit` passes in the shared package

### T-098: Update shared API contracts and barrel exports for invitation flow

- **Goal:** Update [`tenant.contracts.ts`](shared/src/contracts/tenant.contracts.ts:1) so `addMember` body uses
  `InviteMemberSchema` (`{ email, role }`) instead of `{ userId, role }`. Add `acceptInvitation` and `getInvitation`
  contracts to [`auth.contracts.ts`](shared/src/contracts/auth.contracts.ts:1). Update barrel exports in
  [`shared/src/index.ts`](shared/src/index.ts:1).
- **Files to modify:**
  - [`shared/src/contracts/tenant.contracts.ts`](shared/src/contracts/tenant.contracts.ts:1)
  - [`shared/src/contracts/auth.contracts.ts`](shared/src/contracts/auth.contracts.ts:1)
  - [`shared/src/index.ts`](shared/src/index.ts:1)
- **Dependencies:** T-096, T-097
- **Acceptance criteria:**
  - `tenantContracts.addMember.body` validates `{ email, role }` using `InviteMemberSchema`
  - `authContracts.acceptInvitation` defines `POST /auth/accept-invitation` with `AcceptInvitationSchema` body
  - `authContracts.getInvitation` defines `GET /invitations/:token` (public, no auth)
  - All new schemas, types, and constants are exported from [`shared/src/index.ts`](shared/src/index.ts:1)
  - `tsc --noEmit` passes across the monorepo

### T-099: Update TenantMemberRepository for new fields, nullable userId, and invitation queries

- **Goal:** Update [`TenantMemberDocument`](server/src/repositories/tenant-member.repository.ts:6) shape to include
  `status`, `invitedEmail`, `invitationToken`, `invitedAt`, and nullable `userId`. Add invitation lookup methods and
  ensure new MongoDB indexes are created.
- **Files to modify:**
  - [`server/src/repositories/tenant-member.repository.ts`](server/src/repositories/tenant-member.repository.ts:1)
- **Dependencies:** T-096
- **Acceptance criteria:**
  - `TenantMemberDocument` includes `status: string`, `invitedEmail: string | null`, `invitationToken: string | null`,
    `invitedAt: Date | null`, `userId: string | null`
  - `create()` accepts new fields (`status`, `invitedEmail`, `invitationToken`, `invitedAt`)
  - New method `findByInvitationToken(token: string): Promise<TenantMember | null>` — queries by `invitationToken` index
  - New method `findByInvitedEmailAndTenant(email: string, tenantId: string): Promise<TenantMember | null>`
  - New method `findActiveByUser(userId: string): Promise<TenantMember[]>` — filters by `{ userId, status: 'active' }`
  - `toDomain()` mapper maps all new fields
  - `delete()` works with nullable userId (use `invitationToken` or `_id` for pending members)
  - MongoDB indexes created on startup: `{ invitationToken: 1 }` unique sparse, `{ invitedEmail: 1, tenantId: 1 }`
    unique sparse, compound `{ userId: 1, tenantId: 1 }` with partial filter `{ userId: { $ne: null } }`

### T-100: Update TenantRepository for subscription field

- **Goal:** Add `subscription` field to the [`TenantDocument`](server/src/repositories/tenant.repository.ts:7) and all
  repository methods that create or map tenant documents.
- **Files to modify:**
  - [`server/src/repositories/tenant.repository.ts`](server/src/repositories/tenant.repository.ts:1)
- **Dependencies:** T-096
- **Acceptance criteria:**
  - `TenantDocument` includes `subscription: string`
  - `create()` accepts and stores `subscription` field (defaults to `'free'`)
  - `toDomain()` maps `subscription` to the domain `Tenant` type
  - `update()` can change `subscription` field

### T-101: Create EmailService with Resend integration

- **Goal:** Create a new [`EmailService`](server/src/services/email.service.ts) that sends invitation emails via Resend
  in production and logs to console in development. Uses the `resend` npm package.
- **Files to create:**
  - `server/src/services/email.service.ts`
- **Files to modify:**
  - `server/package.json` (add `resend` dependency)
- **Dependencies:** None
- **Acceptance criteria:**
  - `EmailService` interface with `sendInvitation(to, tenantName, role, token): Promise<void>` method
  - `ResendEmailService` implementation uses `resend` npm package to send email with invitation link
  - `ConsoleEmailService` implementation logs invitation link to console (for development)
  - Invitation link format: `${FRONTEND_URL}/auth/accept-invitation?token=<token>`
  - Email subject and body include tenant name and assigned role
  - Factory function selects implementation based on `RESEND_API_KEY` env var presence
  - Unit tests cover both implementations

### T-102: Update AuthService — remove auto-tenant creation, add acceptInvitation, null tenantId JWT

- **Goal:** Refactor [`AuthService`](server/src/services/auth.service.ts:55) so registration creates only the user (no
  tenant), login issues `tenantId: null` when user has no active memberships, and add a new `acceptInvitation` method
  per [spec §14.7](technical_specification.md:2097).
- **Files to modify:**
  - [`server/src/services/auth.service.ts`](server/src/services/auth.service.ts:1)
  - [`server/src/services/auth.service.test.ts`](server/src/services/auth.service.test.ts:1)
- **Dependencies:** T-099, T-101
- **Acceptance criteria:**
  - `register()` no longer creates a tenant or TenantMember; JWT issued with `tenantId: null`, `tenantRole: null`
  - `login()` checks active memberships via `TenantMemberRepository.findActiveByUser()`; if none exist, JWT is issued
    with `tenantId: null`
  - `JwtPayload` interface updated: `tenantId: string | null`, `tenantRole: string | null`
  - `acceptInvitation(token, userId)` method:
    - Looks up TenantMember by `invitationToken`
    - Validates `status === 'pending'`
    - Validates authenticated user's email matches `invitedEmail`
    - Updates TenantMember: sets `userId`, `status: 'active'`, clears `invitationToken`
    - Returns updated TenantMember
  - `generateToken()` accepts nullable `tenantId` and `tenantRole`
  - All existing and new tests pass

### T-103: Update TenantService — subscription limit checks and invitation flow with email

- **Goal:** Add subscription limit enforcement to
  [`TenantService.createTenant()`](server/src/services/tenant.service.ts:19) and update
  [`inviteMember()`](server/src/services/tenant.service.ts:127) to support unregistered users per
  [spec §14](technical_specification.md:1866).
- **Files to modify:**
  - [`server/src/services/tenant.service.ts`](server/src/services/tenant.service.ts:1)
  - [`server/src/services/tenant.service.test.ts`](server/src/services/tenant.service.test.ts:1)
- **Dependencies:** T-099, T-100, T-101, T-102
- **Acceptance criteria:**
  - `createTenant()`:
    - Accepts `subscription` field in input (defaults to `'free'`)
    - For `subscription: 'free'`: checks if user already owns a free workspace; rejects with 403
      `SUBSCRIPTION_LIMIT_EXCEEDED` if so
    - For `subscription: 'premium'`: no workspace count limit
    - Creates Tenant with `subscription` field, creates TenantMember as owner with `status: 'active'`
  - `inviteMember()`:
    - If user found by email: creates TenantMember with `status: 'active'` (existing behavior, with new fields)
    - If user NOT found: generates `invitationToken` (crypto.randomUUID), creates TenantMember with `userId: null`,
      `status: 'pending'`, `invitedEmail`, `invitationToken`, `invitedAt`
    - Delegates email sending to `EmailService.sendInvitation()`
    - Prevents duplicate pending invitations for same `(email, tenantId)` → 409
    - Prevents inviting email that is already an active member → 409
  - New method `getInvitationByToken(token): Promise<InvitationDetails>` (public, no auth)
  - `deleteTenant()` updated to also delete pending members
  - All existing and new tests pass

### T-104: Update ProjectService — subscription limit checks

- **Goal:** Add subscription limit enforcement to [`ProjectService`](server/src/services/project.service.ts:8) per
  [spec §14.2](technical_specification.md:1879).
- **Files to modify:**
  - [`server/src/services/project.service.ts`](server/src/services/project.service.ts:1)
  - [`server/src/services/project.service.test.ts`](server/src/services/project.service.test.ts:1)
- **Dependencies:** T-100
- **Acceptance criteria:**
  - `createProject()` checks tenant's `subscription` field:
    - Free: max 3 projects per workspace; rejects with 403 `SUBSCRIPTION_LIMIT_EXCEEDED` if exceeded
    - Premium: no limit
  - `addMember()` checks tenant's `subscription` field:
    - Free: max 10 members per project; rejects with 403 `SUBSCRIPTION_LIMIT_EXCEEDED` if exceeded
    - Premium: no limit
  - `ProjectService` constructor updated to accept `TenantRepository` for reading subscription field
  - All existing and new tests pass

### T-105: Update TenantContextMiddleware and RBAC for status check and pending member exclusion

- **Goal:** Update [`tenantContextMiddleware`](server/src/middleware/tenant-context.ts:30) to check `status: 'active'`
  and update [`RBACMiddleware`](server/src/middleware/rbac.ts:27) to explicitly exclude pending/declined members per
  [spec §3.4](technical_specification.md:301).
- **Files to modify:**
  - [`server/src/middleware/tenant-context.ts`](server/src/middleware/tenant-context.ts:1)
  - [`server/src/middleware/rbac.ts`](server/src/middleware/rbac.ts:1)
  - [`server/src/middleware/tenant-context.test.ts`](server/src/middleware/tenant-context.test.ts) (create if missing)
  - [`server/src/middleware/rbac.test.ts`](server/src/middleware/rbac.test.ts:1)
- **Dependencies:** T-099
- **Acceptance criteria:**
  - Tenant context middleware query now includes `status: 'active'` in the filter
    (`{ userId, tenantId, status: 'active' }`)
  - Pending/declined members are rejected with 403
  - RBAC middleware checks `userRole` is not null/undefined (defense-in-depth)
  - Unit tests verify: active member passes, pending member rejected, declined member rejected

### T-106: Add invitation routes to server auth routes

- **Goal:** Add [`POST /auth/accept-invitation`](server/src/routes/auth.ts) (authenticated) and
  [`GET /invitations/:token`](server/src/routes/auth.ts) (public, no auth) endpoints per
  [spec §4.2](technical_specification.md:332).
- **Files to modify:**
  - [`server/src/routes/auth.ts`](server/src/routes/auth.ts:1)
  - [`server/src/index.ts`](server/src/index.ts:1) (register public invitation route)
  - [`server/src/routes/auth.test.ts`](server/src/routes/auth.test.ts:1)
- **Dependencies:** T-097, T-102, T-103
- **Acceptance criteria:**
  - `POST /auth/accept-invitation`:
    - Requires authentication (authMiddleware)
    - Body validated with `AcceptInvitationSchema`
    - Calls `AuthService.acceptInvitation(token, userId)`
    - Returns 200 with updated TenantMember
  - `GET /invitations/:token`:
    - Public endpoint — no auth middleware applied
    - Returns invitation details (tenantName, invitedEmail, role, status)
    - Returns 404 if token not found or invitation is not pending
  - Public route registered before auth middleware in [`server/src/index.ts`](server/src/index.ts:1)
  - Tests cover both endpoints

### T-107: Update tenant routes — invite body uses email instead of userId

- **Goal:** Update the [`POST /:tenantId/members`](server/src/routes/tenants.ts:112) route to validate the body against
  `InviteMemberSchema` (`{ email, role }`) instead of `{ userId, role }`, and pass `email` to the service layer.
- **Files to modify:**
  - [`server/src/routes/tenants.ts`](server/src/routes/tenants.ts:1)
  - [`server/src/routes/tenants.test.ts`](server/src/routes/tenants.test.ts:1)
- **Dependencies:** T-098, T-103
- **Acceptance criteria:**
  - Route body validated with `InviteMemberSchema` (`{ email: z.email(), role: z.enum(TenantRole) }`)
  - `TenantService.inviteMember()` called with `email` instead of `userId`
  - Response includes full TenantMember (with `status`, `invitedEmail`, etc.)
  - Tests cover both registered-user and unregistered-user invite flows

### T-108: Update AuthStore to handle tenantId: null from JWT

- **Goal:** Update [`AuthStore`](ui/src/app/stores/auth-store.ts:15) to extract and expose `tenantId` from the JWT
  payload, handling the `null` case for users with no workspaces.
- **Files to modify:**
  - [`ui/src/app/stores/auth-store.ts`](ui/src/app/stores/auth-store.ts:1)
  - [`ui/src/app/stores/auth-store.spec.ts`](ui/src/app/stores/auth-store.spec.ts:1)
- **Dependencies:** T-102
- **Acceptance criteria:**
  - `decodeTenantRole()` also extracts `tenantId` from JWT payload
  - New `tenantId` signal: `signal<string | null>(null)`
  - `tenantId` is `null` when JWT has `tenantId: null` (new user with no workspaces)
  - `setSession()` updates `tenantId` signal
  - `logout()` clears `tenantId` signal
  - Tests verify: JWT with null tenantId → `tenantId()` is null; JWT with tenantId → `tenantId()` is set

### T-109: Update TenantClient with invitation and subscription methods

- **Goal:** Extend [`TenantClient`](ui/src/app/services/tenant-client.ts:13) with methods for accepting invitations,
  getting invitation details, and upgrading subscription.
- **Files to modify:**
  - [`ui/src/app/services/tenant-client.ts`](ui/src/app/services/tenant-client.ts:1)
  - `ui/src/app/services/tenant-client.spec.ts`
- **Dependencies:** T-098
- **Acceptance criteria:**
  - `acceptInvitation(token: string): Observable<TenantMember>` — calls `POST /auth/accept-invitation`
  - `getInvitation(token: string): Observable<InvitationDetails>` — calls `GET /invitations/:token`
  - `upgradeSubscription(tenantId: string): Observable<Tenant>` — calls `PATCH /tenants/:tenantId` with
    `{ subscription: 'premium' }`
  - All methods correctly typed using shared package types
  - Tests cover each new method (correct URL, HTTP method, request/response handling)

### T-110: Update RegisterComponent — redirect to workspace creation when tenantId is null

- **Goal:** Update [`Register`](ui/src/app/features/auth/register/register.ts:31) so that after successful registration,
  if the user has no tenants (`tenantId` is null), they are redirected to workspace creation instead of `/`.
- **Files to modify:**
  - [`ui/src/app/features/auth/register/register.ts`](ui/src/app/features/auth/register/register.ts:1)
  - [`ui/src/app/features/auth/register/register.spec.ts`](ui/src/app/features/auth/register/register.spec.ts:1)
- **Dependencies:** T-108
- **Acceptance criteria:**
  - After successful registration, checks `authStore.tenantId()`
  - If `null`: navigates to `/create-workspace`
  - If set: navigates to `/` (existing behavior)
  - Invitation token from query params is preserved for post-registration acceptance
  - Tests verify both redirect paths

### T-111: Create AcceptInvitationComponent

- **Goal:** Create the public invitation acceptance page at `/auth/accept-invitation?token=...` per
  [spec §14.3.3](technical_specification.md:1922).
- **Files to create:**
  - `ui/src/app/features/auth/accept-invitation/accept-invitation.ts`
  - `ui/src/app/features/auth/accept-invitation/accept-invitation.html`
  - `ui/src/app/features/auth/accept-invitation/accept-invitation.spec.ts`
- **Dependencies:** T-108, T-109
- **Acceptance criteria:**
  - Route: `/auth/accept-invitation` — no auth guard (public page)
  - Reads `token` from query params
  - Calls `TenantClient.getInvitation(token)` to fetch and display invitation details
  - If user is not authenticated: shows invitation details + "Register" and "Login" links (with token preserved)
  - If user is authenticated and email matches: calls `TenantClient.acceptInvitation(token)`, then calls
    `POST /auth/switch-tenant` to get JWT with new tenant context, redirects to tenant
  - If user is authenticated but email doesn't match: shows error message
  - Loading and error states handled
  - Spartan UI: `HlmCardImports`, `HlmButtonImports`, `HlmSpinnerImports`, `HlmBadgeImports`
  - Angular 22 patterns: signals, `@if`, `inject()`

### T-112: Create WorkspaceCreateComponent

- **Goal:** Create a workspace creation page shown when a user has no workspaces (`tenantId: null`) per
  [spec §13.4](technical_specification.md:1844).
- **Files to create:**
  - `ui/src/app/features/tenants/create-workspace/create-workspace.ts`
  - `ui/src/app/features/tenants/create-workspace/create-workspace.html`
  - `ui/src/app/features/tenants/create-workspace/create-workspace.spec.ts`
- **Dependencies:** T-108, T-109
- **Acceptance criteria:**
  - Route: `/create-workspace` — guarded by `authGuard` but not `tenantGuard`
  - Form with: workspace name, slug (auto-generated from name), subscription tier selector (free/premium)
  - Default subscription: `'free'`
  - Submit calls `POST /tenants` via `TenantClient` then `POST /auth/switch-tenant` to get JWT with tenant context
  - After creation: redirects to `/tenants/:tenantId/projects` (the new tenant)
  - "Upgrade to Premium" link navigates to `/tenants/:tenantId/upgrade` after creation (for free users)
  - Error states: slug conflict (409), validation errors (422)
  - Spartan UI: `HlmCardImports`, `HlmFieldImports`, `HlmInputImports`, `HlmButtonImports`, `HlmSpinnerImports`,
    `HlmNativeSelectImports`
  - Angular 22 patterns: signal forms, signals, `@if`, `inject()`

### T-113: Update TenantSwitcher to handle null tenant state

- **Goal:** Update [`TenantSwitcher`](ui/src/app/shell/tenant-switcher/tenant-switcher.ts:15) to gracefully handle the
  case where the user has zero tenants (new user with no workspaces).
- **Files to modify:**
  - [`ui/src/app/shell/tenant-switcher/tenant-switcher.ts`](ui/src/app/shell/tenant-switcher/tenant-switcher.ts:1)
  - [`ui/src/app/shell/tenant-switcher/tenant-switcher.html`](ui/src/app/shell/tenant-switcher/tenant-switcher.html:1)
  - `ui/src/app/shell/tenant-switcher/tenant-switcher.spec.ts` (create if missing)
- **Dependencies:** T-108
- **Acceptance criteria:**
  - When `tenants()` is empty or `null`, show "No workspaces" with a "Create Workspace" link
  - Link navigates to `/create-workspace`
  - Existing dropdown behavior preserved when tenants exist
  - Subscription tier badge (free/premium) shown next to tenant name in dropdown
  - Tests verify empty state and populated state

### T-114: Update TenantMemberListComponent with pending status badges

- **Goal:** Update [`TenantMemberList`](ui/src/app/features/tenants/tenant-member-list/tenant-member-list.ts) to display
  member status badges (active/pending/declined) and show `invitedEmail` for pending members.
- **Files to modify:**
  - [`ui/src/app/features/tenants/tenant-member-list/tenant-member-list.ts`](ui/src/app/features/tenants/tenant-member-list/tenant-member-list.ts)
  - [`ui/src/app/features/tenants/tenant-member-list/tenant-member-list.html`](ui/src/app/features/tenants/tenant-member-list/tenant-member-list.html)
  - `ui/src/app/features/tenants/tenant-member-list/tenant-member-list.spec.ts`
- **Dependencies:** T-086, T-096
- **Acceptance criteria:**
  - Each member row shows a status badge: "Active" (green), "Pending" (yellow), "Declined" (red)
  - Pending members display `invitedEmail` instead of `userId` (since userId is null)
  - `@for` track expression handles both active members (by `userId`) and pending members (by `invitationToken` or
    `_id`)
  - Role editing and remove buttons work for pending members (to cancel invitation)
  - `HlmBadgeImports` used for status badges
  - Tests verify badge rendering for each status

### T-115: Create mock UpgradeComponent

- **Goal:** Create a mock payment page for upgrading a tenant to premium tier per
  [spec §14.5](technical_specification.md:2006).
- **Files to create:**
  - `ui/src/app/features/tenants/upgrade/upgrade.ts`
  - `ui/src/app/features/tenants/upgrade/upgrade.html`
  - `ui/src/app/features/tenants/upgrade/upgrade.spec.ts`
- **Dependencies:** T-109
- **Acceptance criteria:**
  - Route: `/tenants/:tenantId/upgrade` — guarded by `authGuard` + `tenantGuard`
  - Displays plan summary: Premium features (unlimited projects, unlimited members)
  - Shows simulated price (e.g., "$9.99/month")
  - Disclaimer: "Demo — no real payment is processed"
  - "Pay Now" button calls `TenantClient.upgradeSubscription(tenantId)`
  - After success: shows success message, redirects to tenant settings
  - "Cancel" button navigates back
  - Only visible when `tenant.subscription === 'free'`; redirects if already premium
  - Spartan UI: `HlmCardImports`, `HlmButtonImports`, `HlmSpinnerImports`
  - Angular 22 patterns: signals, `@if`, `inject()`

### T-116: Add new frontend routes for invitation, workspace creation, and upgrade

- **Goal:** Register the new routes in [`app.routes.ts`](ui/src/app/app.routes.ts:26) and update sidebar navigation to
  include an "Upgrade" link for free-tier tenants.
- **Files to modify:**
  - [`ui/src/app/app.routes.ts`](ui/src/app/app.routes.ts:26)
  - [`ui/src/app/shell/sidebar/sidebar.html`](ui/src/app/shell/sidebar/sidebar.html:1)
- **Dependencies:** T-111, T-112, T-113, T-115
- **Acceptance criteria:**
  - `/auth/accept-invitation` route lazy-loads `AcceptInvitationComponent` — no auth guard
  - `/create-workspace` route lazy-loads `WorkspaceCreateComponent` — auth guard only (no tenant guard)
  - `/tenants/:tenantId/upgrade` route lazy-loads `UpgradeComponent` — inside tenant children
  - Sidebar shows "Upgrade to Premium" link for free-tier tenants (owner/admin only)
  - All routes load without errors

### T-117: Shared package tests for new schemas, types, and constants

- **Goal:** Add comprehensive tests for all new and updated shared package artifacts.
- **Files to modify:**
  - [`shared/src/schemas/tenant.spec.ts`](shared/src/schemas/tenant.spec.ts:1)
  - [`shared/src/schemas/auth.spec.ts`](shared/src/schemas/auth.spec.ts:1)
- **Dependencies:** T-098
- **Acceptance criteria:**
  - `TenantSchema` validates documents with `subscription` field
  - `TenantMemberSchema` validates documents with all new fields (nullable userId, status, invitedEmail, etc.)
  - `InviteMemberSchema` validates `{ email, role }` and rejects invalid inputs
  - `AcceptInvitationSchema` validates `{ token }`
  - `InvitationDetailsSchema` validates response shape
  - `CreateTenantSchema` defaults `subscription` to `'free'`
  - `MemberStatus` and `SubscriptionTier` constants have correct values
  - Coverage ≥ 80% on new code

### T-118: Backend service tests for AuthService, TenantService, ProjectService, and EmailService

- **Goal:** Add and update tests for all modified backend services covering the new subscription limit logic, invitation
  flow, and registration changes.
- **Files to modify:**
  - [`server/src/services/auth.service.test.ts`](server/src/services/auth.service.test.ts:1)
  - [`server/src/services/tenant.service.test.ts`](server/src/services/tenant.service.test.ts:1)
  - [`server/src/services/project.service.test.ts`](server/src/services/project.service.test.ts:1)
- **Files to create:**
  - `server/src/services/email.service.test.ts`
- **Dependencies:** T-102, T-103, T-104, T-106
- **Acceptance criteria:**
  - AuthService: register returns JWT with `tenantId: null`; login with no tenants returns `tenantId: null`;
    `acceptInvitation` activates membership correctly
  - TenantService: free workspace limit (SE-1) enforced; unregistered invitation creates pending member with token;
    email sent; duplicate invitation returns 409; `getInvitationByToken` returns details
  - ProjectService: free project limit (SE-3) enforced; free member limit (SE-5) enforced; premium unlimited
  - EmailService: `ConsoleEmailService` logs link; `ResendEmailService` calls API
  - Coverage ≥ 80% on new code

### T-119: Backend middleware tests for TenantContext and RBAC status check

- **Goal:** Add tests verifying that pending and declined members are rejected by the middleware pipeline.
- **Files to modify:**
  - [`server/src/middleware/rbac.test.ts`](server/src/middleware/rbac.test.ts:1)
- **Files to create:**
  - `server/src/middleware/tenant-context.test.ts`
- **Dependencies:** T-105
- **Acceptance criteria:**
  - Tenant context middleware: active member → passes; pending member → 403; declined member → 403; missing X-Tenant-Id
    → 400
  - RBAC middleware: no userRole → 403; valid role → passes; owner bypasses restrictions
  - Coverage ≥ 80%

### T-120: Frontend component tests for new and updated components

- **Goal:** Add unit tests for all new and modified frontend components.
- **Files to create:**
  - `ui/src/app/features/auth/accept-invitation/accept-invitation.spec.ts`
  - `ui/src/app/features/tenants/create-workspace/create-workspace.spec.ts`
  - `ui/src/app/features/tenants/upgrade/upgrade.spec.ts`
- **Files to modify:**
  - [`ui/src/app/features/auth/register/register.spec.ts`](ui/src/app/features/auth/register/register.spec.ts:1)
  - `ui/src/app/shell/tenant-switcher/tenant-switcher.spec.ts` (create if missing)
  - `ui/src/app/features/tenants/tenant-member-list/tenant-member-list.spec.ts`
  - `ui/src/app/services/tenant-client.spec.ts`
  - [`ui/src/app/stores/auth-store.spec.ts`](ui/src/app/stores/auth-store.spec.ts:1)
- **Dependencies:** T-110, T-111, T-112, T-113, T-114, T-115, T-116
- **Acceptance criteria:**
  - AcceptInvitation: shows invitation details; handles authenticated/unauthenticated states; error on email mismatch
  - CreateWorkspace: form submits correctly; redirect after creation; slug auto-generation
  - Upgrade: mock payment flow; redirect after upgrade; premium tenant redirects away
  - Register: redirects to `/create-workspace` when `tenantId` is null
  - TenantSwitcher: shows "No workspaces" empty state; "Create Workspace" link present
  - TenantMemberList: status badges render; pending members show invitedEmail
  - TenantClient: new methods tested
  - AuthStore: `tenantId` signal tested
  - Coverage ≥ 80% on new code

### T-121: E2E tests for user workflow rework

- **Goal:** Add Playwright 1.55.0 E2E tests covering the new registration flow (no auto-tenant), workspace creation,
  invitation system, and subscription limits.
- **Files to create:**
  - `ui/e2e/workflow-rework.spec.ts`
- **Dependencies:** T-116, T-120
- **Acceptance criteria:**
  - E2E: register → redirected to create-workspace → create free workspace → tenant active
  - E2E: register → create workspace → upgrade to premium → subscription shows "Premium"
  - E2E: owner invites unregistered email → pending member shown → invitee registers → accepts invitation → member
    becomes active
  - E2E: free workspace blocked from creating 4th project (SUBSCRIPTION_LIMIT_EXCEEDED)
  - E2E: free workspace blocked from adding 11th project member
  - E2E: tenant switcher shows empty state for new user with no workspaces
  - `npx playwright test` passes for the new spec file

### T-122: Full integration verification of user workflow rework

- **Goal:** Run the complete quality gate suite across the entire monorepo and verify all user workflow rework features
  work end-to-end. Fix any issues found.
- **Files to modify:**
  - Various (fix any issues found during verification)
- **Dependencies:** T-117, T-118, T-119, T-120, T-121
- **Acceptance criteria:**
  - `npm run build` succeeds for all workspaces (shared, server, ui)
  - `npm test` passes for all workspaces (≥ 80% coverage on new code)
  - `npm run lint` passes with zero errors
  - `tsc --noEmit` passes across the entire monorepo (zero TypeScript errors)
  - Full user journey works end-to-end: register (no tenant) → create free workspace → create project → invite member
    (registered) → invite member (unregistered) → register as invitee → accept invitation → upgrade to premium → create
    more projects → verify limits enforced

---

## Phase 11: Jira-Style Dashboard

### T-123: Add 'access_revoked' to MemberStatus and create TenantWithRole schema

- **Goal:** Add `'access_revoked'` to the [`MemberStatus`](shared/src/constants/roles.ts:14) constant and create a new
  [`TenantWithRole`](shared/src/schemas/tenant.ts) schema that extends [`TenantSchema`](shared/src/schemas/tenant.ts:8)
  with the user's membership role. This enables the dashboard to detect owner vs member state from a single API call.
- **Files to modify:**
  - [`shared/src/constants/roles.ts`](shared/src/constants/roles.ts:14) — add `'access_revoked'` to `MemberStatus`
  - [`shared/src/schemas/tenant.ts`](shared/src/schemas/tenant.ts:1) — add `TenantWithRoleSchema`
  - [`shared/src/types/tenant.ts`](shared/src/types/tenant.ts:1) — add `TenantWithRole` type
  - [`shared/src/index.ts`](shared/src/index.ts:1) — export `TenantWithRoleSchema` and `TenantWithRole`
- **Dependencies:** T-098
- **Acceptance criteria:**
  - `MemberStatus` is `['active', 'pending', 'declined', 'access_revoked']`
  - `TenantWithRoleSchema` validates a `Tenant` + `role: z.enum(TenantRole)` field
  - `TenantWithRole` type is exported from `@task-board/shared`
  - Existing `TenantMemberSchema` still validates with the new status value
  - `tsc --noEmit` passes in the shared package

### T-124: Create invitation and cross-tenant task schemas

- **Goal:** Add Zod v4 schemas and TypeScript types for cross-tenant dashboard data: pending invitations for the
  authenticated user, pending invitations sent by a tenant, and tasks assigned to the user across all tenants. These
  schemas power the dashboard's State 2 (pending invitations), State 3 (member), and State 4 (owner) views.
- **Files to modify:**
  - [`shared/src/schemas/tenant.ts`](shared/src/schemas/tenant.ts:1) — add `MyInvitationSchema`,
    `MyInvitationsResponseSchema`, `PendingInvitationSchema`, `PendingInvitationsResponseSchema`
  - [`shared/src/schemas/task.ts`](shared/src/schemas/task.ts:1) — add `MyTaskSchema` (extends `TaskSchema` with
    `tenantName`, `projectName`, `columnTitle`), `MyTasksResponseSchema`
  - [`shared/src/types/tenant.ts`](shared/src/types/tenant.ts:1) — add `MyInvitation`, `PendingInvitation` types
  - [`shared/src/types/task.ts`](shared/src/types/task.ts:1) — add `MyTask` type
  - [`shared/src/index.ts`](shared/src/index.ts:1) — export all new schemas and types
- **Dependencies:** T-123
- **Acceptance criteria:**
  - `MyInvitationSchema` validates `{ id, tenantId, tenantName, role, invitedAt }` per spec §15.10.1
  - `MyInvitationsResponseSchema` validates `{ data: MyInvitation[], total: number }`
  - `PendingInvitationSchema` validates `{ id, invitedEmail, role, invitedAt }` per spec §15.10.3
  - `PendingInvitationsResponseSchema` validates `{ data: PendingInvitation[], total: number }`
  - `MyTaskSchema` validates `Task` + `{ tenantName, projectName, columnTitle }` per spec §15.10.2
  - `MyTasksResponseSchema` validates `{ data: MyTask[], total, page, limit }`
  - All types are exported from `@task-board/shared`
  - `tsc --noEmit` passes in the shared package

### T-125: Add new API contracts for dashboard endpoints

- **Goal:** Define API contracts for the four new dashboard endpoints and update the existing `GET /tenants` contract to
  return [`TenantWithRole[]`](shared/src/schemas/tenant.ts) instead of `Tenant[]`. Contracts are the source of truth for
  frontend→backend type safety.
- **Files to modify:**
  - [`shared/src/contracts/auth.contracts.ts`](shared/src/contracts/auth.contracts.ts:1) — add `getMyInvitations`
    contract (`GET /invitations/my`), `declineInvitation` contract (`DELETE /invitations/:invitationId`)
  - [`shared/src/contracts/task.contracts.ts`](shared/src/contracts/task.contracts.ts:1) — add `getMyTasks` contract
    (`GET /tasks/my` with `page`, `limit`, `priority` query params)
  - [`shared/src/contracts/tenant.contracts.ts`](shared/src/contracts/tenant.contracts.ts:1) — add
    `getPendingInvitations` contract (`GET /tenants/:tenantId/invitations/pending`); update `list` contract response to
    use `TenantWithRoleSchema` instead of `TenantSchema`
- **Dependencies:** T-124
- **Acceptance criteria:**
  - `authContracts.getMyInvitations` defines `GET /invitations/my` returning `MyInvitationsResponseSchema`
  - `authContracts.declineInvitation` defines `DELETE /invitations/:invitationId` returning 204
  - `taskContracts.getMyTasks` defines `GET /tasks/my` with `page`, `limit`, `priority` query returning
    `MyTasksResponseSchema`
  - `tenantContracts.getPendingInvitations` defines `GET /tenants/:tenantId/invitations/pending` returning
    `PendingInvitationsResponseSchema`
  - `tenantContracts.list` response uses `z.array(TenantWithRoleSchema)` instead of `z.array(TenantSchema)`
  - `tsc --noEmit` passes in the shared package

### T-126: Add repository methods and MongoDB indexes for dashboard queries

- **Goal:** Add new repository methods needed by the dashboard feature and create MongoDB indexes for efficient
  cross-tenant queries. The [`TenantMemberRepository`](server/src/repositories/tenant-member.repository.ts:40) needs
  methods to find/update/delete members by their invitation ID (not by userId+tenantId). The
  [`TaskRepository`](server/src/repositories/task.repository.ts:58) needs a method to find tasks by assignee across
  multiple tenant IDs.
- **Files to modify:**
  - [`server/src/repositories/tenant-member.repository.ts`](server/src/repositories/tenant-member.repository.ts:40) —
    add `findById(id)`, `updateStatusById(id, status)`, `deleteById(id)`
  - [`server/src/repositories/task.repository.ts`](server/src/repositories/task.repository.ts:58) — add
    `findByAssigneeAcrossTenants(tenantIds, userId, options)` with pagination and optional priority filter
  - [`server/src/db/mongo.ts`](server/src/db/mongo.ts:1) — add index creation for
    `{ tenantId: 1, assigneeIds: 1, updatedAt: -1 }` on `tasks` collection and `{ invitedEmail: 1, status: 1 }` on
    `tenant_members` collection
- **Dependencies:** T-124
- **Acceptance criteria:**
  - `findById(id)` returns a single `TenantMemberDocument` by its `_id` (or `id` field)
  - `updateStatusById(id, status)` updates the status field of a member by ID
  - `deleteById(id)` permanently removes a member record
  - `findByAssigneeAcrossTenants(tenantIds, userId, { page, limit, priority })` returns
    `{ data: Task[]; total: number }` with tasks sorted by `updatedAt` descending
  - MongoDB indexes are created on startup for the specified collections
  - `tsc --noEmit` passes in the server package

### T-127: Extend TenantService with invitation management and tenant-with-role methods

- **Goal:** Add service methods to [`TenantService`](server/src/services/tenant.service.ts:13) for: listing tenants with
  the user's role (augmented `GET /tenants`), cross-tenant invitation lookup, declining/revoking/resending invitations,
  and hard-deleting members. These methods power the dashboard's state detection and the owner's invitation management
  panel.
- **Files to modify:**
  - [`server/src/services/tenant.service.ts`](server/src/services/tenant.service.ts:13) — add methods:
    - `listTenantsWithRole(userId)` → `TenantWithRole[]` (joins tenant_members to get role per tenant)
    - `getMyInvitations(userEmail)` → `MyInvitation[]` (cross-tenant: queries `tenant_members` by email, joins tenant
      names)
    - `getPendingInvitationsByTenant(userId, tenantId)` → `PendingInvitation[]` (RBAC: owner/admin only)
    - `declineInvitation(userId, invitationId)` → void (sets status to `'declined'`, validates email match)
    - `revokeAccess(requesterId, tenantId, memberId)` → void (RBAC: owner/admin; sets status to `'access_revoked'`)
    - `resendInvitation(requesterId, tenantId, memberId)` → void (RBAC: owner/admin; resets status to `'pending'`,
      re-sends email)
    - `hardDeleteMember(requesterId, tenantId, memberId)` → void (RBAC: owner/admin; permanent delete)
- **Files to modify:**
  - [`server/src/routes/tenants.ts`](server/src/routes/tenants.ts:1) — update `GET /` handler to call
    `listTenantsWithRole()` instead of `listTenantsForUser()`
- **Dependencies:** T-123, T-126
- **Acceptance criteria:**
  - `listTenantsWithRole` returns each tenant with the user's `role` field from `tenant_members`
  - `getMyInvitations` returns pending invitations where `invitedEmail` matches, with `tenantName` denormalized
  - `getPendingInvitationsByTenant` throws `ForbiddenError` if requester is not owner/admin
  - `declineInvitation` validates that the authenticated user's email matches `invitedEmail` and status is `'pending'`
  - `revokeAccess` sets status to `'access_revoked'`; only owner/admin can call
  - `resendInvitation` resets status to `'pending'` and re-triggers invitation email
  - `hardDeleteMember` permanently removes the member record; only owner/admin can call
  - All methods enforce RBAC where specified
  - `tsc --noEmit` passes in the server package

### T-128: Add getMyTasks() to TaskService with cross-tenant aggregation

- **Goal:** Add a [`getMyTasks()`](server/src/services/task.service.ts) method to
  [`TaskService`](server/src/services/task.service.ts:8) that returns tasks assigned to the authenticated user across
  all their active tenants. This is an application-level aggregation (not a DB-level join) because tenants could
  theoretically reside in different databases (spec §15.10.2, BQ-DASH-3).
- **Files to modify:**
  - [`server/src/services/task.service.ts`](server/src/services/task.service.ts:8) — add `getMyTasks(userId, query)`
    method. Implementation:
    1. Get user's active tenant memberships via `TenantMemberRepository.findByUser(userId)`
    2. Filter to `status === 'active'` and extract `tenantId` list
    3. Call `TaskRepository.findByAssigneeAcrossTenants(tenantIds, userId, { page, limit, priority })`
    4. For each task, resolve `tenantName` (from `TenantRepository`), `projectName` (from `ProjectRepository`),
       `columnTitle` (from `ColumnRepository`)
    5. Return `{ data: MyTask[], total, page, limit }`
  - [`server/src/services/task.service.ts`](server/src/services/task.service.ts:8) — update constructor to accept
    `TenantMemberRepository`, `TenantRepository`, `ProjectRepository`, and `ColumnRepository` dependencies (or inject
    them)
- **Dependencies:** T-126
- **Acceptance criteria:**
  - `getMyTasks` returns tasks where `assigneeIds` includes `userId` across all active tenants
  - Each task in the response includes denormalized `tenantName`, `projectName`, and `columnTitle`
  - Results are sorted by `updatedAt` descending
  - Pagination (`page`, `limit`) works correctly
  - `priority` filter narrows results to the specified priority
  - Returns empty result (not error) when user has no active memberships
  - `tsc --noEmit` passes in the server package

### T-129: Create cross-tenant invitation routes

- **Goal:** Create a new route file [`server/src/routes/invitations.ts`](server/src/routes/invitations.ts) for
  cross-tenant invitation endpoints and register them in the app before the tenant-context middleware. These routes
  require authentication but NOT the `X-Tenant-Id` header (spec §15.10.1, §15.10.4).
- **Files to create:**
  - `server/src/routes/invitations.ts` — Hono router with:
    - `GET /my` — calls `TenantService.getMyInvitations(userEmail)`, returns `MyInvitationsResponseSchema` shape
    - `DELETE /:invitationId` — calls `TenantService.declineInvitation(userId, invitationId)`, returns 204
- **Files to modify:**
  - [`server/src/routes/index.ts`](server/src/routes/index.ts:1) — add `invitations` to `routeRegistry`
  - [`server/src/index.ts`](server/src/index.ts:1) — mount invitation routes at `/api/v1/invitations` AFTER
    `authMiddleware` but BEFORE `tenantContextMiddleware` (cross-tenant, no `X-Tenant-Id` required)
- **Dependencies:** T-127
- **Acceptance criteria:**
  - `GET /api/v1/invitations/my` returns pending invitations for the authenticated user's email
  - `DELETE /api/v1/invitations/:invitationId` sets invitation status to `'declined'` and returns 204
  - Both endpoints require a valid JWT (auth middleware) but do NOT require `X-Tenant-Id`
  - `DELETE` returns 403 if the authenticated user's email does not match `invitedEmail`
  - `DELETE` returns 404 if the invitation does not exist or is not `'pending'`

### T-130: Add cross-tenant GET /tasks/my route

- **Goal:** Register the `GET /tasks/my` cross-tenant endpoint. This route must be accessible without the `X-Tenant-Id`
  header, so it must be registered before the tenant-context middleware — similar to the invitation routes in T-129.
  Since `/tasks/my` is a specific sub-path, it can be registered before the tenant-scoped task routes without conflict.
- **Files to modify:**
  - [`server/src/routes/tasks.ts`](server/src/routes/tasks.ts:1) — add `GET /my` handler that calls
    `TaskService.getMyTasks(userId, { page, limit, priority })`
  - [`server/src/index.ts`](server/src/index.ts:1) — register the cross-tenant `GET /tasks/my` route before
    `tenantContextMiddleware` (the tenant-scoped task routes remain after it)
- **Dependencies:** T-128
- **Acceptance criteria:**
  - `GET /api/v1/tasks/my` returns tasks assigned to the user across all active tenants
  - Response shape matches `MyTasksResponseSchema`: `{ data, total, page, limit }`
  - Query params `page`, `limit`, `priority` work correctly
  - Does NOT require `X-Tenant-Id` header
  - Returns 401 if not authenticated
  - The existing tenant-scoped `GET /api/v1/tasks` still works correctly with `X-Tenant-Id`

### T-131: Add tenant-scoped pending invitations and member management routes

- **Goal:** Add tenant-scoped endpoints for the owner/admin to view pending invitations they sent and manage members
  (resend, revoke, hard-delete). These endpoints are inside the tenant-scoped pipeline and require `X-Tenant-Id` plus
  owner/admin RBAC (spec §15.10.3).
- **Files to modify:**
  - [`server/src/routes/tenants.ts`](server/src/routes/tenants.ts:1) — add routes:
    - `GET /:tenantId/invitations/pending` — calls `TenantService.getPendingInvitationsByTenant(userId, tenantId)`,
      returns `PendingInvitationsResponseSchema` shape
    - `PATCH /:tenantId/members/:memberId/resend` — calls
      `TenantService.resendInvitation(requesterId, tenantId, memberId)`, returns 200 with updated member
    - `PATCH /:tenantId/members/:memberId/revoke` — calls `TenantService.revokeAccess(requesterId, tenantId, memberId)`,
      returns 200 with updated member
    - `DELETE /:tenantId/members/:memberId` — update existing handler to support hard-delete for
      `access_revoked`/`declined` members (calls `TenantService.hardDeleteMember`)
- **Dependencies:** T-127
- **Acceptance criteria:**
  - `GET /tenants/:tenantId/invitations/pending` returns pending invitations for the tenant; owner/admin only
  - `PATCH /tenants/:tenantId/members/:memberId/resend` resets invitation to `'pending'` and re-sends email
  - `PATCH /tenants/:tenantId/members/:memberId/revoke` sets status to `'access_revoked'`
  - `DELETE /tenants/:tenantId/members/:memberId` permanently deletes a `declined`/`access_revoked` member
  - All endpoints return 403 if the requester is not owner/admin
  - All endpoints require `X-Tenant-Id` header

### T-132: Verify and update tenant-context middleware for 'access_revoked' status

- **Goal:** Verify that the [`TenantContextMiddleware`](server/src/middleware/tenant-context.ts) rejects members with
  `'access_revoked'` status with a 403 response. If this was already implemented in Phase 10, add explicit test
  coverage.
- **Files to modify:**
  - [`server/src/middleware/tenant-context.ts`](server/src/middleware/tenant-context.ts:1) — verify `'access_revoked'`
    is in the rejected status list
  - `server/src/middleware/tenant-context.test.ts` — add test case for `'access_revoked'` → 403
- **Dependencies:** T-123
- **Acceptance criteria:**
  - A request with a valid JWT but `access_revoked` membership receives 403 Forbidden
  - Test case explicitly covers `'access_revoked'` status rejection
  - `npm test` passes for tenant-context middleware tests

### T-133: Extend TenantClient with dashboard methods

- **Goal:** Add frontend service methods to [`TenantClient`](ui/src/app/services/tenant-client.ts:23) for the new
  dashboard API endpoints. Also update [`loadTenants()`](ui/src/app/services/tenant-client.ts:30) to handle the
  augmented `TenantWithRole[]` response from the updated `GET /tenants` contract.
- **Files to modify:**
  - [`ui/src/app/services/tenant-client.ts`](ui/src/app/services/tenant-client.ts:23) — add methods:
    - `getMyInvitations()` → `Observable<{ data: MyInvitation[]; total: number }>` — calls `GET /invitations/my`
    - `getPendingInvitations(tenantId)` → `Observable<{ data: PendingInvitation[]; total: number }>` — calls
      `GET /tenants/:tenantId/invitations/pending`
    - `declineInvitation(invitationId)` → `Observable<void>` — calls `DELETE /invitations/:invitationId`
    - `revokeAccess(tenantId, memberId)` → `Observable<void>` — calls
      `PATCH /tenants/:tenantId/members/:memberId/revoke`
    - `resendInvitation(tenantId, memberId)` → `Observable<void>` — calls
      `PATCH /tenants/:tenantId/members/:memberId/resend`
    - `hardDeleteMember(tenantId, memberId)` → `Observable<void>` — calls `DELETE /tenants/:tenantId/members/:memberId`
  - Update `loadTenants()` to use `TenantWithRole[]` type (the `tenants` signal type changes from `Tenant[]` to
    `TenantWithRole[]`)
- **Dependencies:** T-125, T-129, T-131
- **Acceptance criteria:**
  - All new methods call the correct API endpoints with correct HTTP methods
  - `loadTenants()` correctly handles the `role` field in the response
  - `tenants` signal type is `TenantWithRole[]` (includes `role` per tenant)
  - Cross-tenant methods (`getMyInvitations`, `declineInvitation`) do NOT send `X-Tenant-Id` header
  - `tsc --noEmit` passes in the ui package

### T-134: Add getMyTasks() to TaskClient

- **Goal:** Add a cross-tenant [`getMyTasks()`](ui/src/app/services/task-client.ts) method to
  [`TaskClient`](ui/src/app/services/task-client.ts:27) that fetches tasks assigned to the current user across all
  tenants. This endpoint does NOT require the `X-Tenant-Id` header.
- **Files to modify:**
  - [`ui/src/app/services/task-client.ts`](ui/src/app/services/task-client.ts:27) — add method:
    - `getMyTasks(page?, limit?, priority?)` → `Observable<MyTasksResponse>` — calls `GET /tasks/my` with query params
- **Dependencies:** T-125, T-130
- **Acceptance criteria:**
  - `getMyTasks()` calls `GET /api/v1/tasks/my` with `page`, `limit`, `priority` query params
  - Does NOT send `X-Tenant-Id` header (uses the API_BASE_URL directly, not through tenant interceptor)
  - Returns `MyTasksResponse` shape with denormalized `tenantName`, `projectName`, `columnTitle`
  - `tsc --noEmit` passes in the ui package

### T-135: Remove authGuard from root route

- **Goal:** Remove [`authGuard`](ui/src/app/guards/auth.guard.ts:24) from the root route (`/`) in
  [`app.routes.ts`](ui/src/app/app.routes.ts:6) so that unauthenticated visitors can see the landing page. The
  [`Dashboard`](ui/src/app/features/dashboard/dashboard.ts:17) component internally handles all states including the
  visitor state (spec §15.7.1). All other authenticated routes retain their guards.
- **Files to modify:**
  - [`ui/src/app/app.routes.ts`](ui/src/app/app.routes.ts:23) — remove `canActivate: [authGuard]` from the root
    `path: ''` route
- **Dependencies:** None (can be done independently)
- **Acceptance criteria:**
  - Root route (`/`) renders the `Dashboard` component without requiring authentication
  - Unauthenticated visitors can access `/` without being redirected to `/auth/login`
  - All other authenticated routes (`/workspace/create`, `/tenants/:tenantId/*`) still use `authGuard`
  - `tsc --noEmit` passes in the ui package

### T-136: Rework Dashboard component as stateful orchestrator

- **Goal:** Rewrite the [`Dashboard`](ui/src/app/features/dashboard/dashboard.ts:17) component from a simple project
  list into a stateful orchestrator that detects the user's state (visitor/new-user/pending-invitations/member/owner)
  and delegates to child sub-view components. The state detection algorithm follows spec §15.4 and architecture §12.2.
- **Files to modify:**
  - [`ui/src/app/features/dashboard/dashboard.ts`](ui/src/app/features/dashboard/dashboard.ts:1) — full rewrite:
    - Remove `ProjectClient` dependency and project-loading logic
    - Add signals: `dashboardState`, `tenants`, `myTasks`, `pendingInvitations`, `sentInvitations`, `taskStats`
    - Implement state detection in `ngOnInit()`: check `authStore.isAuthenticated()` → if true, load tenants +
      invitations in parallel via `Promise.all()` → determine state from data
    - Add `computed()` signals: `isOwner`, `isMember`, `hasInvitations`
    - Add `effect()` to trigger secondary data loading (tasks, sent invitations) after state is determined
    - Error handling: if `GET /invitations/my` fails, treat as zero invitations (non-blocking); if `GET /tenants` fails,
      show error state with retry
  - [`ui/src/app/features/dashboard/dashboard.html`](ui/src/app/features/dashboard/dashboard.html:1) — full rewrite:
    - `@switch (dashboardState())` with cases for `'loading'`, `'visitor'`, `'new-user'`, `'pending-invitations'`,
      `'member'`, `'owner'`
    - Each case renders the corresponding child component with `@defer` for lazy loading
    - Loading case shows `hlm-spinner`
- **Dependencies:** T-133, T-134, T-135
- **Acceptance criteria:**
  - Visitor (unauthenticated): renders `LandingPageComponent` with no API calls
  - New user (authenticated, zero tenants, zero invitations): renders `WelcomeViewComponent`
  - Pending invitations: renders `InvitationViewComponent` with invitation cards
  - Member: renders `MemberDashboardComponent` with workspaces and tasks
  - Owner: renders `OwnerDashboardComponent` with workspaces, tasks, and sent invitations
  - Loading state shows a centered spinner
  - `GET /invitations/my` failure degrades gracefully (treats as zero invitations)
  - `GET /tenants` failure shows error state with retry button
  - Angular 22 patterns: signals, `computed()`, `effect()`, `@switch`, `@defer`, `inject()`

### T-137: Create LandingPageComponent (State 0: Visitor)

- **Goal:** Create a static marketing-style landing page for unauthenticated visitors. This is the first thing users see
  when they visit `/`. It contains no backend calls and no loading state (spec §15.5).
- **Files to create:**
  - `ui/src/app/features/dashboard/visitor/landing-page.ts` — standalone component with:
    - Hero section: headline "Task Board — Simple, powerful project management", subheadline, CTA buttons
    - Features section: 3–4 feature cards (Kanban boards, Sprint management, Team collaboration, Multi-workspace)
    - Free plan callout: 1 workspace, 3 projects, 10 users per project
    - Footer CTA: "Ready to get started? Create your free account"
    - Spartan UI: `HlmButtonImports`, `HlmCardImports`
    - Tailwind CSS for styling; no `HlmSpinnerImports` needed
- **Dependencies:** T-135
- **Acceptance criteria:**
  - Renders for unauthenticated visitors at `/`
  - "Get Started" button links to `/auth/register`
  - "Log In" button links to `/auth/login`
  - Feature cards display Kanban, Sprint, Collaboration, Multi-workspace descriptions
  - Free plan limits are displayed (1 workspace, 3 projects, 10 users)
  - Footer CTA links to `/auth/register`
  - No HTTP requests are made
  - Component is standalone with Angular 22 `@if` / `@for` control flow

### T-138: Create WelcomeViewComponent (State 1: New User)

- **Goal:** Create the welcome view for authenticated users who have zero tenants and zero pending invitations. This
  component guides new users to create their first workspace (spec §15.6).
- **Files to create:**
  - `ui/src/app/features/dashboard/new-user/welcome-view.ts` — standalone component with:
    - Welcome header: "Welcome to Task Board, {displayName}!"
    - CTA card with "Create your first workspace" button → navigates to `/workspace/create`
    - Free plan info card: limits (1 workspace, 3 projects, 10 users), link to Premium info
    - Input: `user` signal (from parent dashboard)
    - Spartan UI: `HlmButtonImports`, `HlmCardImports`, `HlmSpinnerImports`
    - Angular 22 patterns: `input()`, `@if`, `RouterLink`
- **Dependencies:** T-136
- **Acceptance criteria:**
  - Shows for authenticated users with zero tenants and zero invitations
  - Displays user's display name in the welcome header
  - "Create your first workspace" button navigates to `/workspace/create`
  - Free plan limits are displayed
  - Component is standalone with Tailwind CSS styling

### T-139: Create InvitationViewComponent (State 2: Pending Invitations)

- **Goal:** Create the pending invitations view for authenticated users who have no tenants but have pending
  invitations. Shows invitation cards with accept/decline actions and a secondary CTA to create a workspace (spec
  §15.7).
- **Files to create:**
  - `ui/src/app/features/dashboard/pending-invitations/invitation-view.ts` — standalone component with:
    - Header: "You have pending invitations"
    - Invitation cards (one per invitation): workspace name, invited role (badge), inviter info
    - "Accept" button → calls existing `TenantClient.acceptInvitation()` with the invitation token, then signals parent
      to reload state
    - "Decline" button → calls `TenantClient.declineInvitation(invitationId)`, removes card from list; if no invitations
      remain, signals parent to transition to State 1
    - Secondary CTA: "Or create your own workspace" → `/workspace/create`
    - Inputs: `invitations` signal (from parent dashboard)
    - Outputs: `accepted` event (signals parent to reload tenants), `allDeclined` event (signals parent to transition to
      new-user state)
    - Spartan UI: `HlmButtonImports`, `HlmCardImports`, `HlmBadgeImports`, `HlmSpinnerImports`
    - Angular 22 patterns: `input()`, `output()`, `@for`, `@if`, `signal()`
- **Dependencies:** T-133, T-136
- **Acceptance criteria:**
  - Renders invitation cards with workspace name, role badge, and inviter email
  - "Accept" button calls `POST /auth/accept-invitation` and signals parent to reload
  - "Decline" button calls `DELETE /invitations/:id` and removes the card
  - When all invitations are declined, component signals parent to transition to State 1
  - "Or create your own workspace" link navigates to `/workspace/create`
  - Error on accept/decline shows a toast; card remains visible

### T-140: Create MemberDashboardComponent (State 3: Member)

- **Goal:** Create the member dashboard for authenticated users who belong to one or more workspaces as a `member` or
  `admin` (not owner). Shows "My Workspaces", "My Recent Tasks", and "Quick Stats" sections (spec §15.8).
- **Files to create:**
  - `ui/src/app/features/dashboard/member/member-dashboard.ts` — standalone component with:
    - "My Workspaces" section: workspace cards with name, role badge (computed from tenant data), click →
      `Router.navigate` to `/tenants/:tenantId/projects`
    - "My Recent Tasks" section: up to 10 tasks from `myTasks` input, showing title, priority badge, project name,
      column name; click → navigate to `/tenants/:tenantId/projects/:projectId/tasks/:taskId`
    - "Quick Stats" section: total assigned tasks, breakdown by priority (low/medium/high/critical)
    - Inputs: `tenants` (TenantWithRole[]), `tasks` (MyTask[]), `stats` (task stats object)
    - Spartan UI: `HlmButtonImports`, `HlmCardImports`, `HlmBadgeImports`, `HlmSpinnerImports`
    - Angular 22 patterns: `input()`, `@for`, `@if`, `computed()`, `RouterLink`
- **Dependencies:** T-136
- **Acceptance criteria:**
  - "My Workspaces" cards show workspace name and user's role as a badge
  - Clicking a workspace card navigates to `/tenants/:tenantId/projects`
  - "My Recent Tasks" shows up to 10 tasks with title, priority badge, project name, column name
  - Clicking a task navigates to the task detail page (`/tenants/:tenantId/projects/:projectId/tasks/:taskId`)
  - "Quick Stats" shows total count and priority breakdown
  - Component handles empty states (no workspaces, no tasks) gracefully

### T-141: Create OwnerDashboardComponent (State 4: Owner)

- **Goal:** Create the owner dashboard for authenticated users who own one or more workspaces. Includes everything from
  the member dashboard, plus "Pending Invitations Sent" section, workspace management links, and a "Create another
  workspace" button (spec §15.9).
- **Files to create:**
  - `ui/src/app/features/dashboard/owner/owner-dashboard.ts` — standalone component with:
    - All content from MemberDashboardComponent (My Workspaces, My Recent Tasks, Quick Stats) — either inline or by
      composing `<ui-member-dashboard>` internally
    - "Pending Invitations Sent" section (for owned tenants): invitation cards with invitee email, role, invited date;
      "Resend" button → `TenantClient.resendInvitation()`; "Cancel" button → `TenantClient.declineInvitation()`
    - Workspace management links per owned workspace: Settings → `/tenants/:tenantId/settings`, Members →
      `/tenants/:tenantId/settings/members`, Upgrade (if free) → `/tenants/:tenantId/upgrade`
    - "Create another workspace" button → `/workspace/create` (visible only if under subscription limit: 1 free
      workspace)
    - Inputs: `tenants` (TenantWithRole[]), `tasks` (MyTask[]), `stats`, `pendingInvitations` (PendingInvitation[])
    - Spartan UI: `HlmButtonImports`, `HlmCardImports`, `HlmBadgeImports`, `HlmSpinnerImports`
    - Angular 22 patterns: `input()`, `@for`, `@if`, `computed()`, `RouterLink`
- **Dependencies:** T-133, T-136
- **Acceptance criteria:**
  - Owner sees all member dashboard content (My Workspaces, My Recent Tasks, Quick Stats)
  - "Pending Invitations Sent" shows invitee email, role, and invited date for owned tenants
  - "Resend" button calls resend endpoint and shows success feedback
  - "Cancel" button calls decline endpoint and removes the invitation card
  - Workspace management links (Settings, Members, Upgrade) are visible for owned workspaces only
  - "Create another workspace" is visible only when user owns fewer than 1 free workspace
  - Component handles empty states gracefully (no pending invitations, no tasks)

### T-142: Update TenantMemberList with 'access_revoked' status and new actions

- **Goal:** Update the existing
  [`TenantMemberList`](ui/src/app/features/tenants/tenant-member-list/tenant-member-list.ts:49) component to support the
  new `'access_revoked'` status badge and add action buttons for resending invitations, revoking access, and
  hard-deleting members.
- **Files to modify:**
  - [`ui/src/app/features/tenants/tenant-member-list/tenant-member-list.ts`](ui/src/app/features/tenants/tenant-member-list/tenant-member-list.ts:49)
    — add:
    - `'access_revoked'` entry to `statusColorMap` (e.g., `'bg-gray-200 text-gray-500'`)
    - `resendInvitation(member)` method → calls `TenantClient.resendInvitation()`
    - `revokeAccess(member)` method → calls `TenantClient.revokeAccess()`
    - `hardDeleteMember(member)` method → calls `TenantClient.hardDeleteMember()`
    - Computed signals for which actions are available per member status
  - [`ui/src/app/features/tenants/tenant-member-list/tenant-member-list.html`](ui/src/app/features/tenants/tenant-member-list/tenant-member-list.html:1)
    — add:
    - `access_revoked` status badge rendering
    - "Resend" button for `pending` and `declined` members
    - "Revoke" button for `active` members (non-owner)
    - "Hard Delete" button for `declined` and `access_revoked` members
    - Confirmation dialog for destructive actions (revoke, hard-delete)
- **Dependencies:** T-133
- **Acceptance criteria:**
  - `'access_revoked'` members display a gray status badge
  - "Resend" button is visible for `pending` and `declined` members; calls resend endpoint
  - "Revoke" button is visible for `active` (non-owner) members; calls revoke endpoint
  - "Hard Delete" button is visible for `declined` and `access_revoked` members; shows confirmation dialog
  - After each action, the member list reloads to reflect the updated status
  - Only owner/admin can see management action buttons (existing `canManage` computed)

### T-143: Shared package tests for new schemas, types, and constants

- **Goal:** Add comprehensive tests for all new and updated shared package artifacts introduced in Phase 11.
- **Files to modify:**
  - [`shared/src/schemas/tenant.spec.ts`](shared/src/schemas/tenant.spec.ts:1) — test `TenantWithRoleSchema`,
    `MyInvitationSchema`, `MyInvitationsResponseSchema`, `PendingInvitationSchema`, `PendingInvitationsResponseSchema`
  - [`shared/src/schemas/task.spec.ts`](shared/src/schemas/task.spec.ts:1) — test `MyTaskSchema`,
    `MyTasksResponseSchema`
  - `shared/src/constants/roles.spec.ts` (create if missing) — test `MemberStatus` includes `'access_revoked'`
- **Dependencies:** T-125
- **Acceptance criteria:**
  - `TenantWithRoleSchema` validates a tenant with `role` field and rejects missing `role`
  - `MyInvitationSchema` validates the shape from spec §15.10.1
  - `PendingInvitationSchema` validates the shape from spec §15.10.3
  - `MyTaskSchema` validates `Task` + denormalized fields
  - `MemberStatus` includes all four values: `'active'`, `'pending'`, `'declined'`, `'access_revoked'`
  - Coverage ≥ 80% on new code

### T-144: Backend service tests for TenantService and TaskService dashboard methods

- **Goal:** Add and update tests for all new backend service methods introduced for the dashboard feature.
- **Files to modify:**
  - [`server/src/services/tenant.service.test.ts`](server/src/services/tenant.service.test.ts:1) — test:
    - `listTenantsWithRole` returns tenants with correct role per user
    - `getMyInvitations` returns pending invitations with denormalized tenant names
    - `getPendingInvitationsByTenant` returns pending invitations for owner/admin; throws for member
    - `declineInvitation` sets status to `'declined'`; rejects email mismatch; rejects non-pending
    - `revokeAccess` sets status to `'access_revoked'`; owner/admin only
    - `resendInvitation` resets to `'pending'` and sends email; owner/admin only
    - `hardDeleteMember` permanently deletes; owner/admin only
  - [`server/src/services/task.service.test.ts`](server/src/services/task.service.test.ts:1) — test:
    - `getMyTasks` returns tasks across all active tenants
    - `getMyTasks` returns denormalized `tenantName`, `projectName`, `columnTitle`
    - `getMyTasks` pagination works
    - `getMyTasks` priority filter works
    - `getMyTasks` returns empty for user with no memberships
- **Dependencies:** T-127, T-128
- **Acceptance criteria:**
  - All new service methods have test coverage
  - RBAC enforcement is tested (owner/admin checks)
  - Edge cases: email mismatch, non-pending status, empty memberships
  - Coverage ≥ 80% on new code

### T-145: Backend route tests for new dashboard endpoints

- **Goal:** Add tests for all new backend routes introduced for the dashboard feature.
- **Files to create:**
  - `server/src/routes/invitations.test.ts` — test:
    - `GET /invitations/my` returns pending invitations for authenticated user
    - `GET /invitations/my` returns empty array when no pending invitations
    - `DELETE /invitations/:invitationId` declines a pending invitation (204)
    - `DELETE /invitations/:invitationId` returns 403 on email mismatch
    - `DELETE /invitations/:invitationId` returns 404 on non-pending invitation
- **Files to modify:**
  - [`server/src/routes/tasks.test.ts`](server/src/routes/tasks.test.ts:1) — add tests for:
    - `GET /tasks/my` returns tasks across all tenants
    - `GET /tasks/my` pagination and priority filter
    - `GET /tasks/my` returns 401 without auth
  - [`server/src/routes/tenants.test.ts`](server/src/routes/tenants.test.ts:1) — add tests for:
    - `GET /tenants/:tenantId/invitations/pending` returns pending invitations (owner/admin)
    - `GET /tenants/:tenantId/invitations/pending` returns 403 for member role
    - `PATCH /tenants/:tenantId/members/:memberId/resend` resets invitation
    - `PATCH /tenants/:tenantId/members/:memberId/revoke` sets access_revoked
    - `DELETE /tenants/:tenantId/members/:memberId` hard-deletes declined/revoked member
- **Dependencies:** T-129, T-130, T-131
- **Acceptance criteria:**
  - All new endpoints have test coverage
  - Cross-tenant endpoints work without `X-Tenant-Id` header
  - Tenant-scoped endpoints enforce `X-Tenant-Id` and RBAC
  - Error cases (401, 403, 404) are tested
  - Coverage ≥ 80% on new code

### T-146: Frontend component and service tests for dashboard

- **Goal:** Add unit tests for all new and modified frontend components and services introduced for the dashboard.
- **Files to create:**
  - `ui/src/app/features/dashboard/dashboard.spec.ts` — test Dashboard orchestrator:
    - Visitor state: no API calls, renders landing page
    - New user state: renders welcome view
    - Pending invitations state: renders invitation view
    - Member state: renders member dashboard
    - Owner state: renders owner dashboard
    - Loading state: shows spinner
    - Error handling: `GET /invitations/my` failure degrades gracefully
  - `ui/src/app/features/dashboard/visitor/landing-page.spec.ts` — test static content renders
  - `ui/src/app/features/dashboard/new-user/welcome-view.spec.ts` — test welcome CTA
  - `ui/src/app/features/dashboard/pending-invitations/invitation-view.spec.ts` — test accept/decline
  - `ui/src/app/features/dashboard/member/member-dashboard.spec.ts` — test workspaces, tasks, stats
  - `ui/src/app/features/dashboard/owner/owner-dashboard.spec.ts` — test sent invitations, management links
- **Files to modify:**
  - [`ui/src/app/services/tenant-client.spec.ts`](ui/src/app/services/tenant-client.ts) (create if missing) — test new
    methods: `getMyInvitations`, `getPendingInvitations`, `declineInvitation`, `revokeAccess`, `resendInvitation`,
    `hardDeleteMember`, updated `loadTenants` with role field
  - `ui/src/app/services/task-client.spec.ts` (create if missing) — test `getMyTasks` method
  - `ui/src/app/features/tenants/tenant-member-list/tenant-member-list.spec.ts` (create if missing) — test
    `access_revoked` badge, resend/revoke/hard-delete actions
- **Dependencies:** T-137, T-138, T-139, T-140, T-141, T-142
- **Acceptance criteria:**
  - Dashboard orchestrator: all 5 states verified with mocked stores and services
  - Each sub-view component: renders correctly with expected inputs
  - Service methods: correct HTTP calls verified with `HttpTestingController`
  - TenantMemberList: new status badge and action buttons tested
  - Coverage ≥ 80% on new code

### T-147: E2E tests for dashboard states and flows

- **Goal:** Add Playwright E2E tests covering all dashboard states and the full user journey through the dashboard.
- **Files to create:**
  - `ui/e2e/dashboard.spec.ts` — test scenarios:
    - Visitor sees landing page at `/` with "Get Started" and "Log In" buttons
    - Visitor clicks "Get Started" → navigates to `/auth/register`
    - New user (authenticated, no tenants) sees welcome view with "Create your first workspace"
    - New user clicks "Create your first workspace" → navigates to `/workspace/create`
    - Pending invitations: user sees invitation cards; can accept → transitions to member/owner view
    - Pending invitations: user declines invitation → card removed; all declined → transitions to new-user
    - Member dashboard: sees "My Workspaces" and "My Recent Tasks"
    - Owner dashboard: sees "Pending Invitations Sent", management links, "Create another workspace"
    - Full journey: visitor → register → create workspace → invite member → see owner dashboard with pending invitation
- **Dependencies:** T-142, T-146
- **Acceptance criteria:**
  - All E2E scenarios pass
  - `npx playwright test` passes for the dashboard spec file
  - Tests cover both happy paths and error paths (decline invitation, empty states)

### T-148: Full integration verification of dashboard feature

- **Goal:** Run the complete quality gate suite across the entire monorepo and verify all dashboard features work
  end-to-end. Fix any issues found during verification.
- **Files to modify:**
  - Various (fix any issues found during verification)
- **Dependencies:** T-143, T-144, T-145, T-146, T-147
- **Acceptance criteria:**
  - `npm run build` succeeds for all workspaces (shared, server, ui)
  - `npm test` passes for all workspaces (≥ 80% coverage on new code)
  - `npm run lint` passes with zero errors
  - `tsc --noEmit` passes across the entire monorepo (zero TypeScript errors)
  - Full user journey works end-to-end: visit `/` as visitor → register → create workspace → navigate dashboard as owner
    → invite member → switch to invitee account → accept invitation → see member dashboard → decline another invitation
    → verify state transitions

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
| 8    | **Tenant member list endpoint**    | T-081                                         |

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
| 8    | **Tenant settings & members**      | T-082, T-083, T-084, T-085, T-086, T-087                                      |
| 9    | **Project member management**      | T-088                                                                         |

### Foundation tasks (required before the slice)

| Category            | Tasks               |
| ------------------- | ------------------- |
| Scaffolding         | T-001 through T-004 |
| Shared package      | T-005 through T-016 |
| Backend foundation  | T-017 through T-025 |
| Frontend foundation | T-054 through T-060 |

### User workflow rework tasks (Phase 10)

| Step | Feature                                          | Tasks                                           |
| ---- | ------------------------------------------------ | ----------------------------------------------- |
| 1    | **Shared: constants, schemas, types, contracts** | T-095, T-096, T-097, T-098                      |
| 2    | **Backend: repositories**                        | T-099, T-100                                    |
| 3    | **Backend: services**                            | T-101, T-102, T-103, T-104                      |
| 4    | **Backend: middleware + routes**                 | T-105, T-106, T-107                             |
| 5    | **Frontend: stores + services**                  | T-108, T-109                                    |
| 6    | **Frontend: components + routes**                | T-110, T-111, T-112, T-113, T-114, T-115, T-116 |
| 7    | **Tests + verification**                         | T-117, T-118, T-119, T-120, T-121, T-122        |

### Dashboard tasks (Phase 11)

| Step | Feature                                          | Tasks                                    |
| ---- | ------------------------------------------------ | ---------------------------------------- |
| 1    | **Shared: constants, schemas, types, contracts** | T-123, T-124, T-125                      |
| 2    | **Backend: repositories + indexes**              | T-126                                    |
| 3    | **Backend: services**                            | T-127, T-128                             |
| 4    | **Backend: routes**                              | T-129, T-130, T-131, T-132               |
| 5    | **Frontend: services**                           | T-133, T-134                             |
| 6    | **Frontend: routing + orchestrator**             | T-135, T-136                             |
| 7    | **Frontend: sub-view components**                | T-137, T-138, T-139, T-140, T-141, T-142 |
| 8    | **Tests + verification**                         | T-143, T-144, T-145, T-146, T-147, T-148 |

### Integration tasks

| Task  | Description                                                                       |
| ----- | --------------------------------------------------------------------------------- |
| T-074 | Connect frontend to backend and verify the full end-to-end flow                   |
| T-094 | Verify all Phase 9 features work end-to-end (settings, members, RBAC)             |
| T-122 | Verify user workflow rework end-to-end (no auto-tenant, subscriptions, invites)   |
| T-148 | Verify dashboard feature end-to-end (all 5 states, invitation flow, cross-tenant) |

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
10. **Phase 9** (T-081–T-094): Missing UI features (backend fix, service layer, tenant settings, tenant members, project
    members, testing)
11. **Phase 10** (T-095–T-122): User workflow rework — no auto-tenant registration, subscription tiers (free/premium),
    email-based invitation system, workspace creation page, mock upgrade page
12. **Phase 11** (T-123–T-148): Jira-style adaptive dashboard — visitor landing page, new-user welcome, pending
    invitations view, member dashboard (my workspaces + my tasks), owner dashboard (sent invitations + management),
    cross-tenant endpoints (`GET /invitations/my`, `GET /tasks/my`), `access_revoked` member status, tenant-member
    management actions (resend, revoke, hard-delete)
