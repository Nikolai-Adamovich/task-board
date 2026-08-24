# UI Refactoring Plan — Spartan UI Maximization & Best Practices

**Status:** Ready for execution **Scope:** `ui/` only (Angular 22 + Spartan UI (nova) + Tailwind v4) **Goal:** Maximize
Spartan UI (Brain/Helm) usage, remove duplicated code, enforce fresh Angular/TypeScript/Tailwind/Spartan best practices.

## Review Findings

### What is already good

- Feature-based structure, kebab-case files, no type suffixes; per-component folders ✓
- `input()/output()`, signal-based forms (`@angular/forms/signals`), `@if/@for/@switch` (zero `*ngIf/*ngFor`), no
  `ngClass/ngStyle` ✓
- `inject()` everywhere, `@Service()` for singletons, functional guards/interceptors ✓
- `provideSpartanHlm()` in `app.config.ts`, `components.json` present (nova style), `libs/ui` Helm copy-in layout ✓
- Heavy Spartan usage: `hlmBtn`, `hlmCard`, `hlmBadge`, `hlmAvatar`, `hlmTable`, `hlmDialog`, `hlmSheet`, `hlmSelect`,
  `hlmNativeSelect`, `hlmField`, `hlmInput`, `hlmTextarea`, `hlmSpinner`, `hlmSidebar`, `hlmAccordion`,
  `hlmCollapsible`, `hlmNumberedPagination`, `hlmPopover` ✓
- Lazy `loadComponent` routes (25) ✓

### Gaps (numbered tasks below)

1. Dead custom toast system: `NotificationService` + `ToastContainer` are never invoked (no callers) and use raw
   Tailwind colors + manual `z-50`. Spartan `sonner` (`<hlm-toaster>` + `toast()`) is not installed.
2. Empty states duplicated 11× (`rounded-lg border border-dashed ... py-12 text-center`). Spartan `empty` not installed.
3. Error/success banners duplicated 15× (`rounded-md bg-red-50 p-3 text-sm text-red-700 role="alert"`). Spartan `alert`
   not installed.
4. `getErrorMessage(err)` private method copy-pasted in 12+ components; `error.interceptor.ts` already attaches
   `userMessage` — components re-implement it.
5. `getPriorityColor` / `getStatusBadgeClass` duplicated across `task-detail`, `member-dashboard`, `owner-dashboard`.
   Color constants live in `constants/priority.ts` (misnamed — holds all badge color maps).
6. `tenant-member-list.ts` (536 LOC) and `project-member-list.ts` (398 LOC) duplicate the same table pattern: column
   definitions, sort, per-column filter popover, pagination, invite/add dialog, delete confirm, `getInitials`.
7. Delete-confirmation dialog block duplicated ~15× (title + message + cancel + destructive confirm).
8. `tenant-switcher.html` hand-rolls a dropdown with manual ARIA (`role="listbox"`, `aria-expanded`, manual check icon)
   instead of `dropdown-menu` (already installed).
9. Native `<input type="checkbox">` in `create-task-dialog.html` for label selection → should be `checkbox` (or `select`
   multiple). `<input type="date">` ×2 in `sprint-list.html` → keep native date input styled with `hlmInput`
   (acceptable) or move to `date-picker`.
10. `audit-log-viewer.ts` uses `HlmNumberedPagination` directly while other features use the shared `Pagination` wrapper
    — inconsistent.
11. Raw color palette in templates (`text-green-600`, `bg-red-50`, `bg-blue-100`, `text-orange-600`, `bg-purple-100`…)
    instead of semantic tokens.
12. `bg-surface-50` used in 6 templates but is **not defined anywhere** (no preset/theme token) — classes are inert.
13. `space-y-*` used ~40× in form/section stacks; Spartan styling rule is `gap-*` over `space-*`.
14. Hardcoded English strings: `title="Filters"` in `task-table.html`, `placeholder="Filter by name..."`, `'All Roles'`,
    ColumnDef placeholders in member lists → must be transloco keys.
15. Dialogs without `hlmDialogDescription` (composition rule: dialogs need a description).
16. `app.ts` uses `constructor() { inject(PreferencesStore); }` — replace with field-level `inject()`.
17. No `ChangeDetectionStrategy.OnPush` anywhere; Angular 22 zoneless readiness requires OnPush + signals-only state.
18. `/settings` is a placeholder page — user preferences (theme, zoom, language) belong there via
    `switch`/`tabs`/`select` over `PreferencesStore`.
19. `getInitials` exists only in `tenant-member-list.ts`; `project-member-list` inlines it → shared util.

## Execution Tasks

### T1 — Install missing Spartan components (foundation)

Run via CLI from `ui/`:

```
ng g @spartan-ng/cli:ui --name=sonner
ng g @spartan-ng/cli:ui --name=empty
ng g @spartan-ng/cli:ui --name=alert
ng g @spartan-ng/cli:ui --name=checkbox
ng g @spartan-ng/cli:ui --name=skeleton
ng g @spartan-ng/cli:ui --name=switch
ng g @spartan-ng/cli:ui --name=separator
```

(Verify each against `ng g @spartan-ng/cli:info --json` to skip already-installed ones.)

### T2 — Toast system → Spartan sonner

- Delete `src/app/services/notification.service.ts`, `src/app/shared/toast-container/`.
- Add `<hlm-toaster />` to `app.html` (via `HlmToasterImports`), replace imperative call sites (there are none — wire
  new ones):
  - `error.interceptor.ts`: fire `toast.error(...)` for unexpected errors (keep `userMessage` attachment).
  - Success paths (create/update/delete mutations across clients/stores) fire `toast.success(...)`.
- Keep transloco keys for messages.

### T3 — Shared error + color utilities (de-duplication)

- Create `src/app/shared/utils/error-utils.ts`: `getErrorMessage(err, fallbackKey)` (single implementation).
- Rename `constants/priority.ts` → `shared/utils/status-colors.ts` (or keep path, fix exports): `PriorityColorMap`,
  `StatusColorMap`, `TenantRoleColorMap`, `MemberStatusColorMap`, `TenantStatusColorMap`, `ProjectStatusColorMap`,
  `NeutralColor` + `priorityBadgeClass()`, `statusBadgeClass()` helpers.
- Remove all private `getErrorMessage` copies (12+ files) and `getPriorityColor`/`getStatusBadgeClass` copies
  (task-detail, member-dashboard, owner-dashboard) — import shared helpers. Update specs accordingly.

### T4 — Empty states → `hlm-empty`

Replace all 11 dashed-border blocks with:

```html
<hlm-empty>
  <hlm-empty-header>
    <hlm-empty-media variant="icon"><ng-icon name="lucideTag" /></hlm-empty-media>
    <div hlmEmptyTitle>{{ '...' | transloco }}</div>
  </hlm-empty-header>
  <hlm-empty-content><button hlmBtn ...>Create</button></hlm-empty-content>
</hlm-empty>
```

Files: label-manager, status-manager, task-type-manager, project-list, project-detail, workspace-detail, sprint-list,
audit-log-viewer, member-dashboard, owner-dashboard, sprint-detail. Add transloco keys for empty-state titles.

### T5 — Error/success banners → `hlm-alert`

Replace all `rounded-md bg-red-50 ... role="alert"` blocks with
`<hlm-alert><hlm-alert-title/>…<hlm-alert-description/></hlm-alert>` (destructive variant). Also convert `support.html`
success banner. Remove raw `bg-red-50/text-red-700` usages.

### T6 — Delete-confirmation dialog → shared component

Create `src/app/shared/confirm-dialog/confirm-dialog.ts` (Spartan dialog + `hlmBtn` footer, `input` state, `output`
confirm). Replace the 15 duplicated dialog blocks (filter-panel, label-manager, status-manager, task-type-manager,
task-detail, sprint-detail, tenant-settings, project-detail, project-member-list, tenant-member-list, comment-thread,
task-relationships, board-view…).

### T7 — Tenant switcher → `hlm-dropdown-menu`

Rebuild `tenant-switcher.html` with `hlmDropdownMenu` (trigger `hlmBtn`, items `hlmDropdownMenuItem`, separator +
"Create workspace" footer item). Drop manual ARIA attributes.

### T8 — Remaining form/choice controls

- `create-task-dialog.html`: label selection → `hlmCheckbox` list (or `hlmSelect` multiple).
- Verify `hlmSelect` usage for role selects where a native select is used inline (`tenant-member-list.html`,
  `project-member-list.html` row selects) → convert to `hlmSelect`/`native-select` consistently (native-select is
  acceptable; standardize on one).
- Keep `type="date"` inputs but ensure they use `hlmInput` (they do) — no change unless adopting `date-picker`.

### T9 — Standardize pagination

Use the shared `Pagination` wrapper in `audit-log-viewer.ts` instead of importing `HlmNumberedPagination` directly.

### T10 — Styling cleanup (Spartan rules)

- `space-y-*` → `flex flex-col gap-*` (forms keep `hlm-field` stacking; convert the rest).
- Replace `bg-surface-50` (inert) with `bg-muted/50` (login, register, accept-invitation, create-workspace) and
  `sprint-list.html` header (`bg-muted/40`).
- Raw palette → semantic tokens: `text-green-600` → `text-green-600` only if no token, else use existing `--role-*`
  vars; badges use `variant` + minimal `[class]` overrides from shared color maps; `bg-purple-100 text-purple-700` (role
  OWNER) → `TenantRoleColorMap`/`--role-owner` var; audit-log old/new diff chips → `destructive`/`green` tokens
  consistently.
- `h-6 w-6` → `size-6`, `h-5 w-5` → `size-5` (Spartan `size-*` rule) across templates.
- Remove manual `z-50` on `tenant-switcher` dropdown (handled after T7); header keeps sticky (CDK-free, acceptable).
- Add `hlmDialogDescription` to every `hlmDialogTitle` (transloco keys).

### T11 — i18n hardening

- Add keys for: empty states, `task-table.html` `title="Filters"` (replace with `hlm-tooltip` or `aria-label` from
  transloco), ColumnDef placeholders/selectAllLabels in both member lists, table `actions` column headers.
- Ensure no new hardcoded literals are introduced by T4/T5/T6 (all shared component strings take transloco keys as
  inputs).

### T12 — Member lists de-duplication

Extract shared building blocks into `src/app/shared/member-list/` (or composable):

- `member-columns.ts` — `ColumnDef` type + sort/filter/pagination logic (shared computed factory keyed by entity
  accessor).
- `member-avatar.ts` + `initials` util (from T3).
- Reuse `confirm-dialog` (T6) and shared error util (T3).
- Keep the two feature components (tenant vs project differ in roles/invitations/actions) but reduce each to
  configuration + unique actions.

### T13 — Best-practices polish

- `app.ts`: replace constructor-inject with field `private readonly _preferencesStore = inject(PreferencesStore)`.
- Add `ChangeDetectionStrategy.OnPush` to stateful components once signals-only (verify no direct DOM state reads);
  start with shell (header, sidebar, tenant-switcher) and dashboard views.
- Implement `/settings` page: theme picker (`hlmSelect` over `ThemeRegistry.themes()`), zoom controls (reuse
  `user-menu-zoom-controls` or `slider`/`switch`), language (`hlmSelect`), bound to `PreferencesStore`.
- Run `ng g @spartan-ng/cli:healthcheck --autoFix` from `ui/` after all template changes; fix anything reported.
- Run `ng build` + `ng test` in `ui/` after each task; keep e2e green.

### Ordering & risks

Order: T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8 → T9 → T10 → T11 → T12 → T13. Risks:

- `healthcheck --autoFix` may rewrite Helm imports — run it last, then re-verify.
- T12 is the largest refactor; do T10/T11 first so the member-list work doesn't churn twice.
- Sonner replaces a never-used service — low risk; verify no spec references `NotificationService`.

## Verification (per task)

- `cd ui && npx ng build` — no errors, budgets pass.
- `cd ui && npx ng test --no-watch` — specs updated/added for shared utils.
- Spartan composition rules: semantic colors only, `gap-*`, `size-*`, titles+descriptions on dialogs.
