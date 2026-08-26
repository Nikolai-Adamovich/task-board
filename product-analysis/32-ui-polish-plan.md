# 32 — UI Polish & Robustness Plan (round 2)

Incorporates the product owner's manual-review feedback and prepares the iterative verify→fix cycle. Supersedes the
relevant open items in [31-ui-verification-plan.md](31-ui-verification-plan.md) §8 (P1 polish tier); P0 correctness
items from §8 remain in force and are folded into U-packages where related.

Corrections to the defect log:

- **V1-6 partially retracted**: drag-and-drop between columns **works** (verified manually by the owner, incl.
  multi-status prompt on column 1). Remaining valid part → **U-01** (empty-column placeholder UX during drag).

---

## Design tokens (layout system, applied globally in U-02)

| Token                    | Value                                 | Applies to                                            |
| ------------------------ | ------------------------------------- | ----------------------------------------------------- |
| `page-content`           | `max-w-6xl` (72rem), centered, `px-6` | dashboards, overview, settings, sprints, detail pages |
| `page-wide`              | full width minus `px-6` (no max)      | tasks table, members tables, audit table              |
| `form-narrow`            | `max-w-md` (28rem)                    | login/register/forgot/reset, small dialogs            |
| `form-wide`              | `max-w-2xl` (42rem)                   | create/edit entity forms, settings forms              |
| `dialog-md`              | `sm:max-w-lg`                         | standard dialogs                                      |
| Row height (tasks table) | fixed 48px                            | enables Auto page-size math                           |

Rule: every form field container uses one of the two form tokens — no per-form ad-hoc widths. Every list/table page uses
`page-wide`; every reading/config page uses `page-content`.

## Work packages

### U1 — Unified Create-Task experience (replaces both dialogs)

Decision: Jira-style — creating a task uses the same layout as viewing one.

- New route `…/tasks/new` (registered **before** `tasks/:taskNumber`) rendering the task page in **create mode**: same
  layout as task detail (title, Milkdown description, side-panel fields Status[default
  TODO]/Priority/Type/Assignee/Sprint/Labels), Create button → POST → navigate to `tasks/:taskNumber`.
- Delete `CreateTaskDialog` and both usages (board "+ New Task", tasks table "New Task"); buttons navigate to
  `tasks/new`.
- Remove the now-dead dialog code/specs/i18n keys; add create-mode specs.

### U2 — Global layout & form width system

- Apply the token table above across all pages (audit each route).
- Standardize all dialogs to `dialog-md` (exceptions: none for now).
- Fix DR-3 task-detail proportions: main column flexible within `page-content`, side panel compact (fields grouped in
  ONE card, no per-field card chrome).
- Fix DR-7 (header clipping on no-shell wizard pages), DR-8 (My-Tasks empty state component), DR-5 (zero-count statuses
  shown; verify hover-only tints), DR-6 (Backlog group header is the link, no nested row).

### U3 — Tasks table upgrades

- `table-layout: fixed` with explicit column widths (Key 90px, Type 90, Status 130, Priority 100, Sprint 120,
  Assignee/Reporter 150, Labels 160, Created/Updated 110, Title flexible) → no width jumping on sort/data changes; long
  content ellipsized with `title` tooltip.
- Table fills `page-wide`; **fixed body height**: `min-height` for N rows so a short last page doesn't collapse the
  layout (pagination stays put).
- Page-size selector gains **Auto**: computes rows = floor(availableViewportHeight / rowHeight) clamped [5..100],
  recomputed on window resize; persisted in preferences like other sizes.

### U4 — Shared member table + Edit action

- Extract/extend `shared/member-list/member-table` into one configurable component used by BOTH tenant members and
  project members pages: columns User (avatar+name), Email, Role, [tenant: Access/Invitation status], Actions.
- Actions: **Edit** (inline role select or small dialog) + **Remove** (confirm dialog); tenant variant adds
  Resend/Revoke for pending invitations.
- Fix V2-1/V1-10 (`tenants/undefined`) while touching these pages.

### U5 — Board DnD empty-column UX (U-01) + status display names (DR-1)

- During an active drag, hide "No tasks in this column" placeholders (empty column shows a subtle drop zone instead);
  dragged card previews at drop position; on drop lands at top.
- Replace all raw status enum keys with human display names from the Status `name` field (board headers, overview
  summary, table badges, task-detail select, filter options) — DR-1; show zero-count statuses in overview summary
  (DR-5).

### U6 — P0 correctness batch (from 31 §8)

V2-4 project RBAC enforcement in production middleware (critical), V1-3 `?limit=NaN` + stale list after create, V2-2
invitee-without-password flow, V2-3 decline HTTP method + error toast, V2-7 revoke/restore route mismatches, V1-8
wrong-password error copy, V1-7 sprint-completion disposition dialog, V2-8 stale alert, V2-9 overview task links 404,
V2-10 role-gated controls rendered to unauthorized roles, V1-1/V3-2/V3-4/V3-5 missing i18n keys & back-links, V3-7
preferences route naming.

## Verification round V4 (after U1–U6) — robustness QA (real-QA style)

New scenarios appended to the plan (executed by verification agents, then I review):

- **R-1 Length limits**: 255-char title, 48-char slug, max-length email local part, 2000+ char description, 1000-char
  comment — verify server caps, UI does not break (ellipsis/`show more`), forms enforce maxlength.
- **R-2 Pathological strings**: titles/names/emails with no spaces (`aaaa…`), emoji, RTL text (عربي), CJK, HTML/script
  injection (`<script>alert(1)</script>`, `"><img src=x onerror=…>`) in title/description/comment/label/slug — verify
  sanitization, no layout blowout, no XSS.
- **R-3 Special characters**: leading/trailing spaces (trimmed?), quotes, backslashes, newlines in title; unicode in
  slug attempt; label names differing only by case/whitespace.
- **R-4 Table stress**: 100+ tasks — pagination, Auto page-size, sort stability, filter chips, fixed row height.
- **R-5 Concurrent edit**: two contexts editing one task → conflict dialog appears (V2-style session alternation).
- **R-6 Regression**: re-run 31 §3 scenarios S-A/S-B/S-G smoke + previously failing defects marked fixed.

## Cycle

U1→U2→U3→U4→U5→U6 (implementation, delegated) → **V4** (verification, delegated) → consolidate → fix round → **V5**
re-verify → repeat until defect log is clean (P0/P1 empty; P2 may remain deferred).
