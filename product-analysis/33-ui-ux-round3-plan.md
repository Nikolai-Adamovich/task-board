# 33 — UI/UX Round 3: Research & Plan

Covers the owner's manual-review feedback after round 2 plus a proactive improvement proposal. Research sources:
[Atlassian Design System — Inline edit](https://atlassian.design/components/inline-edit),
[Jira issue editing docs](https://confluence.atlassian.com/jiracoreserver0902/creating-and-working-with-issues-1168852868.html),
[GitHub Projects — table layout / fields](https://docs.github.com/en/issues/planning-and-tracking-with-projects/customizing-views-in-your-project/customizing-the-table-layout),
[Linear — Display options](https://linear.app/docs/display-options). Registry appended to [sources.md](sources.md).

---

## 1. Research findings

### 1.1 Create/view/edit task — one component (Jira model)

- **Atlassian Design System ships "Inline edit" as a first-class pattern**: a field renders a _readView_; clicking it
  swaps to _editView_ with confirm (✓) / cancel (✕) actions; large text areas use `keepEditViewOpenOnBlur` so accidental
  outside clicks don't discard work. Explicit guidance: "Use inline edit for an editable field that is not part of a
  form."
- **Jira's issue view** is a single screen: every field is inline-editable in place (hover shows a pencil affordance); a
  separate full _Edit dialog_ exists only for fields not shown on the view screen. There is no dedicated "edit mode".
- **Conclusion for us:** one Task page component with three modes is unnecessary — the correct model is **one view
  component where title and description are click-to-edit inline fields** (exactly the Atlassian pattern), and
  side-panel fields remain immediate-apply selects (already implemented). The `Edit` button and the separate edit-mode
  state are removed. The create page (`tasks/new`, U1) already shares this layout and stays as the "empty instance" of
  the same component conceptually.

### 1.2 Column chooser & saved views

- **GitHub Projects**: `View → Fields` checkbox list shows/hides columns; each column header has a kebab menu with _Hide
  field_; fields are reorderable; views themselves are saveable/shareable.
- **Linear**: a single _Display options_ popover (top-right) controls show/hide properties, grouping, ordering; options
  persist personally, with an explicit _Set as default_ for the workspace and _Reset to default_.
- **Conclusion:** the industry-standard control is a **"Fields/Columns" popover** (not a context menu as the primary
  path — but a header right-click shortcut is a nice power-user affordance and costs little). **Saved Views** (named,
  per-user visibility, default view) are a validated next-round feature: GitHub/Linear both treat "view = filters +
  visible fields + order" as the saveable unit. Our existing Saved Filters already cover the filter half; extending the
  saved unit with `visibleColumns` is a natural v2.

### 1.3 Priority display values

`TaskPriorityValues` = `LOW | MEDIUM | HIGH | URGENT` (internal enum values, stored as-is). Display layer must map to
`Low / Medium / High / Urgent` (title-case) everywhere — badges, selects, chips, task header. One shared
`priorityLabel()` helper; no data migration.

### 1.4 Audit log readability (industry norm)

Every tracker renders audit/activity entries with **resolved display names** (Jira: "Name → Name" for status changes;
Linear: human activity strings). UUIDs never appear in user-facing activity. Implementation: resolve ids → names at
render time client-side (statuses/sprints/tasks reference data already loaded) or enrich server-side in the audit query;
client-side is sufficient for MVP scope.

---

## 2. Work packages

### P1 — V4-5 (carry-over, info)

Create-task default-status preselection currently matches by name (`'todo'`) with first-status fallback. Fix: preselect
by `project.defaultStatusId` (id-based, no name matching). Same for default type if applicable. (Delegate reads the V4-5
entry in [31 §6](31-ui-verification-plan.md) for exact wording.)

### P2 — Board DnD empty-column preview

During drag, an empty column must render a **card-sized invisible drop slot at the top** (so the dragged preview appears
inside the column, same as non-empty columns) instead of hiding everything. Keep the dashed drop-zone styling;
placeholder text returns on drag end. (Current behavior hides placeholder + preview entirely — regression of U-01
intent.)

### P3 — Tasks table: title ellipsis + true full-height Auto

- **Title cell**: re-apply hard truncation (`max-w-0` + `truncate` inside the flexible column, or `max-w-[600px]`) so a
  long title can never widen the table → no horizontal scroll (owner screenshot 03). Tooltip already present.
- **Auto height**: make the tasks page a flex column of exactly viewport height (`h-[calc(100dvh-<header>)]`); the table
  body area becomes `flex-1` and Auto computes rows from the _measured_ container height (ResizeObserver on the table
  wrapper instead of window math) — table bottom aligns with the page bottom, no dead space below, no page scroll.

### P4 — Column chooser (visibility only; saved Views = research, next round)

- Toolbar: table/columns icon button next to New Task + Filter → `dialog-md` popover with checkbox list of columns (Key,
  Title, Type, Status, Priority, Assignee, Reporter, Sprint, Labels, Created, Updated).
- Power affordance: right-click on any header → context menu with "Select columns…" (same popover) and "Hide this
  column".
- Persistence: visible-column set stored per user+project (extend the existing user-preferences document; URL param
  optional `cols=` omitted for MVP).
- Key and Title columns cannot be hidden (identity anchors).
- **Saved Views research (deferred — do not implement):** extend the saved unit from "filters + sort" to "filters +
  sort + visibleColumns + columnOrder + pageSize". Storage reuses the Saved Filter collection with a `view` payload;
  sharing model per [31] conventions: default view per project (admin-manageable) + personal views; Linear's _Set as
  default / Reset to default_ wording recommended. Estimated: 1 package (server payload + chooser integration +
  management UI).

### P5 — Task page: click-to-edit + field fixes

- Remove the `Edit` button and edit-mode state; title and description become Atlassian-style inline-edit fields (click →
  editView; ✓/✕ actions; `keepEditViewOpenOnBlur` for description). Side-panel selects stay immediate-apply.
- **Priority display**: title-case everywhere via shared `priorityLabel()` (fixes `MEDIUM` in header badge, dropdowns,
  table badges, chips).
- **Labels editable on task detail**: the side-panel Labels section gets the same autocomplete/add flow as the create
  page (currently read-only there — bug).
- **Long-title header layout**: key (`PROJ-6`) gets `whitespace-nowrap` (never wraps); title `break-words line-clamp-2`
  with slightly smaller font; priority badge moves to its own row under the title (per owner suggestion); no Edit
  button.
- Header meta row (Created/Updated) stays.

### P6 — Auth pages vertical scroll

`/login` and `/register` scroll despite fitting: the page container is `min-h-screen` while the fixed/sticky header adds
height (100vh + header > viewport). Fix: `min-h-[calc(100dvh-4rem)]` (or measure header) on auth layout containers;
verify at 1440×900 and 768 heights.

### P7 — Audit log as a real table + human-readable refs

- Rebuild `audit-log-viewer` as a table: Time · Actor · Action · Entity · Changes · (entity link). Sortable by time
  (default desc), filterable by action/entity/actor, paginated (reuse `page-wide` + pagination component).
- **Human-readable entity refs**: `SPRINT <uuid>` → sprint name; `TASK <uuid>` → `PROJ-123`; status diffs
  `statusId: <uuid> → <uuid>` → `To Do → In Progress`. Resolve via reference data client-side (statuses/sprints loaded;
  tasks resolved by number lookup or server enrichment — prefer server enrichment in the audit query response: add
  `entityLabel` + pre-resolved change values, one join per page).
- Global sweep: no raw UUIDs in any user-facing list (labels/statuses/types already named).
- Fix `lucideHistory` icon vertical alignment with the "Audit Log" heading.

### P8 — Date/time format preference

- Settings gains a Date format select (`DD/MM/YYYY`, `MM/DD/YYYY`, `YYYY-MM-DD`) and Time format (`24h`, `12h`),
  persisted in user preferences (server field + UI store).
- All date/time rendering goes through one shared `formatDate()`/`formatDateTime()` helper reading the preference
  (Angular DatePipe with constructed format tokens); audit table, tables, task detail, overview, sprints all switch.

### P9 — Cursor pointer globally

- Add `cursor-pointer` to the interactive Spartan primitives in `ui/libs/ui` (button, select trigger, dropdown-menu
  item, tabs, pagination items, popover triggers, checkbox/radio/switch) so every clickable element shows the pointer
  without per-page fixes; sweep for elements using `(click)` on non-button elements and convert to buttons or add the
  class.

### P10 — Additional improvements proposed (owner review before scheduling)

1. **Keyboard shortcuts**: `c` = new task, `/` = focus search, `j/k` navigation on table/board (Linear-parity; cheap
   after U-rounds).
2. **Board card context menu**: quick assign/priority/label without opening the task.
3. **Bulk actions** on the tasks table (multi-select → move status/assignee) — roadmap item, bigger.
4. **Toasts with undo** for destructive-lite actions (label remove, task delete within a session).
5. **Table density toggle** (comfortable/compact) persisted with preferences.
6. **Empty-state illustrations** consistency pass.
7. **`aria-live` announcements** for async saves on task detail (a11y polish).
8. **Board WIP counts coloring** when over an (optional) limit — pairs with the deferred WIP feature.

## 3. Execution order

P1+P2+P3 (small, one agent) → P5 (task page, one agent) → P4 (column chooser) → P7 (audit table) → P6+P8+P9 (small
batch) → V7 verification round (functional + visual re-shoot of affected pages) → fix round → V8 if needed.

## 4. Questions

None blocking. Two defaults chosen (override if desired):

- **D-1**: Priority display = `Low / Medium / High / Urgent` (title-case), internal enum values unchanged.
- **D-2**: Saved Views deferred to the next round (research in §1.2/P4); this round ships column visibility only.
