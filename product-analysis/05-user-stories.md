# 05 — User Stories

Format: _As a [persona], I want [capability], so that [benefit]._ Acceptance criteria are testable statements. Roles
referenced: Owner (Tenant Owner), TAdmin (Tenant Admin), PAdmin (Project Admin), Editor, Viewer. Trace IDs link to
[27-traceability-matrix.md](27-traceability-matrix.md).

---

## A. Authentication & Account

### US-AUTH-01 Registration

**As a** visitor, **I want** to register with email/password/display name, **so that** I can create or join workspaces.

- Email is normalized (lowercased) and unique; duplicates get a validation error.
- Password policy enforced client- and server-side; confirm-password checked client-side.
- After registration the user lands in onboarding (no Tenant) or their last-used Tenant.

### US-AUTH-02 Login routing

**As a** returning user, **I want** login to take me to the right place, so that I don't navigate manually.

- No Tenant → onboarding. One accessible Tenant → that Tenant. Multiple → selector or last-selected.
- Session failure clears local auth state, preserves a safe return URL, redirects to login once (no retry loop).

### US-AUTH-03 Password reset

**As a** user who forgot my password, **I want** an email-based reset flow, so that I can regain access.

- Reset links use single-use expiring tokens; requesting a reset for an unknown email returns the same neutral response
  (no enumeration).

### US-AUTH-04 Logout

**As a** user, **I want** logout to end my session everywhere in the app state, so that private data isn't reachable
from stale UI.

## B. Onboarding

### US-ONB-01 First Tenant creation

**As a** new user with no Tenant, **I want** a guided "create your first workspace" screen, so that I reach a usable
workspace quickly.

- Only required input: workspace name.
- On success I become Tenant Owner and land on the Tenant dashboard.

### US-ONB-02 Mock checkout

**As a** first-time Tenant creator, **I want** a plan-selection + mock checkout step, so that the future real billing
flow slots in without redesigning onboarding.

- Free plan shown as $0; no real payment data collected; billing boundary isolated from domain logic.
- Skipping is not possible on first run (journey integrity), but takes <30 seconds.

## C. Tenant management

### US-TEN-01 Manage Tenant settings

**As** Owner/TAdmin, **I want** to rename and administer the Tenant, so that it reflects the organization.

### US-TEN-02 Archive Tenant

**As** Owner/TAdmin, **I want** archiving to cascade read-only state to all Projects, so that history is preserved
safely.

- Projects archived due to Tenant archive carry `archiveReason = TENANT_ARCHIVE` and are restored with the Tenant;
  independently archived Projects stay archived.

### US-TEN-03 Delete Tenant with grace period

**As** Owner, **I want** deletion to be scheduled (DELETION_PENDING) and cancellable, so that mistakes are recoverable
during the grace period.

## D. Project management

### US-PRJ-01 Create Project with automatic seed

**As** any admin-capable role, **I want** creating a Project to instantly give me types TASK/BUG/STORY, statuses
TODO/IN_PROGRESS/IN_REVIEW/REOPENED/DONE, default status TODO, and the default Board (TODO+REOPENED | IN_PROGRESS |
IN_REVIEW | DONE), so that I can create tasks immediately.

- Initialization is atomic; a partially initialized Project is never visible.
- Project key validated (2–10 chars, letter-first, A–Z0–9), unique per Tenant, immutable after first Task.

### US-PRJ-02 Edit Project

**As** PAdmin+, **I want** to edit name/description/key (pre-first-task), so that I can correct early mistakes.

### US-PRJ-03 Archive Project

**As** PAdmin+, **I want** to archive a Project making it read-only but fully readable, so that history is preserved
instead of deleted.

### US-PRJ-04 Delete Project with grace period

**As** PAdmin+, **I want** deletion to require explicit confirmation (typing key/name), enter DELETION_PENDING, remain
cancellable, then permanently remove the aggregate, so that destructive intent is deliberate.

## E. Tasks

### US-TSK-01 Create Task

**As** Editor+, **I want** to create a Task with title (+ optional
description/type/status/priority/assignee/sprint/labels), so that work is captured fast.

- Status defaults to Project default (TODO); another status selectable at creation.
- Task gets next sequential number (`PROJ-n`); key+number shown everywhere.

### US-TSK-02 Inline field editing

**As** Editor+, **I want** to edit each field independently with save, so that editing is quick and predictable
(Jira-style).

- Each save sends the observed `version`; conflicts surface a non-destructive resolution UI, never silent overwrite.

### US-TSK-03 Markdown description

**As** Editor+, **I want** a WYSIWYG (Milkdown) editor storing Markdown, so that rich descriptions need no HTML
knowledge.

### US-TSK-04 Move Task on Board

**As** Editor+, **I want** drag-and-drop between columns to change Status, so that the board reflects reality.

- Multi-status destination column prompts for the intended status; never guesses.
- Optimistic move with rollback + toast on failure.

### US-TSK-05 Assign Sprint

**As** Editor+, **I want** to put a Task into a Sprint or back to Backlog, so that planning works.

- Backlog = no sprint; removing a Sprint returns its Tasks to Backlog automatically.

### US-TSK-06 Delete Task

**As** PAdmin+, **I want** hard delete with confirmation, cascading comments/relationships/label-links, preceded by an
audit event, so that cleanup is possible but deliberate.

### US-TSK-07 Relationships

**As** Editor+, **I want** BLOCKS / RELATES_TO / DUPLICATES links between same-Project Tasks, so that dependencies are
traceable.

## F. Comments

### US-CMT-01 Comment on Task

**As** Editor+, **I want** to add Markdown comments showing author display name, so that discussion stays on the task.

### US-CMT-02 Edit/delete own-or-permitted comments

**As** Editor+, **I want** to edit/delete comments per permission rules, so that mistakes are fixable.

### US-CMT-03 Historical authorship

**As** any reader, **I want** comment authors to remain named after the author's User is deleted, so that history stays
understandable.

## G. Labels

### US-LBL-01 Reuse case-insensitively

**As** Editor+, **I want** typing "bug" when "Bug" exists to select the existing Label, so that duplicates never appear.

### US-LBL-02 Create-on-the-fly

**As** Editor+, **I want** new labels created from the task editor added to the Project's label list, so that they're
reusable.

### US-LBL-03 Delete Label

**As** PAdmin+, **I want** deleting a Label to remove its task associations without touching Tasks, so that cleanup is
safe.

## H. Boards

### US-BRD-01 View Board

**As** any member, **I want** the Board showing Tasks grouped by column (multi-status columns supported), so that flow
is visible.

### US-BRD-02 Per-user Board preference

**As** any member, **I want** my selected Board remembered per Project without affecting others, so that personal
workflows stick.

### US-BRD-03 Sprint Board scoping

**As** any member, **I want** a Sprint Board opened for Sprint X to show only Tasks with sprintId = X, so that focus is
maintained.

### US-BRD-04 Invalid column handling

**As** any member, **I want** columns referencing deleted statuses to be hidden on view but flagged red in the editor,
so that misconfiguration is visible and repairable.

## I. Sprints

### US-SPR-01 Create future Sprint (dates optional)

**As** PAdmin+, **I want** Sprints with no dates / startDate / endDate / both, so that planning flexibility matches
reality.

### US-SPR-02 Start Sprint

**As** PAdmin+, **I want** Start to set ACTIVE and fill missing startDate with now (preserving configured dates), so
that starting is one action.

### US-SPR-03 Complete Sprint

**As** PAdmin+, **I want** Complete to set COMPLETED and fill missing endDate with now, plus an explicit choice for
unfinished Tasks (move to Backlog / future Sprint), so that completion is honest and manual.

- endDate passing never auto-completes (final decision).

### US-SPR-04 Reopen Sprint

**As** PAdmin+, **I want** COMPLETED → ACTIVE allowed, so that mistakes are recoverable.

### US-SPR-05 Delete Sprint

**As** PAdmin+, **I want** deleting a Sprint to null its Tasks' sprintId (back to Backlog) without deleting Tasks.

## J. Members & Invitations

### US-MEM-01 Invite by email

**As** admin-capable role, **I want** to invite an email with an explicit role, so that access is granted deliberately.

- Invitation starts PENDING; email contains inviter name, target, role, expiry; single-use token (hash stored).

### US-MEM-02 Accept invitation

**As** invitee, **I want** to accept via link whether or not I have an account, so that joining has no dead ends.

- Existing users log in with the invited email; new users register pre-filled; acceptance activates membership and
  clears invitation data.

### US-MEM-03 Resend invitation

**As** admin-capable role, **I want** resend to invalidate the old link, refresh invitedBy/invitedOn, and send a new
email, so that stale links can't be used.

### US-MEM-04 Decline / Revoke

**As** invitee/admin, **I want** decline and revoke states with clear messaging on later link visits.

### US-MEM-05 Derived expiration

**As** the system, expiration = invitedOn + TTL evaluated dynamically; expired invitations behave as EXPIRED even
without a background job.

### US-MEM-06 Revoke & restore access

**As** admin-capable role, **I want** to revoke active access (user sees "Your access … has expired") and restore it
("…has been restored"), so that temporary absence is handled without deleting history.

- Pending invitations can never be force-converted to ACTIVE; acceptance is always explicit.

### US-MEM-07 Remove from Project (keep in Tenant)

**As** PAdmin+, **I want** removal to preserve Tenant membership and all historical Tasks/Comments, re-addable later
with history intact.

## K. Permissions & visibility

### US-PRM-01 Role-appropriate UI

**As** any user, **I want** write controls hidden/disabled per my role, so that the UI tells the truth.

### US-PRM-02 Server-side enforcement

**As** the system, every mutation re-checks membership, role, entity scope, and archived/read-only state server-side.

## L. Search, filters, pagination

### US-SRCH-01 Filter & sort Tasks

**As** any member, **I want** combined filters (status/type/priority/assignee/reporter/sprint/label) + free text +
sorting, so that I find work fast.

### US-SRCH-02 URL-addressable table state

**As** any member, **I want** `?page=&limit=&sort=&filters=` reproducible from the URL, so that views are
shareable/bookmarkable.

### US-SRCH-03 Saved filters

**As** any member, **I want** named per-user/per-Project saved filters, so that recurring queries are one click.

### US-SRCH-04 Historical name search

**As** any member, **I want** searching "John Doe" to find Tasks assigned/reported by John even after his User was
deleted, so that history remains queryable.

## M. Notifications & activity

### US-NOT-01 Access-event messages

**As** a user, **I want** clear feedback for invitation sent/accepted/expired, access revoked/restored, so that access
changes are never mysterious.

### US-NOT-02 Operation feedback

**As** a user, **I want** success/error toasts on CRUD actions with human-readable error messages (e.g., version
conflict guidance).

## N. Audit & history

### US-AUD-01 Task activity history

**As** any member, **I want** a per-task change history (field diffs, actor names), so that "what happened here?" is
answerable.

### US-AUD-02 Administrative audit

**As** Owner/TAdmin, **I want** membership/invitation/config changes recorded with actor snapshots, so that
administration is accountable.
