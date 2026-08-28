# 34 — UI/UX Round 4 Plan

Input: owner feedback after round 3 (12 items: tasks-table improvements, members/audit tables, tooltips, board filters,
sidebar restructure + collapse + mobile, mobile paddings/scroll, script hygiene, Tailwind canonical classes). This
document records research findings, proposed decisions, open questions (RQ-01..RQ-04) and the package breakdown
(Q1..Q8).

---

## 1. Research findings

### F-01 Tasks table — Created/Updated date filters (item 1a)

Current state:

- [`task.repository.ts`](../server/src/repositories/task.repository.ts) `findByProject()` supports
  `statusId/priority/typeId/assigneeId/reporterId/sprintId/labelId/search` only — **no date ranges**.
- Shared [`TaskQueryOptions`](../shared/src/types/task.ts) has no date fields.
- The column-filter popover system in [`task-table.html`](../ui/src/app/features/tasks/task-table/task-table.html)
  supports `filterType: 'text' | 'select'` — a third `'date'` type is needed.

Required work (full stack):

1. `shared`: extend task query types with `createdFrom`, `createdTo`, `updatedFrom`, `updatedTo` (ISO dates, inclusive).
2. Server: Zod query schema + repository `$gte/$lte` on `createdAt`/`updatedAt`. Indexes `{ projectId, createdAt: -1 }`
   / `{ projectId, updatedAt: -1 }` already exist ([`task.repository.ts`](../server/src/repositories/task.repository.ts)
   header comment) so range queries stay efficient.
3. UI: new column-def `filterType: 'date'` rendering a mode select (`on` / `before` / `after` / `between`) + one or two
   date inputs inside the existing header popover; URL params sync like the other filters; chips show a human-readable
   range.

### F-02 Tasks table — header context-menu closes on mouseup (item 1b, bug)

Root cause found in [`task-table.ts`](../ui/src/app/features/tasks/task-table/task-table.ts): `onHeaderContextMenu()`
positions a hidden anchor and calls `ctxMenuTrigger().open()` inside `setTimeout`. The menu opens while the right button
is still held; the following `mouseup`/`click` lands outside the trigger, so CDK treats it as an outside click and
closes the menu instantly.

Fix direction: replace the hand-rolled anchor+trigger mechanism with the **Spartan `context-menu` component** (Helm
layer exists — see §4 of this doc), which handles right-click lifecycle natively. This also honors the "Spartan Helm
components only" rule better than the current custom CDK wiring.

### F-03 Tasks table — middle-click open in new tab (item 1c)

Rows are `<tr>` with `(click)="goToTask(task)"` — no href, so the browser cannot middle-click-open. Fix: add
`(auxclick)` handler; when `event.button === 1`, resolve the task URL via `router.createUrlTree(...)` + `serializeUrl`
and `window.open(url, '_blank')`. Also set `[attr.aria-label]`/cursor affordance already present.

### F-04 Tasks table — Auto page size underfills viewport (item 1d, bug)

Root cause: [`computeAutoPageSize()`](../ui/src/app/features/tasks/task-table/task-table.ts) divides the measured
wrapper height by the constant `TASK_ROW_HEIGHT_PX = 48`. The real rendered row height is smaller (~44 px depending on
font/zoom), so `floor(available / 48)` yields fewer rows than fit (owner sees 21 rows where ~26 fit).

Fix: measure the **actual row height from the DOM** (first rendered `<tr>` `offsetHeight`, observed via the existing
ResizeObserver setup) and fall back to the 48 px constant only when no rows are rendered yet. Keep the `[5..100]` clamp
and the spacer-row logic unchanged.

### F-05 Members & Audit tables — full height + Auto rows + no loading spinner (item 2)

- [`member-table.html`](../ui/src/app/shared/member-table/member-table.html) renders a loading `<tr>` with spinner
  ([`member-table.html`](../ui/src/app/shared/member-table/member-table.html) `@if (loading())`) and has no
  full-height/Auto logic.
- [`audit-log-viewer.html`](../ui/src/app/features/audit/audit-log-viewer/audit-log-viewer.html) shows a centered
  spinner block while loading and uses fixed pagination.

Plan: extract the task-table's full-height flex-column + ResizeObserver Auto-page-size math into a **shared reusable
piece** (directive/util + wrapper markup under `ui/src/app/shared/`), then apply to both tables. Loading spinners/rows
removed entirely — resources already carry `defaultValue`, so tables render empty-state directly; keep the `@empty` "no
results" state only when not loading.

### F-06 Missing i18n role keys (item 2c, bug) — CONFIRMED

[`member-table.ts`](../ui/src/app/shared/member-table/member-table.ts) maps project roles to `members.roleProjectAdmin`
/ `members.roleEditor` / `members.roleViewer`, but `en.json` defines only `roleOwner` / `roleAdmin` / `roleMember` — the
three project-role keys are missing (raw key shown in UI). Must be added in **all 11 locales** (en, de, es, fr, it, ja,
ko, pl, pt, ru, zh-Hans); other locales audited during implementation for the same gap.

### F-07 Tooltip migration scope (item 3)

27 `[title]`/`[attr.title]` usages found across templates. They split into two distinct groups:

| Group                                                 | Examples                                                                                                | Recommendation                                                                                                                                         |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Controls** (icon buttons, badges-as-buttons)        | member-table action buttons, task-table filter/column buttons, sprint overdue badge, board clear-sprint | migrate to `hlmTooltip` (Spartan tooltip exists)                                                                                                       |
| **Truncated data cells** (one per table row × N rows) | task-table title/status/type/priority cells, audit changes old/new                                      | **keep native `title`** — mounting an overlay trigger per cell is a measurable perf cost on 100-row pages, and native titles work fine for text reveal |

Sidebar menu items already use the built-in `[tooltip]` of `hlmSidebarMenuButton`.

### F-08 Board — sidebar order + assignee/priority filters (item 4)

- Sidebar already contains a Board link pointing at the default board
  ([`sidebar.html`](../ui/src/app/shell/sidebar/sidebar.html)); it currently sits **before** Tasks. Reorder to Overview
  → Tasks → Board → Sprints → …
- Board view fetches via `TaskClient` with optional `sprintId`
  ([`board-view.ts`](../ui/src/app/features/boards/board-view/board-view.ts)). Server `findByProject` already supports
  `assigneeId` + `priority` — **no server work needed**.
- Assignee filter: reuse the exact select used by Create Task (member list from `ProjectRefStore`), extended with `All`
  / `Current user` / `Unassigned` entries. A searchable combobox (Spartan `combobox`/`command`) is available later if
  the member list grows — deferred.
- Priority filter: same select pattern as the tasks-table priority filter.
- Both filters become URL query params (`?assignee=…&priority=…`) bound to `input()`, merged with the existing
  `sprintId` param.

### F-09 NG8102 warning (item 5) — CONFIRMED

[`task-table.html`](../ui/src/app/features/tasks/task-table/task-table.html) line 15: `[value]="searchInput() ?? ''"` —
`searchInput` is a non-nullable `signal<string>`, so `?? ''` is dead code. One-line removal; build must be warning-free
afterwards.

### F-10 Sidebar restructure (items 6–7)

Current first group: tenant-switcher, Projects link, Settings+Members (admin-only). Current second group: static label
"Project".

Target:

- **Group 1 (tenant):** ui-tenant-switcher · Overview · Members · Settings. The Projects link and the
  `/t/:slug/projects` page are removed (Overview already lists projects + Create project). Old URLs get a redirect to
  the tenant overview (bookmarks/deep links stay valid).
- **Group 2 (project):** the static group label becomes a **project-switcher dropdown** modeled 1:1 on
  [`tenant-switcher`](../ui/src/app/shell/tenant-switcher/tenant-switcher.html) (same styles, chevron, active checkmark,
  search comes free later via combobox). Items: Overview · Tasks · Board · Sprints · Members · Project settings · Audit.
- **Collapse/expand:** `hlm-sidebar collapsible="icon"` already supports collapsing and a `hlmSidebarRail` exists in the
  footer, but it is undiscoverable. Add an explicit toggle button (lucidePanelLeftClose / lucidePanelLeftOpen icons) in
  the sidebar footer; collapsed state persisted in `localStorage` (device-local by nature — not a server preference). In
  collapsed mode every item keeps its built-in tooltip; the tenant/project switchers render as icon buttons with
  `lucideChevronDown` that open the same dropdown menus.

### F-11 Mobile navigation (item 8) — research summary

Options considered:

1. **Header hamburger → sidebar as offcanvas sheet** (shadcn/spartan canonical pattern: `hlmSidebarTrigger` in the
   header + Sheet variant below the `md` breakpoint). Pros: standard, zero custom layout math, sidebar content reused
   as-is. Cons: none significant.
2. Always-visible icon-rail on mobile. Cons: eats 48–56 px of a narrow viewport permanently; non-standard.
3. Bottom tab bar. Cons: duplicates IA, big rework, out of scale for this app.

**Decision: option 1** — hamburger button visible below `md`, opening the sidebar as an overlay sheet; collapsed/icon
state irrelevant on mobile. Exact Spartan sidebar mobile API verified during implementation against the component docs.

### F-12 Mobile paddings (item 9)

Double horizontal padding confirmed: shell `<main class="p-6">`
([`app-shell.html`](../ui/src/app/shell/app-shell/app-shell.html)) + page-level `px-6` (e.g.
[`task-table.html`](../ui/src/app/features/tasks/task-table/task-table.html) line 6) = 48 px per side on mobile.

Fix: single source of truth — shell main becomes responsive (`px-3 py-4 sm:p-6`), and pages drop their own horizontal
padding (or use `sm:px-0` where the page template needs the inner container). Target: ≤ 12 px total per side on mobile,
24 px from `sm` up.

### F-13 Mobile horizontal page scroll on Tasks / Audit Log (item 10)

Cause: single-line toolbars (`title + search + filter + columns + New Task` on one flex row) exceed narrow viewports.
Wide tables scrolling horizontally inside their container is acceptable; the **page** must never scroll horizontally.

Fix: toolbars become `flex-wrap` with the search input `w-full sm:w-64`, buttons wrap to a second row; heading block
stacks vertically on mobile; page containers get `min-w-0` so the table container is the only horizontally scrollable
element.

### F-14 Script hygiene (item 11)

- [`start-local.sh`](../start-local.sh) runs `docker start task-board-mongo` — fails on a fresh machine (container not
  created yet) and bypasses the healthcheck/rs.initiate flow. Replace with `docker compose up -d` (idempotent, matches
  README).
- README instructions match current reality (compose replica set, `.dev.vars`, two-terminal dev); no changes needed
  beyond cross-referencing `start-local.sh` as the one-command alternative.
- Root [`package.json`](../package.json) scripts verified current (`dev`/`start` per workspace,
  test/typecheck/lint/build all valid).

### F-15 Tailwind canonical classes (item 12)

Arbitrary-value audit (templates searched): the pixel-bracket classes found are

- `min-w-[2rem]` → `min-w-8` (status-manager, task-type-manager)
- `max-w-[220px]` → `max-w-55` (audit-log-viewer change pills)
- `w-[180px] w-[200px] w-[110px] w-[240px]` → `w-45 w-50 w-27.5→w-28 w-60` (audit table headers; nearest canonical step
  chosen where 110 px has no exact scale value)
- `min-h-[calc(100dvh-var(--header-height))]`, `h-[calc(100dvh-…)]` — **legitimately arbitrary** (calc expressions);
  kept.

Rule going forward: spacing-scale utilities over pixel brackets everywhere except `calc()` expressions; a sweep across
`.html` + inline class strings in `.ts` is part of Q7.

---

## 2. Decisions taken without asking (flag anything you disagree with)

| #    | Decision                                                                                                                                                                                                              |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-40 | Date-range filtering implemented full-stack (shared types → Zod → repo `$gte/$lte` → URL params → popover UI)                                                                                                         |
| D-41 | Header context menu rebuilt on the Spartan `context-menu` component (fixes mouseup bug, removes custom CDK wiring)                                                                                                    |
| D-42 | Middle-click = auxclick handler + `window.open(serializeUrl(createUrlTree(...)))`                                                                                                                                     |
| D-43 | Auto page-size measures real DOM row height instead of the 48 px constant                                                                                                                                             |
| D-44 | Full-height + Auto extracted into shared table infrastructure; applied to Members and Audit tables; their loading spinners removed                                                                                    |
| D-45 | `members.roleProjectAdmin/Editor/Viewer` added in all 11 locales                                                                                                                                                      |
| D-46 | Board gets assignee (All/Me/Unassigned/specific member) + priority filters as URL params; no server changes                                                                                                           |
| D-47 | Sidebar: tenant group = switcher/Overview/Members/Settings; project group headed by a project-switcher dropdown; `/t/:slug/projects` redirects to overview; explicit collapse toggle button persisted in localStorage |
| D-48 | Mobile: hamburger + offcanvas sheet sidebar below `md`; shell owns outer padding (`px-3 py-4 sm:p-6`); toolbars wrap; page-level horizontal scroll eliminated                                                         |
| D-49 | `start-local.sh` uses `docker compose up -d`; NG8102 fixed; pixel-bracket classes replaced with canonical utilities                                                                                                   |

---

## 3. Open questions — ✅ ALL RESOLVED by owner

### RQ-01 — Date filter input style — ✅ **(b) Spartan `date-picker` Helm component**

### RQ-02 — Tooltip migration scope — ✅ **(a) Convert EVERYTHING**, including truncated data cells

### RQ-03 — Mobile sidebar pattern — ✅ **(a) Header hamburger + offcanvas sheet below `md`**

### RQ-04 — Deferred backlog — ✅ **ALL SEVEN pulled into this round**: ① Saved Views ② keyboard

shortcuts ③ bulk actions ④ undo toasts ⑤ density toggle ⑥ WIP counts ⑦ sprint date edit control

Implementation note for ①: the saved-filters backend already exists (full CRUD in
[`routes/filters.ts`](../server/src/routes/filters.ts), `filter.repository/service`, Zod schemas) — Saved Views is a
UI-only feature: save current criteria under a name, list/apply/delete views.

---

## 4. Package breakdown (execution order)

| Pkg     | Scope                  | Items                                                                                                                                           |
| ------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Q1**  | Tasks table core fixes | F-01 date filters (full stack, Spartan date-picker), F-02 context menu, F-03 middle-click, F-04 Auto row measurement, F-09 NG8102               |
| **Q2**  | Members & Audit tables | F-05 shared full-height/Auto infra + spinner removal, F-06 i18n role keys ×11 locales                                                           |
| **Q3**  | Board                  | F-08 assignee/priority filters; RQ-04 #7 sprint date EDIT control                                                                               |
| **Q4**  | Sidebar restructure    | F-10 tenant/project groups, project-switcher, redirect, collapse toggle, Board-after-Tasks order                                                |
| **Q5**  | Tooltips               | F-07 migration — ALL `[title]` → `hlmTooltip` (RQ-02a)                                                                                          |
| **Q6**  | Mobile UX              | F-11 sheet sidebar, F-12 padding consolidation, F-13 toolbar wrapping                                                                           |
| **Q7**  | Housekeeping           | F-14 scripts, F-15 Tailwind sweep                                                                                                               |
| **Q8**  | Saved Views            | RQ-04 ① — save/apply/delete named views on the existing filters backend (UI-only)                                                               |
| **Q9**  | Small UX pack          | RQ-04 ② keyboard shortcuts · ⑤ density toggle · ⑥ WIP counts                                                                                    |
| **Q10** | Bulk actions           | RQ-04 ③ — multi-select in tasks table → bulk status/assignee/sprint (server bulk endpoint + UI)                                                 |
| **Q11** | Undo toasts            | RQ-04 ④ — undo window for destructive actions (delete status/type/label/board)                                                                  |
| **V9**  | Verification round     | Playwright pass over affected surfaces (tasks table, members, audit, board, sidebar states incl. collapsed + mobile viewport, regression smoke) |

Each implementation package ends with the gate: `npm run typecheck && npm test && npm run lint`.

---

## 5. Traceability

User item → finding → package: 1a→F-01→Q1 · 1b→F-02→Q1 · 1c→F-03→Q1 · 1d→F-04→Q1 · 2→F-05/F-06→Q2 · 3→F-07→Q3 ·
4→F-08→Q4 · 5→F-09→Q1 · 6→F-10→Q5 · 7→F-10→Q5 · 8→F-11→Q6 · 9→F-12→Q6 · 10→F-13→Q6 · 11→F-14→Q7 · 12→F-15→Q7.
