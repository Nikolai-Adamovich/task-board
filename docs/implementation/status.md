# Task Board v6.0.0 — Implementation Status

> **Last updated:** 2026-08-22 **Current stage:** Implementation Complete

---

## Sources of Truth

| Document     | Path                                      | Purpose                                                                                                                    |
| ------------ | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Requirements | `docs/project-management-requirements.md` | MongoDB schemas, API contracts, authorization, persistence, validation, concurrency, domain constraints, state rules       |
| User Flows   | `docs/project-management-user-flows.md`   | Onboarding, registration, login, navigation, screens, UI behavior, user journeys, empty/error states, end-to-end scenarios |

**Gap-fill principle:** When the two source documents are silent or ambiguous, default to classic Jira (old-school
Atlassian) approaches.

---

## Pipeline Progress

| Stage     | Status      | Artifact                     | Notes                                                                 |
| --------- | ----------- | ---------------------------- | --------------------------------------------------------------------- |
| Analyst   | ✅ Approved | `technical_specification.md` | 14 sections, 19 entities, 60+ endpoints, 26 screens, 11 user journeys |
| Architect | ✅ Approved | `architecture.md`            | 12 sections, 17 repositories, 17 services, 10 design decisions        |
| Planner   | ✅ Approved | `plan.md`                    | 42 tasks across 7 phases (Phase 0–6)                                  |
| Developer | ✅ Complete | Source code                  | All phases implemented, 400 server tests passing, UI builds           |

---

## Phase Summary

| Phase | Description                          | Status      | Notes                                                         |
| ----- | ------------------------------------ | ----------- | ------------------------------------------------------------- |
| 0     | Reset — clean obsolete docs          | ✅ Complete | Old implementation docs removed                               |
| 1     | Analyst — technical specification    | ✅ Complete | 14 sections covering all domain, API, auth, screens, flows    |
| 2     | Architect — architecture design      | ✅ Complete | Server layers, Angular architecture, 10 design decisions      |
| 3     | Planner — task decomposition         | ✅ Complete | 42 tasks across 7 phases                                      |
| 4     | Developer — server rebuild           | ✅ Complete | Shared types, error model, RBAC, audit, cascade delete        |
| 5     | Angular Developer — frontend rebuild | ✅ Complete | Error interceptor, stores, guards, role-based UI, all screens |
| 6     | Integration verification             | ✅ Complete | All builds pass, all tests pass                               |

---

## Test Results

| Package   | Framework | Tests   | Status                             |
| --------- | --------- | ------- | ---------------------------------- |
| shared    | —         | 0       | ✅ No tests (runtime-library free) |
| server    | Vitest    | 400     | ✅ All pass                        |
| ui        | ng build  | —       | ✅ Build succeeds                  |
| **Total** |           | **400** | **✅ All pass**                    |

### Build Status

| Package | Command        | Status                       |
| ------- | -------------- | ---------------------------- |
| shared  | `tsc`          | ✅ Success                   |
| server  | `tsc --noEmit` | ✅ Success                   |
| server  | `vitest run`   | ✅ 400 tests pass (38 files) |
| ui      | `ng build`     | ✅ Success                   |

---

## Architecture Overview

```
task-board/
├── shared/          @task-board/shared — Types, constants, utility helpers (runtime-library free)
├── server/          @task-board/server — Hono API on Cloudflare Workers (Zod schemas, validators)
├── ui/              @task-board/ui    — Angular 22 zoneless frontend
├── .github/         CI/CD pipeline
└── docs/            Requirements, architecture, spec, plan, status
```

---

## Key v6.0.0 Changes from Rebuild

### Shared Types

- Added `ErrorCode` union type with all 19 spec error codes
- Made `authorId` nullable in Comment for deleted users
- Made `AuditActor.userId` and `AuditEvent.projectId` nullable
- Made `TaskType.icon` nullable

### Server

- Added `PROJECT_KEY_IMMUTABLE`, `TASK_TYPE_IN_USE`, `STATUS_IN_USE` error codes
- Fixed `ValidationError` HTTP status from 422 → 400
- Added `BadRequestError` and `GoneError` subclasses
- Added `deleteByProject()` to all 11 repositories for cascade delete
- Added audit side effects to all 9 auditable entity services
- Fixed sprint `endDate = now` when starting without endDate
- Fixed comment admin check to use project role instead of tenant role
- Status/TaskType DELETE now uses request body for replacement ID
- Tenant archive/restore cascades to projects respecting `archiveReason`
- Project cascade delete removes all owned entities

### Frontend

- Added all 13 missing error code translations
- Created `ProjectStore` for active project context and role
- `projectGuard` now loads project context and resolves role
- `StatusClient.delete()` and `TaskTypeClient.delete()` send replacement in body
- Tasks table rewritten with URL-addressable search/filter/sort/pagination
- Role-based UI: Viewer read-only, Editor content-only, Project Admin full access
- Sidebar hides admin navigation for Viewer/Editor roles
- Added "New Task" button with full create-task dialog on task table page (title, description, type, status, priority,
  assignee, sprint, labels)
- Embedded `FilterPanel` component directly into task table page (collapsible sidebar)
- Fixed task table filters — `statusId`, `priority`, `typeId`, `assigneeId` now passed to API
- Fixed `TaskQuery` interface to include all server-supported filter fields
- Removed standalone `/filters` route (filters now live on task table page)
- Task table: replaced basic filter dropdowns with AG Grid-style column-level sorting and filtering using spartan
  table + popover components
- Fixed task click navigation — `goToTask()` now correctly extracts tenantId from URL
- Removed `/filters` sidebar link (filters are embedded in task table)
- Installed `@spartan-ng/helm/table` and `@spartan-ng/helm/popover` packages
- Redesigned tenant-member-list and project-member-list as spartan tables with sortable columns (Name, Role, Status,
  Actions)
- Removed raw UUID display from member tables — tenant members show shortened IDs, project members show displayName
- Tenant member table now shows `displayName`/`email` instead of raw UUID — server resolves user data via
  `UserRepository`
- Both member tables (tenant + project) now have column-level filter popovers (Name, Role, Status)
- Added `displayName` and `email` optional fields to `TenantMember` shared type
- Server `getTenantMembers()` enriches members with user data from `UserRepository`
- Server tests: 400 passing (added 2 new tests for enriched member resolution)

---

## Current Blockers

None.

---

## Stage History

| Date       | Stage        | Action           | Details                                                                                          |
| ---------- | ------------ | ---------------- | ------------------------------------------------------------------------------------------------ |
| 2026-08-21 | Init         | Pipeline started | Full rebuild from two sources of truth. Old implementation docs removed.                         |
| 2026-08-21 | Analyst      | ✅ Approved      | Technical specification: 14 sections, 19 entities, 60+ endpoints, 26 screens                     |
| 2026-08-21 | Architect    | ✅ Approved      | Architecture: 12 sections, 17 repos, 17 services, 10 design decisions                            |
| 2026-08-21 | Planner      | ✅ Approved      | Plan: 42 tasks across 7 phases                                                                   |
| 2026-08-21 | Developer    | ✅ Server        | Phases 0-3: shared types, error model, RBAC, audit, cascade delete. 399 tests.                   |
| 2026-08-21 | Angular Dev  | ✅ Frontend      | Phases 4-5: stores, guards, error interceptor, role-based UI, all screens. Build passes.         |
| 2026-08-21 | Orchestrator | ✅ Verified      | Phase 6: All builds pass, all tests pass. Pipeline complete.                                     |
| 2026-08-22 | Angular Dev  | ✅ Hotfix        | Task table: create-task dialog, embedded filters, fixed API filter params. Build passes.         |
| 2026-08-22 | Angular Dev  | ✅ Hotfix        | Column-level filters/sorting, nav fix, sidebar cleanup, member tables. Build passes.             |
| 2026-08-22 | Developer    | ✅ Hotfix        | Member tables: resolve user names, add column filters, enrich TenantMember type. 400 tests pass. |
