# Decision Log

Decisions made during this analysis. Existing product decisions are recorded as **CONFIRMED** (research found no serious
contradiction). New recommendations are marked. Nothing was silently changed.

---

**DEC-001 — CONFIRMED — MongoDB as persistence** Decision: keep MongoDB. Reason: fixed product decision; no research
contradiction (documented indexes cover MVP query patterns; Atlas Search is the known scaling path). Alternatives:
Postgres (rejected — out of scope). Evidence: [REQ]; issue-tracker design literature shows either store works at this
scale. Consequences: snapshot-denormalization strategy for historical search; transactions only where topology supports.

**DEC-002 — CONFIRMED — Status ≠ Board Column; multi-status columns** Decision: columns group statuses; drag into
multi-status column prompts. Reason: resolves a documented Jira pain (status/column coupling complaint on HN).
Consequences: board move UX needs status chooser; backend stores Status only.

**DEC-003 — CONFIRMED — Backlog = `sprintId = null`, not an entity** Reason: avoids artificial entity; matches "no
unnecessary entities" principle. Consequences: Sprints page renders Backlog as a virtual group.

**DEC-004 — CONFIRMED — Boards are Project views; selected board is per-user preference** Evidence: GitHub Projects'
saved-view model validates it. Consequences: preference document per (user, project).

**DEC-005 — CONFIRMED — Sprint transitions unrestricted; endDate never auto-completes** Note: research shows industry
leans manual for completion (Jira) or policy-driven auto-roll (Linear); our manual-only choice stays. Added UI
mitigations instead of rule changes:

- RECOMMENDATION (new): overdue indicator on ACTIVE sprints past endDate (visual only).
- RECOMMENDATION (new): warning banner when >1 sprint ACTIVE simultaneously (OQ-003).

**DEC-006 — NEW — Completion dialog for unfinished tasks (BR-031)** Decision: completing a sprint with unfinished tasks
prompts disposition (Backlog default / chosen future sprint). Reason: Jira's documented flow prevents the "hidden WIP in
completed sprints" anti-pattern ([Scrum.org](https://www.scrum.org/resources/blog/dont-leave-old-sprints-open));
requirements were silent on unfinished tasks. Alternatives: silent leave-in-place (rejected — hides work), auto-move to
backlog (rejected — violates explicit-over-inferred). Consequences: completion becomes two-step when unfinished work
exists.

**DEC-007 — NEW — Default-status deletion protection (BR-018)** Decision: deleting the current default Status requires
choosing a replacement that becomes the new default; last remaining status cannot be deleted. Reason: requirements imply
every Project always has a default Status; without this rule the invariant can break. Consequences: status deletion flow
has an extra guard branch.

**DEC-008 — NEW — Default-board deletion protection (BR-023 second clause)** Decision: cannot delete the Project's
default Board without promoting another board first. Reason: `Project.defaultBoardId` must not dangle. Consequences:
board deletion service checks default reference.

**DEC-009 — NEW — Optimistic concurrency with field-level three-way merge preference** Decision: version check
mandatory; non-overlapping field changes in multi-field patches may merge server-side; overlapping fields raise conflict
UI (keep mine / take theirs / cancel). Reason: [REQ §34] prefers three-way merge; GitLab applies optimistic locking
where loss hurts; HN criticism of Linear shows silent overwrites destroy trust. Consequences: conflict resolution UI
component required.

**DEC-010 — NEW — Invitation TTL = 7 days (derived)** Decision: recommended constant. Reason: industry default per
multiple invitation-UX sources; derivation mechanism already fixed. Consequences: config constant; email copy states
expiry.

**DEC-011 — NEW — Not-found vs forbidden distinction** Decision: out-of-scope resources render NOT_FOUND;
in-scope-but-role-insufficient render FORBIDDEN. Reason: existence-hiding prevents information leakage. Consequences:
API and UI error mapping rules (doc 20 §5).

**DEC-012 — NEW — Board cards load per-column windows with counts** Decision: first ~50 cards per column + total count +
"show more"; global pagination reserved for tables. Reason: per-column cursor/window loading is the established pattern
for boards ([sujeet.pro design article]). Consequences: board query shape differs from table queries; indexes shared.

**DEC-013 — DEFERRED DECISION — Card ordering within board columns** Decision: MVP orders by number/updated; fractional
rank (LexoRank-style) deferred to roadmap. Reason: ordering persistence adds write-path complexity not needed for the
core loop; upgrade path documented. Consequences: none now; rank field later.

**DEC-014 — NEW — Notifications excluded from MVP; activity feed included** Reason: notification fatigue is a documented
top complaint; task-level activity answers "what happened" locally at low cost. Consequences: audit events double as
activity feed source.

**DEC-015 — NEW — WIP limits, swimlanes, velocity/burndown deferred** Reason: depend on process discipline most early
teams lack; model leaves room (column metadata, audit data). Consequences: roadmap tiers in doc 24.

## RECOMMENDED CHANGES to existing decisions

None required. All fixed decisions survived research review. Two softening _affordances_ were added around them (DEC-005
mitigations) without changing any rule.

---

# Implementation-alignment decisions (gap analysis, [28-implementation-gap-analysis.md](28-implementation-gap-analysis.md))

Status: **ADOPTED** — confirmed by the product owner after reviewing the codebase comparison.

**DEC-016 — Sprint start fills only startDate** Decision: transitioning a sprint to ACTIVE sets `startDate = now` only
when startDate is null; endDate is never modified on start. Reason: pre-filling endDate distorts sprint date ranges and
contradicted the fixed decision. Consequences: `sprint.service.ts` rework + tests.

**DEC-017 — Per-action project authorization** Decision: remove the router-level `requirePermission('create_project')`
gate from the projects router; enforce per-action checks so Members/Editors/Viewers can read. Reason: the gate blocked
all non-admin reads, killing the Viewer concept. Consequences: audit every projects route for per-action enforcement.

**DEC-018 — Membership is ACCESS_REVOKED until invitation accepted** Decision: an invited membership persists with
`status = ACCESS_REVOKED` + embedded invitation PENDING; explicit acceptance flips it to ACTIVE. Reason: unambiguous
access semantics. Alternatives: keep ACTIVE-doc + pending-invitation convention (rejected as ambiguous). Consequences:
member-doc migration, invitation accept/expire/restore logic updates, member-list status display.

**DEC-019 — Scoped user deletion** Decision: only Owner/TAdmin of the same tenant may delete a user; deletion
soft-deletes the user AND removes live memberships; snapshots remain. Reason: closes cross-tenant privilege and
orphaned-access holes. Consequences: `tenant.service.deleteUser` rework + tenant-scope validation.

**DEC-020 — Comment ownership for Editors** Decision: Editors edit/delete only their own comments; Project Admin+
moderate any comment in scope. Reason: prevents peer privilege escalation. Consequences: ownership check in
comment.service.

**DEC-021 — Split audit visibility** Decision: new `view_task_history` action for all project roles; `view_audit_events`
remains PAdmin+ / tenant admins. Reason: task History is daily-use; administrative audit stays restricted. Consequences:
rbac matrix, audit routes, task detail UI.

**DEC-022 — Mock checkout implemented** Decision: first-tenant onboarding includes plan selection + mock checkout with
an isolated billing boundary. Reason: journey fidelity; future real billing slots in without redesign.

**DEC-023 — Password reset implemented** Decision: email-based reset with hashed single-use expiring tokens and neutral
anti-enumeration responses. Reason: US-AUTH-03 MUST-have, currently absent.

**DEC-024 — Email verification deferred (final)** Decision: registration grants immediate session; verification flag
deferred. OQ-001 closed.

**DEC-025 — Transaction-based project seed; replica-set everywhere** Decision: project seed runs inside a MongoDB
transaction; development Docker MongoDB runs as a single-node replica set; production uses Atlas Free (replica set);
identical transaction-based code in both environments; compensating delete removed as primary mechanism. Reason: BR-003
atomicity without app-level cleanup complexity. Consequences: docker/replica-set config, session-aware seed code,
deployment prerequisite documented in doc 22.

**DEC-026 — Board card ordering: integer position kept** Decision: verify and keep integer `position` ordering;
fractional ranks stay deferred (DEC-013 stands).

**DEC-027 — Token-link invitation acceptance (primary channel)** Decision: implement opaque `/invite/:token` public
landing validating token → login/register → resume acceptance, per doc 16; replaces "my invitations" login flow as the
primary channel (fallback may remain). Consequences: public unauthenticated route, resume mechanics, email link format.

**DEC-028 — Audit actor snapshot stored at write time** Decision: every audit event stores actor displayName snapshot
alongside actorId. Reason: history survives deletion/rename (BR-014).

**DEC-029 — Overdue indicator only; no multi-ACTIVE warning** Decision: ACTIVE sprints past endDate show a visual
overdue flag; no warning banner for multiple simultaneously ACTIVE sprints. OQ-003 closed.

**DEC-030 — Conflict dialog reload-only for MVP** Decision: task conflict dialog explains and offers reload
(take-theirs) + cancel; keep-mine resolution deferred. Consequences: doc 12 §8 softened.

---

# UI/UX audit decisions ([29-ui-ux-audit.md](29-ui-ux-audit.md))

Status: **ADOPTED** — confirmed by the product owner.

**DEC-031 — Remove dead header search** Decision: delete the non-functional header search input/component; global search
/ command palette remains roadmap. Reason: dead controls erode trust; table search already covers MVP needs.

**DEC-032 — Human-readable slug-based URL scheme** Decision: URLs use a unique tenant slug + project key + task number:
`/t/:tenantSlug/projects/:projectKey/tasks/:taskNumber` (e.g. `/t/my-workspace/projects/ABC/tasks/ABC-123`). Slug is
auto-generated from the workspace name at creation, editable before submit, globally unique (unique index +
enumeration-safe availability check), restricted to lowercase `[a-z0-9-]` with a max-length cap. Task canonical URL uses
the task number, not internal id. Reason: fully human-readable, shareable links. Consequences: Tenant gains a `slug`
field; server adds availability endpoint + slug→id resolution; all client links regenerated; slug immutability in MVP
(recommended) to avoid link rot; doc 06 §3 rewritten.

**DEC-033 — Spec-faithful main page** Decision: root redirects to the last/first accessible tenant home; one unified
tenant dashboard serves all roles; "My Tasks" becomes a dashboard widget; role-split Owner/Member dashboards are retired
(including the duplicated stat card). Reason: removes duplication, implements the post-login routing rule.

**DEC-034 — Full project overview** Decision: overview shows status summary, active sprint, recent tasks, members
preview, and board shortcuts (spec S9).

**DEC-035 — Project settings hub** Decision: add `…/settings` index (General / Members / Types / Statuses / Labels /
Boards / Danger Zone); archive/delete move out of the project overview into Danger Zone.

**DEC-036 — Help pages kept as static content** Decision: faq/docs/support remain as static example pages without a
support-form backend; excluded from MVP acceptance criteria.

**DEC-037 — Notifications UI removed entirely** Decision: both the header bell button and the notifications panel are
removed until the notification center (DEC-014) exists; they will be reintroduced together.

**DEC-038 — Unified sprint board experience** Decision: board view gains a sprint selector via `?sprintId=`;
sprint-detail retains planning actions (start/complete/disposition) and deep-links into the scoped board.

**DEC-039 — Backlog section on the Sprints page** Decision: sprint-list renders a Backlog group linking to the backlog
view, matching spec S13.

---

# Round 4 decisions ([34-ui-ux-round4-plan.md](34-ui-ux-round4-plan.md))

# Round 5 decisions ([35-ui-ux-round5-plan.md](35-ui-ux-round5-plan.md))

## DEC-054 — Sidebar rail stays

The invisible minimize/maximize rail on the sidebar's right edge remains (owner initially flagged it, then decided to
keep it).

## DEC-055 — Member expiration date (full feature)

Membership gains `expiresAt`. On/after that date the member's status becomes ACCESS_REVOKED — the member is NOT removed
from the tenant or its projects; access can be restored at any time keeping all projects and roles. A revoked member
cannot enter the tenant. Setting an expiration on the Owner is forbidden. UI: member edit dialog (name, email, role,
expiration date) + Expiration column in the members table.

## DEC-056 — Free-form date format preference

`dateFormat` becomes a free-form string validated against a token whitelist (Y, M, D, MMM, HH, mm, …) on the server
(Zod) and in the UI; the previous presets remain as quick-pick options. Rendering uses DatePipe with registered Angular
locale data so `MMM` month names are localized (e.g. "27 авг 2026"). The date-filter trigger formats dates according to
this preference without the weekday.

Status: **ADOPTED** — confirmed by the product owner (RQ-01..RQ-04 answered).

**DEC-050 — Date-range filters use the Spartan date-picker** Decision: Created/Updated column filters are implemented
full-stack (shared query types → Zod → repo `$gte/$lte` → URL params) with a mode select (on/before/after/between) and
the Spartan `date-picker` Helm component inside the header filter popover.

**DEC-051 — All native titles migrate to `hlmTooltip`** Decision: every `[title]`/`[attr.title]` usage becomes an
`hlmTooltip`, including truncated data cells in tables (owner accepted the per-row overlay cost).

**DEC-052 — Mobile navigation = hamburger + offcanvas sheet** Decision: below the `md` breakpoint a header hamburger
opens the sidebar as an offcanvas sheet (canonical shadcn/spartan pattern); shell owns outer padding responsively
(`px-3 py-4 sm:p-6`) and page-level horizontal scroll is eliminated via wrapping toolbars.

**DEC-053 — Deferred backlog pulled into round 4** Decision: all seven deferred items are implemented now: Saved Views
(UI-only on the existing filters backend), keyboard shortcuts, bulk actions (server bulk endpoint + multi-select UI),
undo toasts for destructive actions, table density toggle, WIP counts in board headers, sprint date EDIT control.
Sidebar restructure (tenant group slim-down, project-switcher dropdown, `/t/:slug/projects` redirect, explicit collapse
toggle persisted in localStorage) adopted as D-47/D-48 in doc 34.
