# 08 — Screen & Page Specification

Behavior-level spec (not pixel design). Common conventions for every screen:

- **Loading:** skeleton/spinner distinct from content; never render "empty" during load.
- **Empty:** friendly message + primary CTA (examples in
  [20-error-empty-loading-states.md](20-error-empty-loading-states.md)).
- **Error:** human-readable message + retry; raw exceptions never shown.
- **Forbidden:** explanation ("You no longer have access…") + navigation out; not a blank 403.
- **Not found:** neutral message that does not leak existence of resources.
- **Archived/read-only banner** wherever applicable.
- **Permissions:** write controls hidden for Viewer; disabled-with-reason where hiding would confuse (e.g., archived
  project).

---

## S1 Landing (public)

- **Purpose:** route to Sign Up / Log In.
- **Entry:** logged-out root URL. **Actions:** sign up, log in.
- **States:** standard. **Navigation:** auth screens.

## S2 Register / S3 Login / S4 Password reset

- **Purpose:** account lifecycle entry points.
- **Components:** forms with inline validation; login shows forgot-password + register links.
- **Validation:** email format/normalization, password policy, confirm-password match (register).
- **Errors:** wrong credentials (neutral wording), unknown reset email (same response as known — anti-enumeration).
- **Navigation:** post-login routing per [07-user-flows.md](07-user-flows.md) flow 2.

## S5 Onboarding — Create first Tenant (+ mock checkout)

- **Purpose:** time-to-workspace < 2 minutes.
- **Steps:** workspace name → plan (Free $0) → mock checkout → confirmation.
- **Permissions:** any authenticated user without accessible Tenant.
- **States:** loading during creation; error retries at each step.
- **Navigation:** success → Tenant dashboard.

## S6 Tenant dashboard (home)

- **Purpose:** organizational entry point.
- **Visible:** tenant name, projects grid/list (name, key, status badge), Create Project CTA, Members link, Settings
  link, Plan/Billing link, profile menu.
- **Empty state:** "No projects yet. Create your first project."
- **Permissions:** read for members; admin actions per matrix.
- **Navigation:** project pages, members, settings.

## S7 Tenant Members

- **Purpose:** manage tenant-level people and invitations.
- **Visible:** member list (display name, email, role, access status), pending invitations (email, role, invitedBy,
  invitedOn, expiry derived), Invite button.
- **Actions (Owner/TAdmin):** invite, resend, revoke invitation, change roles, restore access, remove member; ownership
  transfer (explicit operation).
- **States:** loading/empty/error standard; expired invitations rendered as EXPIRED dynamically.
- **Navigation:** stays in place; toasts confirm actions.

## S8 Tenant Settings (+ Danger Zone)

- General (rename), Plan/Billing (mock), Danger Zone (archive tenant; delete tenant with grace period + typed
  confirmation).

## S9 Project Overview

- **Purpose:** useful landing page, not a duplicate of other features.
- **Visible:** name/key/description, active sprint summary, task counts by status, recent tasks, members preview,
  shortcuts to Board/Tasks/Sprints.
- **Empty:** "No tasks yet" + Create Task CTA.
- **Archived:** read-only banner; write controls disabled.

## S10 Board view

- **Purpose:** visual workflow of Tasks.
- **Visible:** board selector (user preference persisted), optional sprint filter selector, columns (each may group
  multiple statuses) with counts, cards (key, title, type icon, priority, assignee avatar, labels).
- **Actions:** open card/task; drag between columns (Editor+): single-status column applies directly, multi-status
  prompts choice; keyboard move path recommended ([13-board-and-kanban-analysis.md](13-board-and-kanban-analysis.md)).
- **States:** loading skeletons per column; empty column shows nothing special; empty board shows guidance; invalid
  column refs hidden on view.
- **Permissions:** Viewers see board without drag affordances.
- **Performance:** cards fetched per column with limits + "load more" (see
  [15-search-filter-pagination.md](15-search-filter-pagination.md) §6).

## S11 Tasks table

- **Purpose:** searchable/filterable/sortable/paginated list.
- **Columns:** Key, Title, Type, Status, Priority, Assignee, Reporter, Sprint, Labels, Created, Updated.
- **URL state:** `?page=&limit=&sort=&<filters>` fully reproducible; invalid page snaps to nearest valid.
- **Filters:** status/type/priority/assignee/reporter/sprint/label + free text; combinable; saveable per user/project.
- **Row action:** open task. Bulk edit deferred.
- **Pagination UX:** prev/next + numbered pages + page-size selector (30/page default, max 100).

## S12 Task detail (`/tasks/:taskId`)

- **Purpose:** the work item's home.
- **Layout areas:** header (key, type icon, title inline-editable), side panel fields (Status, Priority, Assignee,
  Reporter, Sprint, Labels — each inline-editable Editor+), Description (Milkdown WYSIWYG ⇄ markdown), Relationships
  section, Comments section, History/activity tab.
- **Actions:** save per field with version; delete task (PAdmin+, confirm dialog enumerating cascade); add/remove
  relationships (same-project picker); comment add/edit/delete.
- **Conflict state:** dedicated non-destructive resolution UI ([12-task-workflow.md](12-task-workflow.md) §8).
- **Not found / forbidden:** correct neutral states.
- **Archived project:** fully read-only rendering.

## S13 Sprints page

- **Groups:** Backlog (sprintId=null tasks) | Future | Active | Completed.
- **Sprint card:** name, dates or "no dates", status badge, task count, actions (Start / Complete / Edit / Delete per
  role & state).
- **Complete dialog:** unfinished-task disposition choice (Backlog / future sprint).
- **Empty:** "No sprints yet. Create a future sprint to start planning."

## S14 Project Members

- Same structure as S7 scoped to project; roles PROJECT_ADMIN/EDITOR/VIEWER; removal keeps tenant membership (copy
  explains this).

## S15 Project Settings

- **General:** name, description, key (editable until first task — after which field locks with explanation).
- **Task Types:** list (key immutable, name editable), rename/delete with usage-aware replacement flow.
- **Statuses:** list ordered; create/edit/delete with the mandatory-replacement flow
  ([07-user-flows.md](07-user-flows.md) flow 21).
- **Labels:** list, rename/delete (delete detaches associations).
- **Boards:** list, create/edit columns (drag ordering, multi-status assignment), invalid references marked red; delete
  board (tasks unaffected).
- **Danger Zone:** archive / delete with grace period.

## S16 Invitation landing (`/invite/:token`)

- **Purpose:** validate and accept.
- **States:** valid-pending (shows inviter, target, role, Accept button), expired, revoked, declined, already-accepted,
  invalid token — each with distinct copy and safe next steps
  ([16-invitation-and-membership-flows.md](16-invitation-and-membership-flows.md)).
- **Security:** no tenant details revealed beyond what a pending invitee may see.

## S17 Access-blocked screens

- Revoked access: "Your access to \<X\> has expired." Restored: "…has been restored." Archived project: read-only
  banner. Deletion pending: notice with grace-period info for admins.

## S18 Activity / History (task-level tab; tenant/project audit for admins)

- Reverse-chronological events: verb, actor display name (snapshot), field diffs old→new, timestamp. Filter by
  actor/action/time (admin views). See [19-audit-and-history.md](19-audit-and-history.md).
