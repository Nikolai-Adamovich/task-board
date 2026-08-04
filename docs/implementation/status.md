# Task Board MVP — Implementation Status

> **Last updated:** 2026-08-04 **Current stage:** Phase 15 Complete — Test Infrastructure Cleanup

---

## Pipeline Progress

| Stage     | Status      | Artifact                     | Notes                                                                                  |
| --------- | ----------- | ---------------------------- | -------------------------------------------------------------------------------------- |
| Analyst   | ✅ Approved | `technical_specification.md` | Updated to v4.0.0: user workflow, invitations, subscription tiers                      |
| Architect | ✅ Approved | `architecture.md`            | Updated to v4.0.0: invitation system, subscription model, Resend email                 |
| Planner   | ✅ Approved | `plan.md`                    | Updated to v4.0.0: 122 tasks across 11 phases (28 new in Phase 10)                     |
| Developer | ✅ Complete | Source code                  | Phases 12–15 implemented: Header redesign, Zod refactor, manifest themes, test cleanup |

## Phase Summary

| Phase | Description                                                                  | Status      | Notes                                                                                                                     |
| ----- | ---------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------- |
| 1     | Project scaffolding & shared package                                         | ✅ Complete | npm workspaces, TypeScript 6, ESLint 9, Prettier 3, Husky, Commitlint                                                     |
| 2     | Shared package — schemas & validators                                        | ✅ Complete | Zod v4 schemas, UUID/slug/pagination validators, API contracts (schemas/contracts/validators moved to server in Phase 13) |
| 3     | Backend — auth & tenancy                                                     | ✅ Complete | Hono on Workers, JWT auth, multi-tenant context, MongoDB Driver v7                                                        |
| 4     | Backend — projects, boards, columns                                          | ✅ Complete | Full CRUD with RBAC, board default columns                                                                                |
| 5     | Backend — tasks & sprints                                                    | ✅ Complete | Task CRUD, move/assign, sprint CRUD, task-sprint association                                                              |
| 6     | Frontend — auth & shell                                                      | ✅ Complete | Angular 22 zoneless, login/register, app shell, tenant switcher                                                           |
| 7     | Frontend — features (projects, boards, tasks, sprints)                       | ✅ Complete | Kanban board view, drag-and-drop, sprint management                                                                       |
| 8     | Integration & Polish                                                         | ✅ Complete | E2E API integration verified, 312 tests, CI/CD pipeline, deployment config                                                |
| 9     | Missing UI Features (tenant settings, member management)                     | ✅ Complete | Tenant settings, tenant members, project member management, RBAC UI                                                       |
| 10    | User Workflow Rework (invitations, subscriptions, registration)              | ✅ Complete | New registration flow, invitation system, subscription tiers, 6 new UI components                                         |
| 11    | Jira-Style Dashboard (5 adaptive states, landing page, cross-tenant queries) | ✅ Complete | Visitor landing, new-user CTA, invitation management, member/owner dashboards, access_revoked status                      |
| 12    | Header Redesign (user menu, theme switcher, zoom, notifications, help pages) | ✅ Complete | Global sticky header, PreferencesStore, user-preferences API, dropdown-menu, accordion, 40 new files                      |
| 13    | Refactor: Remove Zod from shared package                                     | ✅ Complete | Shared package is now runtime-library free; Zod schemas/validators moved to server                                        |
| 14    | Refactor: Manifest-driven theme system                                       | ✅ Complete | Build-time theme manifest generator; ThemeRegistry service; shared exports only DEFAULT_THEME_ID                          |
| 15    | Refactor: Test infrastructure cleanup                                        | ✅ Complete | Removed shared tests (runtime-library free); fixed UI spec imports; updated CI pipeline                                   |

## Test Results

| Package   | Framework     | Tests   | Status                             |
| --------- | ------------- | ------- | ---------------------------------- |
| shared    | —             | 0       | ✅ No tests (runtime-library free) |
| server    | Vitest        | 494     | ✅ All pass                        |
| ui        | Karma/Jasmine | 343     | ✅ All pass                        |
| **Total** |               | **837** | **✅ All pass**                    |

### Build Status

| Package | Command                     | Status                                |
| ------- | --------------------------- | ------------------------------------- |
| shared  | `tsc`                       | ✅ Success                            |
| server  | `wrangler deploy --dry-run` | ✅ Success (2791 KiB / gzip: 386 KiB) |
| ui      | `ng build`                  | ✅ Success (~470 kB initial)          |

### Type Checking

| Package | Status   |
| ------- | -------- |
| shared  | ✅ Clean |
| server  | ✅ Clean |

## Files Created in Phase 8

### T-074: Frontend-Backend Integration

- `server/src/index.ts` — Enhanced CORS middleware with configurable `ALLOWED_ORIGINS`
- `server/src/types/context.ts` — Added `ALLOWED_ORIGINS` to Bindings type
- `server/wrangler.toml` — Added `ALLOWED_ORIGINS` environment variable

### T-075: Shared Package Unit Tests (151 tests) — _Removed in Phase 15_

> **Note:** All shared package test files and `shared/vitest.config.ts` were removed in Phase 15 when the shared package
> was made runtime-library free (no Zod dependency). The tests that were here previously are now covered by the server
> package's schema/validator tests.

- ~~`shared/vitest.config.ts`~~ — _Deleted_
- ~~`shared/src/schemas/auth.spec.ts`~~ — _Moved to server_
- ~~`shared/src/schemas/tenant.spec.ts`~~ — _Moved to server_
- ~~`shared/src/schemas/project.spec.ts`~~ — _Moved to server_
- ~~`shared/src/schemas/board.spec.ts`~~ — _Moved to server_
- ~~`shared/src/schemas/task.spec.ts`~~ — _Moved to server_
- ~~`shared/src/schemas/sprint.spec.ts`~~ — _Moved to server_
- ~~`shared/src/schemas/common.spec.ts`~~ — _Moved to server_
- ~~`shared/src/validators/uuid.spec.ts`~~ — _Moved to server_
- ~~`shared/src/validators/slug.spec.ts`~~ — _Moved to server_
- ~~`shared/src/validators/pagination.spec.ts`~~ — _Moved to server_

### T-077: E2E Tests with Playwright

- `ui/playwright.config.ts` — Playwright configuration
- `ui/e2e/auth.spec.ts` — Auth flow E2E tests
- `ui/e2e/project.spec.ts` — Project CRUD E2E tests
- `ui/e2e/board.spec.ts` — Board/Kanban E2E tests
- `ui/e2e/task.spec.ts` — Task management E2E tests
- `ui/e2e/sprint.spec.ts` — Sprint management E2E tests

### T-078: CI/CD Pipeline

- `.github/workflows/ci.yml` — GitHub Actions CI/CD (build, test, lint, deploy)

### T-079: Deployment Configuration

- `server/wrangler.toml` — Cloudflare Workers config (MONGODB_URI, JWT_SECRET, ALLOWED_ORIGINS)
- `package.json` — Root scripts: `build`, `test`, `typecheck`, `deploy:server`, `deploy:ui`

## Files Created/Modified in Phase 9

### T-081: Backend — GET /tenants/:tenantId/members route

- `server/src/routes/tenants.ts` — Added GET `/:tenantId/members` route

### T-082: AuthStore tenantRole signal

- `ui/src/app/stores/auth-store.ts` — Added `tenantRole` signal with JWT decoding
- `ui/src/app/stores/auth-store.spec.ts` — 4 new tests for tenantRole

### T-083–T-084: TenantClient extensions

- `ui/src/app/services/tenant-client.ts` — Added 6 methods: updateTenant, deleteTenant, listMembers, inviteMember,
  updateMemberRole, removeMember

### T-085: TenantSettingsComponent

- `ui/src/app/features/tenants/tenant-settings/tenant-settings.ts` — Component
- `ui/src/app/features/tenants/tenant-settings/tenant-settings.html` — Template

### T-086: TenantMemberListComponent

- `ui/src/app/features/tenants/tenant-member-list/tenant-member-list.ts` — Component
- `ui/src/app/features/tenants/tenant-member-list/tenant-member-list.html` — Template

### T-087: Routes & Sidebar

- `ui/src/app/app.routes.ts` — Added tenant settings and members routes
- `ui/src/app/shell/sidebar/sidebar.html` — Added Settings and Members navigation links

### T-088: Project Member Management

- `ui/src/app/features/projects/project-detail/project-detail.ts` — Added member management methods (add, role change,
  remove)
- `ui/src/app/features/projects/project-detail/project-detail.html` — Added member management UI (add dialog, role
  dropdown, remove button)

### Route Tests (150 new tests)

- `server/src/routes/tenants.test.ts` — Tenant API route tests (23 tests)
- `server/src/routes/projects.test.ts` — Project API route tests (28 tests)
- `server/src/routes/boards.test.ts` — Board API route tests (16 tests)
- `server/src/routes/columns.test.ts` — Column API route tests (19 tests)
- `server/src/routes/tasks.test.ts` — Task API route tests (37 tests)
- `server/src/routes/sprints.test.ts` — Sprint API route tests (27 tests)

## Files Created/Modified in Phase 10

### Shared package updates

- `shared/src/constants/roles.ts` — Added `MemberStatus`, `SubscriptionTier` constants
- `server/src/schemas/tenant.ts` — Updated `TenantSchema` (subscription), `TenantMemberSchema` (nullable userId, status,
  invitation fields), added `InviteMemberSchema` (schemas moved from shared to server in Phase 13)
- `server/src/schemas/auth.ts` — Added `AcceptInvitationSchema`, `InvitationDetailsSchema`
- `server/src/contracts/tenant.contracts.ts` — Updated `addMember` contract body
- `server/src/contracts/auth.contracts.ts` — Added `acceptInvitation`, `getInvitation` contracts
- `shared/src/index.ts` — Updated barrel exports

### Backend updates

- `server/src/services/email.service.ts` — New: `EmailService` (Resend) + `ConsoleEmailService`
- `server/src/repositories/tenant-member.repository.ts` — Updated: nullable userId, invitation fields, new query methods
- `server/src/repositories/tenant.repository.ts` — Updated: subscription field
- `server/src/repositories/project.repository.ts` — Updated: added `countByTenant()`
- `server/src/services/auth.service.ts` — Updated: no auto-tenant, tenantId:null JWT, acceptInvitation,
  getInvitationDetails
- `server/src/services/tenant.service.ts` — Updated: subscription limits, invitation flow with email
- `server/src/services/project.service.ts` — Updated: subscription limit check
- `server/src/middleware/tenant-context.ts` — Updated: status check (active/pending/declined)
- `server/src/routes/auth.ts` — Updated: added accept-invitation and invitation details routes
- `server/src/routes/tenants.ts` — Updated: invite body validation, EmailService wiring
- `server/src/types/context.ts` — Updated: added RESEND_API_KEY, FRONTEND_URL bindings

### Frontend updates

- `ui/src/app/stores/auth-store.ts` — Updated: tenantId signal, needsWorkspace computed
- `ui/src/app/services/tenant-client.ts` — Updated: getInvitationDetails, acceptInvitation, createTenant methods
- `ui/src/app/services/auth-client.ts` — Updated: simplified register/login with setSession
- `ui/src/app/features/auth/register/register.ts` — Updated: redirect to workspace/create
- `ui/src/app/features/auth/accept-invitation/accept-invitation.ts` — New: invitation acceptance page
- `ui/src/app/features/tenants/create-workspace/create-workspace.ts` — New: workspace creation page
- `ui/src/app/features/tenants/upgrade/upgrade.ts` — New: mock upgrade page
- `ui/src/app/features/tenants/tenant-member-list/tenant-member-list.ts` — Updated: pending status badges
- `ui/src/app/shell/tenant-switcher/tenant-switcher.ts` — Updated: null tenant handling
- `ui/src/app/app.routes.ts` — Updated: added 3 new routes

### Test updates

- `server/src/schemas/tenant.spec.ts` — Updated fixtures for new fields (moved from shared in Phase 13)
- `server/src/schemas/auth.spec.ts` — Added invitation schema tests (moved from shared in Phase 13)
- `server/src/services/auth.service.test.ts` — Rewritten for new auth flow
- `server/src/services/tenant.service.test.ts` — Updated for invitation flow
- `server/src/routes/auth.test.ts` — Added invitation route tests
- `server/src/repositories/tenant.repository.test.ts` — Updated fixtures

## Files Created/Modified in Phase 11

### Shared package

- `shared/src/constants/roles.ts` — Added `'access_revoked'` to MemberStatus
- `server/src/schemas/tenant.ts` — Added TenantWithRoleSchema (moved from shared in Phase 13)
- `server/src/schemas/auth.ts` — Added MyInvitationSchema, PendingInvitationSchema (moved from shared in Phase 13)
- `server/src/schemas/task.ts` — Added MyTaskSchema (moved from shared in Phase 13)
- `shared/src/types/tenant.ts`, `auth.ts`, `task.ts` — Added new type exports
- `server/src/contracts/tenant.contracts.ts` — Updated list response to TenantWithRole (moved from shared in Phase 13)
- `server/src/contracts/auth.contracts.ts` — Added getMyInvitations, getMyTasks contracts (moved from shared in
  Phase 13)
- `shared/src/index.ts` — Updated barrel exports

### Backend

- `server/src/repositories/tenant-member.repository.ts` — Added findById, updateStatusById, deleteById, findByEmail,
  findByInvitedEmail, id field
- `server/src/repositories/task.repository.ts` — Added findByAssignee (cross-tenant)
- `server/src/services/tenant.service.ts` — Added listTenantsWithRole, getMyInvitations, getPendingInvitationsByTenant,
  declineInvitation, revokeAccess, resendInvitation, hardDeleteMember
- `server/src/services/task.service.ts` — Added getMyTasks (cross-tenant aggregation)
- `server/src/routes/invitations.ts` — New: cross-tenant invitation routes
- `server/src/routes/tenants.ts` — Updated: listTenantsWithRole, pending invitations, revoke/resend/hard-delete
- `server/src/index.ts` — Registered invitation routes, cross-tenant tasks/my endpoint

### Frontend

- `ui/src/app/app.routes.ts` — Removed authGuard from root route
- `ui/src/app/features/dashboard/dashboard.ts` — Reworked as 5-state orchestrator
- `ui/src/app/features/dashboard/landing-page/` — New: visitor marketing page
- `ui/src/app/features/dashboard/welcome-view/` — New: new-user CTA
- `ui/src/app/features/dashboard/invitation-view/` — New: pending invitations
- `ui/src/app/features/dashboard/member-dashboard/` — New: member view
- `ui/src/app/features/dashboard/owner-dashboard/` — New: owner view
- `ui/src/app/features/tenants/tenant-member-list/` — Updated: access_revoked badge, revoke/resend/hard-delete actions
- `ui/src/app/services/tenant-client.ts` — Added getMyInvitations, getTenantPendingInvitations, declineInvitation,
  revokeAccess, resendInvitation, hardDeleteMember, acceptInvitationById
- `ui/src/app/services/task-client.ts` — Added getMyTasks

### Tests

- `server/src/schemas/tenant.spec.ts` — Added TenantWithRole tests, access_revoked (moved from shared in Phase 13)
- `server/src/schemas/auth.spec.ts` — Added MyInvitation, PendingInvitation tests (moved from shared in Phase 13)
- `server/src/schemas/task.spec.ts` — Added MyTask tests (moved from shared in Phase 13)
- `server/src/routes/tenants.test.ts` — Updated mock for listTenantsWithRole

## Architecture Overview

```
task-board/
├── shared/          @task-board/shared — Types, constants, utility helpers (runtime-library free)
├── server/          @task-board/server — Hono API on Cloudflare Workers (Zod schemas, contracts, validators)
├── ui/              @task-board/ui    — Angular 22 zoneless frontend
├── .github/         CI/CD pipeline
└── docs/            Architecture, spec, plan, status
```

### API Endpoints (all prefixed `/api/v1`)

| Resource    | Endpoints                                                                                                                |
| ----------- | ------------------------------------------------------------------------------------------------------------------------ |
| Health      | `GET /health`                                                                                                            |
| Auth        | `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `POST /auth/accept-invitation`, `GET /auth/invitation/:token` |
| Tenants     | CRUD + member management + pending invitations, revoke/resend/hard-delete                                                |
| Projects    | CRUD + member management                                                                                                 |
| Boards      | CRUD + column management (nested)                                                                                        |
| Tasks       | CRUD + move + assign + cross-tenant `GET /tasks/my`                                                                      |
| Sprints     | CRUD + task association                                                                                                  |
| Invitations | `GET /invitations/my`, `DELETE /invitations/:id`                                                                         |

### Deployment Targets

| Component | Target             | Command                 |
| --------- | ------------------ | ----------------------- |
| Backend   | Cloudflare Workers | `npm run deploy:server` |
| Frontend  | Cloudflare Pages   | `npm run deploy:ui`     |
| Database  | MongoDB Atlas (v7) | External service        |

## Stage History

| Date       | Stage     | Action             | Details                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------- | --------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-07-28 | Init      | Pipeline started   | Existing artifacts reviewed: technical_specification.md (929 lines), architecture.md (1195 lines), plan.md (1253 lines/80 tasks)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 2026-07-28 | Analyst   | ✅ Approved        | **v2.0.0 update:** Added §1.4 Technology Versions. Updated Zod schemas to v4. Added Angular 22 patterns. Resolved all 4 blocking questions.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 2026-07-28 | Architect | ✅ Approved        | **v2.0.0 alignment:** Updated architecture.md to match spec v2.0.0. Angular zoneless, signal-based services, Zod v4, Tailwind v4 CSS-first, MongoDB v7, Hono 4.8, TypeScript 6.                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 2026-07-28 | Planner   | ✅ Approved        | **v2.0.0 alignment:** Updated plan.md with 80 tasks across 8+1 phases.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 2026-07-28 | Developer | ✅ Phase 1–7       | All implementation phases complete: shared package, backend API (161 tests), frontend Angular 22 app.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-07-28 | Developer | ✅ Phase 8         | **Integration & Polish:** (1) Enhanced CORS with configurable ALLOWED_ORIGINS. (2) Created 151 shared package unit tests across 10 spec files. (3) Verified all 161 backend tests pass. (4) Set up Playwright E2E test framework with 5 test files. (5) Created GitHub Actions CI/CD pipeline. (6) Configured deployment scripts for Cloudflare Workers + Pages. (7) Full build verification: shared ✅, server ✅ (2791 KiB), UI ✅ (306 kB initial). Type checking clean. **Total: 312 tests, all passing.**                                                                                                                             |
| 2026-07-29 | Developer | ✅ Phase 9         | **Missing UI Features:** (1) Added `GET /tenants/:tenantId/members` backend route. (2) Extended `AuthStore` with `tenantRole` signal from JWT. (3) Extended `TenantClient` with 6 member/tenant management methods. (4) Created `TenantSettingsComponent` with edit form and danger zone delete. (5) Created `TenantMemberListComponent` with invite dialog, inline role editing, and remove. (6) Added settings/members routes and sidebar links. (7) Extended `ProjectDetailComponent` with add/remove/role-change member controls. (8) Full RBAC UI gating based on tenant role. Build passes, 345 tests pass.                          |
| 2026-07-29 | Developer | ✅ API Tests       | **Route tests for all APIs:** Created 6 route test files (tenants, projects, boards, columns, tasks, sprints) with 150 tests covering all HTTP endpoints. Total: 344 server tests, 495 across all packages.                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 2026-07-29 | Analyst   | ✅ Approved v3.0.0 | **v3.0.0 update:** Updated technical_specification.md with user workflow rework: invitation-based registration, subscription tiers, new auth flow.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 2026-07-29 | Architect | ✅ Approved v3.0.0 | **v3.0.0 update:** Updated architecture.md with invitation system architecture, Resend email integration, subscription model.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2026-07-29 | Planner   | ✅ Approved v3.0.0 | **v3.0.0 update:** Updated plan.md with 122 tasks across 11 phases. Added 28 new tasks (T-095 through T-122) in Phase 10.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 2026-07-29 | Developer | ✅ Phase 10        | **User Workflow Rework:** (1) New registration flow without auto-tenant creation. (2) Email-based invitation system with Resend. (3) Subscription tier limits (free/pro/enterprise). (4) Workspace creation page. (5) Invitation acceptance page. (6) Mock upgrade page. (7) Pending member status badges. (8) Updated auth flow with tenantId:null JWT. (9) 6 new test files / updated tests. **Total: 599 tests, all passing.**                                                                                                                                                                                                          |
| 2026-07-30 | Developer | ✅ Phase 11        | **Jira-Style Dashboard:** (1) 5-state dashboard orchestrator (visitor, new-user, invitation, member, owner). (2) Visitor landing page with marketing content. (3) New-user CTA for workspace creation. (4) Cross-tenant invitation management (`GET /invitations/my`, decline). (5) Cross-tenant task aggregation (`GET /tasks/my`). (6) Owner dashboard with pending invitations and member management. (7) `access_revoked` member status with revoke/resend/hard-delete actions. (8) `TenantWithRoleSchema` for role-aware tenant listing. (9) Removed authGuard from root route for visitor access. **Total: 629 tests, all passing.** |
| 2026-08-04 | Developer | ✅ Phase 13        | **Refactor: Remove Zod from shared:** (1) Moved all Zod schemas, contracts, and validators from shared to server. (2) Shared package is now runtime-library free (zero dependencies). (3) Types converted from `z.infer<>` to plain TypeScript interfaces. (4) New `valuesOf()` utility helper. (5) Constants use `valuesOf()` for strongly-typed tuples. (6) Server imports constants from shared and uses `z.enum()` pattern. **Server: 494 tests pass.**                                                                                                                                                                                |
| 2026-08-04 | Developer | ✅ Phase 14        | **Refactor: Manifest-driven themes:** (1) Replaced hardcoded 32-theme `Theme` const with build-time manifest generator. (2) New `ThemeRegistry` service fetches `/themes/manifest.json`. (3) `ThemeLoader` simplified to accept string. (4) Theme picker renders card previews from manifest data. (5) `DEFAULT_THEME_ID` replaces `ThemeValues` for default theme. (6) Added lifecycle hooks for manifest generation.                                                                                                                                                                                                                     |
| 2026-08-04 | Developer | ✅ Phase 15        | **Refactor: Test infrastructure:** (1) Removed shared package tests (runtime-library free). (2) Removed `shared/vitest.config.ts`. (3) Removed `test:shared` from root scripts and CI. (4) Fixed `ThemeLoaderService` → `ThemeLoader` import in UI spec. **Server: 494 tests, UI: 343 tests, Total: 837.**                                                                                                                                                                                                                                                                                                                                 |

## Current Blockers

None.

## Decisions Log

| Date       | Decision                                       | Rationale                                                                                                                  |
| ---------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 2026-07-28 | Reuse existing artifacts as base               | All three docs exist and are comprehensive; update in place for latest versions                                            |
| 2026-07-28 | Access-token-only JWT (24h expiry)             | Sufficient for MVP; refresh tokens add complexity without educational value                                                |
| 2026-07-28 | Configurable column names on board create      | `CreateBoardSchema.columnNames` array; `DefaultColumnNames` as fallback                                                    |
| 2026-07-28 | Task comments/activity logs out of MVP         | Not in scope for vertical slice; can be added post-MVP                                                                     |
| 2026-07-28 | Password reset/email verification out of MVP   | Basic email/password auth only; post-MVP enhancement                                                                       |
| 2026-07-28 | Zod v4 with `z.interface()` (server-only)      | Better performance than `z.object()`; `zod/mini` for frontend tree-shaking. Zod is now server-only after Phase 13 refactor |
| 2026-07-28 | Angular 22 zoneless by default                 | No `zone.js`; all reactivity via signals; zoneless is default in Angular 21+                                               |
| 2026-07-28 | Tailwind CSS v4 CSS-first config               | No `tailwind.config.js`; `@theme` directive in CSS; auto content detection                                                 |
| 2026-07-28 | MongoDB Driver v7 (async-only)                 | Drops legacy callbacks; all operations return promises                                                                     |
| 2026-07-28 | CORS via ALLOWED_ORIGINS env var               | Configurable per-environment; '*' in dev, explicit origins in production                                                   |
| 2026-07-28 | Vitest for server tests                        | Fast, native ESM support. Shared package no longer has tests (runtime-library free since Phase 13)                         |
| 2026-08-04 | Shared package runtime-library free            | Zero dependencies — no Zod, Angular, Hono, RxJS. Types are plain TS interfaces. Schemas live in server                     |
| 2026-08-04 | Manifest-driven theme system                   | Build-time theme manifest replaces hardcoded 32-theme enum. ThemeRegistry service lazy-loads manifest.json                 |
| 2026-08-04 | `valuesOf()` utility for constant tuples       | Reusable helper extracts values from `as const` objects as strongly-typed non-empty tuples                                 |
| 2026-07-28 | Playwright for E2E tests                       | Industry standard; Chromium-based; good Angular integration                                                                |
| 2026-07-28 | Cloudflare Workers + Pages deployment          | Serverless backend + static frontend; global edge distribution                                                             |
| 2026-07-29 | Spartan UI for all new components              | Maximize reuse of existing Helm components (Button, Dialog, Field, Input, NativeSelect, Badge, Avatar, Card, Spinner)      |
| 2026-07-29 | RBAC via AuthStore.tenantRole signal           | Derive role from JWT payload; gates UI controls without extra API calls                                                    |
| 2026-07-29 | Tenant member invite by email                  | Backend accepts `{ email, role }` not `userId`; user must exist in system                                                  |
| 2026-07-29 | Invitation-based registration flow             | Users register without auto-tenant; redirected to workspace create or accept invitation                                    |
| 2026-07-29 | Resend for transactional email                 | EmailService abstraction; ConsoleEmailService for local dev; Resend for production                                         |
| 2026-07-29 | Subscription tiers (free/pro/enterprise)       | Limits on projects/members per tenant; enforced at service layer                                                           |
| 2026-07-29 | RESEND_API_KEY + FRONTEND_URL in wrangler      | Required for email sending and invitation links in production; must be configured in `wrangler.toml`                       |
| 2026-07-30 | `access_revoked` status for revoking access    | Soft-delete approach; member record stays but access is revoked; allows resend to re-activate                              |
| 2026-07-30 | Application-level cross-tenant aggregation     | Different tenants may be in different databases; aggregation done at service layer, not DB level                           |
| 2026-07-30 | GET /tenants response includes role per tenant | Enables dashboard state detection on frontend without extra API calls                                                      |
| 2026-07-30 | Root route (/) removes authGuard               | Visitor landing page accessible without authentication; individual feature routes still guarded                            |

## Files Created in Phase 12

### Header Redesign (28 tasks across 7 phases)

**Spec & Architecture:**

- `docs/implementation/header_spec.md` — Technical specification
- `docs/implementation/header_architecture.md` — Architecture design
- `docs/implementation/header_plan.md` — Implementation plan (28 tasks)

**Shared Package (T-H002, T-H003, T-H004):**

- `shared/src/types/common.ts` — UserPreferences type definitions (schemas moved to server in Phase 13)
- `shared/src/constants/paths.ts` — Added users.preferences path
- `shared/src/index.ts` — Added barrel exports

**Server — Schemas & Contracts (moved from shared in Phase 13):**

- `server/src/schemas/user-preferences.ts` — UserPreferences Zod schemas
- `server/src/contracts/user-preferences.contracts.ts` — API contracts

**Server (T-H005, T-H006, T-H007, T-H008):**

- `server/src/repositories/user-preferences.repository.ts` — MongoDB data access
- `server/src/repositories/user-preferences.repository.test.ts` — Repository tests
- `server/src/services/user-preferences.service.ts` — Business logic
- `server/src/services/user-preferences.service.test.ts` — Service tests
- `server/src/routes/user-preferences.ts` — Hono route handlers
- `server/src/routes/user-preferences.test.ts` — Route tests
- `server/src/index.ts` — Registered user-preferences routes

**Frontend — Stores & Services (T-H009, T-H010):**

- `ui/src/app/services/user-preferences-client.ts` — HTTP client
- `ui/src/app/stores/preferences-store.ts` — Signal-based store (zoom, theme, language)
- `ui/src/app/stores/preferences-store.spec.ts` — Store tests

**Frontend — Utilities (T-H011, T-H012):**

- `ui/src/styles.css` — Added --header-height, --zoom, --role-* CSS variables, zoom transform
- `ui/src/app/shell/header/role-color.util.ts` — Role-to-color mapping
- `ui/src/app/shell/header/zoom.util.ts` — Zoom values array and navigation

**Frontend — Header Components (T-H013–T-H023):**

- `ui/src/app/shell/header/header-branding/` — App icon + "Task Board" link
- `ui/src/app/shell/header/header-search/` — Search placeholder with icons
- `ui/src/app/shell/header/sign-in-button/` — "Sign in" button (unauthenticated)
- `ui/src/app/shell/header/user-menu/` — User dropdown menu (avatar, info, language, themes, zoom, preferences, sign
  out)
- `ui/src/app/shell/header/user-menu/user-menu-theme-sheet/` — Bottom sheet theme selector
- `ui/src/app/shell/header/user-menu/user-menu-zoom-controls/` — Zoom −/+ controls
- `ui/src/app/shell/header/notifications-button/` — Bell icon + right-side sheet
- `ui/src/app/shell/header/help-menu/` — Help dropdown (FAQ, Docs, Support)
- `ui/src/app/shell/header/header-actions/` — Conditional auth rendering container
- `ui/src/app/shell/header/header.ts` — Rewritten root header component
- `ui/src/app/shell/header/header.html` — Rewritten template
- `ui/src/app/app.html` — Added global `<ui-header />`
- `ui/src/app/app.ts` — Imported Header, PreferencesStore initialization
- `ui/src/app/shell/app-shell/app-shell.html` — Removed `<ui-header />`
- `ui/src/app/shell/app-shell/app-shell.ts` — Removed Header import, added PreferencesStore load

**Frontend — Help Pages & Settings (T-H024, T-H025, T-H026):**

- `ui/src/app/features/help/faq/` — FAQ page with Spartan Accordion
- `ui/src/app/features/help/docs/` — Documentation placeholder page
- `ui/src/app/features/help/support/` — Support contact form page
- `ui/src/app/features/settings/` — Settings placeholder page
- `ui/src/app/app.routes.ts` — Added /faq, /docs, /support, /settings routes

**Spartan UI Components Installed (T-H001):**

- `ui/libs/ui/dropdown-menu/` — 17 component files
- `ui/libs/ui/accordion/` — 4 component files

**Renaming (T-H027):**

- `ui/src/app/features/auth/accept-invitation/accept-invitation.html` — "Go to Login" → "Go to Sign in"
- `ui/src/app/features/auth/login/login.ts` — "Login failed" → "Sign in failed"
- `ui/e2e/auth.spec.ts` — Test descriptions updated

## Files Created/Modified in Phase 13

### Refactoring: Remove Zod from Shared Package

The shared package was refactored to be completely runtime-library free (no Zod, no Angular, no Hono, no RxJS).

**Moved from shared to server:**

- `shared/src/schemas/` → `server/src/schemas/` — All Zod validation schemas (auth.ts, user.ts, tenant.ts, project.ts,
  board.ts, task.ts, sprint.ts, common.ts, user-preferences.ts, support.ts)
- `shared/src/contracts/` → `server/src/contracts/` — All API contract definitions (auth, user, tenant, project, board,
  task, sprint, user-preferences, common)
- `shared/src/validators/` → `server/src/validators/` — All Zod validator helpers (common.ts, uuid.ts, slug.ts,
  pagination.ts)

**Updated in shared:**

- `shared/src/constants/theme.ts` — Removed `Theme` const (32 entries), `ThemeValues`, `ThemeSchema`; now only exports
  `DEFAULT_THEME_ID = 'light'`
- `shared/src/constants/roles.ts` — Uses new `valuesOf()` helper for strongly-typed value tuples
- `shared/src/constants/http.ts` — Uses new `valuesOf()` helper
- `shared/src/types/` — All types converted from `z.infer<>` to plain TypeScript interfaces
- `shared/src/types/common.ts` — New file with `ThemeManifestItem`, `ErrorResponse`, `Pagination`, `ListQuery`,
  `UserPreferences`, `UpdateUserPreferences`, `SupportRequest`
- `shared/src/utils/values-of.ts` — New reusable helper: `valuesOf(obj)` extracts values from an `as const` object
- `shared/src/index.ts` — Exports only constants, types, `DEFAULT_THEME_ID`, `ThemeManifestItem`, and `valuesOf`
- `shared/package.json` — `dependencies: {}`, no `devDependencies`

**Updated in server:**

- `server/package.json` — Added `zod: "^4.0.0"` as direct dependency
- Server schemas import constants like `TenantRoleValues`, `ProjectRoleValues` from `@task-board/shared` and use
  `z.enum(TenantRoleValues)` pattern
- Server uses `z.string().min(1).default(DEFAULT_THEME_ID)` instead of `z.enum(ThemeValues)` for theme validation
- Server route files updated to import schemas from local `../schemas/` instead of `@task-board/shared`

## Files Created/Modified in Phase 14

### Refactoring: Manifest-Driven Theme System

Replaced the hardcoded 32-theme `Theme` const with a build-time manifest generator.

**New files:**

- `ui/scripts/generate-theme-manifest.mjs` — PostCSS-based build-time generator that scans
  `ui/public/themes/*-theme.css`, extracts preview colors, detects light/dark mode, generates
  `ui/public/themes/manifest.json`
- `ui/src/app/services/theme-registry.ts` — New `ThemeRegistry` service: lazily fetches `/themes/manifest.json`, caches
  in memory, exposes `themes` signal
- `ui/public/themes/manifest.json` — Generated build artifact (added to `.gitignore`)

**Updated files:**

- `ui/src/app/services/theme-loader.ts` — Simplified to accept `string` (theme id) instead of `Theme` enum; only applies
  CSS
- `ui/src/app/stores/preferences-store.ts` — `theme` signal is now `signal<string>(DEFAULT_THEME_ID)`, no more `Theme`
  type
- `ui/src/app/shell/header/user-menu/user-menu-theme-sheet/` — Rewritten to use `ThemeRegistry`, render card previews
  from manifest data, CSS auto-fill grid for responsive columns
- `ui/package.json` — Added `generate:themes`, `prestart`, `prebuild`, `pretest`, `pretest:verbose`, `pree2e` lifecycle
  hooks; removed `watch` script

## Files Created/Modified in Phase 15

### Refactoring: Test Infrastructure Cleanup

Removed shared package tests (now runtime-library free) and fixed UI test imports.

**Removed:**

- `shared/vitest.config.ts` — Deleted
- `shared/package.json` — Removed `test`, `test:verbose`, `test:watch` scripts and `vitest` devDependency
- `package.json` (root) — Removed `test:shared` script, removed shared from `test` and `test:verbose` chains
- `.github/workflows/ci.yml` — Removed "Run shared tests" step

**Fixed:**

- `ui/src/app/stores/preferences-store.spec.ts` — Fixed `ThemeLoaderService` → `ThemeLoader` import
