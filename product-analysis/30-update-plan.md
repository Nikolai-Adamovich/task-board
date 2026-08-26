# 30 — Application Update Plan

Executes the adopted decisions **DEC-016…DEC-039** ([decision-log.md](decision-log.md)) from the gap analysis
([28](28-implementation-gap-analysis.md)) and UI/UX audit ([29](29-ui-ux-audit.md)). Work packages are ordered by
dependency; each is independently verifiable.

Global verification gate for every package: `npm run typecheck && npm test && npm run lint` green; no regressions in
existing specs.

---

## Phase 1 — Server foundations

### W1 — Authorization & integrity fixes (server)

Decisions: DEC-016 (sprint start fills only startDate), DEC-017 (remove router-level `create_project` gate; per-action
checks on projects routes), DEC-019 (user deletion scoped to same-tenant Owner/TAdmin + membership cleanup), DEC-020
(Editor owns-only comment edit/delete; PAdmin+ moderate), DEC-021 + DEC-028 (split `view_task_history` from
`view_audit_events`; store actor displayName snapshot in every audit event). Files: `routes/index.ts`,
`routes/projects.ts`, `services/sprint.service.ts`, `services/tenant.service.ts`, `services/comment.service.ts`,
`services/rbac.service.ts`, `services/audit.service.ts` + tests.

### W2 — Membership semantics rework (server + shared)

Decision: DEC-018 — invited memberships persist as `ACCESS_REVOKED` + invitation PENDING; acceptance → ACTIVE;
expiration/revocation flows updated; access checks rely on status only. Files: `services/tenant-member.service.ts`,
`repositories/tenant-member.repository.ts`, invitation routes, auth-related membership lookups + tests. Data note: dev
DBs may need a small migration for existing invited members.

### W3 — Tenant slug support (server + shared)

Decision: DEC-032 — `slug` on Tenant (generated from name, `[a-z0-9-]`, max 48, globally unique index),
availability-check endpoint (enumeration-safe), tenant-context resolution by slug, project-key → projectId and
task-number → taskId resource resolution for the new URL scheme. Files: `schemas/tenant.ts`,
`services/tenant.service.ts`, `middleware/tenant-context.ts`, `routes/tenants.ts`, repositories/indexes + tests.

### W4 — Transaction-based project seed (server + infra)

Decision: DEC-025 — seed inside a MongoDB transaction; local Docker MongoDB as single-node replica set; Atlas Free
compatible; compensating delete removed. Files: `services/project.service.ts`, docker/compose or docs for replica-set
setup, wrangler vars unchanged + tests (transaction mocked or integration-gated).

## Phase 2 — Auth & onboarding features

### W5 — Password reset (server + ui)

Decision: DEC-023 — request/reset endpoints, hashed single-use expiring tokens, neutral responses, email template
(Resend + console fallback), login-page link, i18n strings.

### W6 — Mock checkout (ui, minimal server) — DONE

Decision: DEC-022 — onboarding step after workspace creation: plan card (Free $0) → mock checkout → confirmation;
isolated behind a billing-boundary service/stub; no real payment data.

Status: implemented. `BillingClient` (`ui/src/app/services/billing-client.ts`) is the billing boundary;
`create-workspace` runs details (with slug field + live availability) → plan → checkout → confirmation, creating the
tenant only after confirmation. No server billing endpoint added (client-side mock suffices for MVP).

## Phase 3 — UI rework

### W7 — Removals + unified tenant home + slug routing (ui) — DONE

Decisions: DEC-031 (delete header-search), DEC-037 (delete notifications button + panel), DEC-033 (root redirect to
last/first tenant; single unified dashboard with My-Tasks widget; retire Owner/Member dashboards), DEC-032 client side
(routes `/t/:tenantSlug/...`, canonical task URL `.../tasks/:taskNumber`, regenerate all internal links, fix X-2
mislinks), create-workspace gains slug field with live availability check.

Status: implemented. Header search + notifications UI deleted; routes restructured to `/t/:tenantSlug/...` with legacy
`/tenants/:id` → slug redirect guard; task detail resolves by KEY-NUMBER via the existing server lookup (no new client
endpoint needed); unified `tenant-home` replaces workspace-detail + owner/member dashboards (create-project CTA dialog,
projects grid, My-Tasks widget scoped to the active tenant, pending-invitations summary for admins); root entry keeps
landing/welcome/invitation states and redirects authenticated users to the last/first tenant home; i18n keys updated in
all 11 locales. Deviation: `MyTask` frontend type dropped — the server returns plain `Task[]`, so the widget resolves
project keys client-side from the loaded projects list.

### W8 — Project overview + settings hub (ui) — DONE

Decisions: DEC-034 (overview widgets: status summary, active sprint, recent tasks, members preview, board shortcuts),
DEC-035 (`…/settings` index with General/Members/Types/Statuses/Labels/Boards/Danger Zone; archive/delete moved out of
overview; General page edits name/description/key-pre-first-task).

Status: implemented. `project-detail` rebuilt as the S9 landing page (header with name/key/status badge/description,
per-status task counts via per-status `limit=1` totals from the tasks list endpoint, active-sprint block with empty
state CTA, recent-5-updated tasks, members preview from `ProjectStore.members`, compact boards grid, archived/
deletion-pending read-only banners). New routes under `projects/:projectKey`: `settings` (hub index), `settings/general`
(name/description form; key rendered locked with hint), `settings/boards` (create/rename/delete, default-board delete
blocked per BR-023, invalid status-column refs marked red), `settings/danger-zone` (archive/restore/cancel-deletion/
delete with typed confirmation). Sidebar collapses the three config links into one admin-gated Settings entry.
Permission gating via `canManageProject`. i18n keys added in all 11 locales. Deviations: key editing is not offered at
all because the server `UpdateProject` schema has no `key` field (immutability is total, not just post-first-task); hub
Members link points to the existing `members` page rather than a new settings subpage.

### W9 — Board & sprint UX (ui) — DONE

Decisions: DEC-038 (sprint selector in board view via `?sprintId=`; sprint-detail deep-links into scoped board), DEC-039
(Backlog group on Sprints page), DEC-029 (overdue indicator on ACTIVE sprints past endDate). Improvements:
filtered-empty state + active filter chips on task table; search debounce.

Status: implemented. Board toolbar gains a sprint selector ("All tasks" + sprints with status badges) writing
`?sprintId=` (merge, replaceUrl) plus a scoped "Sprint: \<name\>" chip with clear action; the task query already honored
the param. Sprint-list gains a Backlog collapsible group at the top with backlog-task count (`sprintId=null`, `limit=1`
total) linking to the new `sprints/backlog` route (`backlog-view` wraps `SprintBacklog`; backlog tasks now link to
canonical task URLs when projectKey is provided). ACTIVE sprints past endDate show a destructive "Overdue" badge with
i18n'd tooltip in sprint-list and sprint-detail (`isSprintOverdue()` in `shared/utils/sprint-utils.ts`, visual only).
Task table: free-text search debounced ~300 ms (header box + title-column popover share one buffer/timer, cancelled on
destroy), distinct filtered-empty state with one-click "Clear filters", and active-filter chips above the table with
per-chip remove. i18n keys added in all 11 locales via `scripts/w9-i18n.mjs`. Deviation: sprint-detail's "open board"
deep-link was not added — no such action exists today and adding navigation buttons was out of the stated scope.

## Execution order & delegation

W1 → W2 → W3 → W4 → W5 → W6 → W7 → W8 → W9. W1–W4 are server-only and sequential-ish (W2/W3 independent of each other
but both touch membership/tenant context — keep order). W7 depends on W3 (slug endpoints). W8/W9 depend on W7 routing.
W5/W6 are independent of W2–W4 and may run any time after W1.

Each work package is executed by a delegated implementation agent with the relevant decision text, file pointers, repo
conventions (AGENTS.md rules), and the verification gate. Progress and deviations are recorded back into this plan.
