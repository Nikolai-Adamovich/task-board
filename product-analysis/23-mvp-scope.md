# 23 — MVP Scope

Prioritized using MoSCoW. Principle: MVP = the complete daily loop (plan → track → collaborate) plus safe
administration, nothing that competitors prove is deferrable.

---

## MUST HAVE (MVP definition)

**Authentication & onboarding**

- Register/login/logout/password reset; session-failure handling
- First-Tenant onboarding incl. mock checkout (Free plan)
- Post-login routing & tenant switcher

**Tenant**

- Tenant dashboard; settings; members management
- Archive tenant (cascade w/ archiveReason); delete tenant w/ grace period

**Projects**

- Create (atomic seed: types/statuses/default board/default status), edit, key rules
- Archive/restore; delete w/ grace period + typed confirmation
- Overview page

**Tasks**

- CRUD w/ sequential numbers; default-status-on-create (+override)
- Independent inline field editing w/ optimistic concurrency + conflict UI
- Markdown description (Milkdown); priority; assignee (member-scoped)
- Hard delete w/ confirmation + cascade + audit-before-delete
- Relationships BLOCKS/RELATES_TO/DUPLICATES (same project)

**Comments** — create/edit/delete per role; author snapshots

**Labels** — case-insensitive reuse; create-on-the-fly; delete detaches

**Statuses** — list/create/edit/delete w/ mandatory replacement when used; invalid board refs handling; default-status
protection

**Boards** — view config; multi-status columns; per-user selected-board preference; sprint scoping filter; drag w/
rollback + non-drag move path; invalid column hiding/red-marking in editor

**Sprints** — FUTURE/ACTIVE/COMPLETED; optional dates; start/complete date population; completion dialog for unfinished
tasks; unrestricted transitions (authorized); delete→backlog

**Memberships & invitations** — full lifecycle per doc 16 (PENDING/EXPIRED-derived/DECLINED/REVOKED; resend invalidates;
explicit acceptance; revoke/restore messaging; project removal preserves history)

**Permissions** — 5-role matrix enforced server-side; role-appropriate UI

**Search/filter/pagination** — combinable filters, sorting, page/limit w/ caps, URL state, saved filters, snapshot-name
search

**Audit/history** — event catalog per doc 19; task History tab; admin audit views (basic filter)

**States & feedback** — full loading/empty/error/forbidden/not-found/archived/conflict spec (doc 20); toasts;
access-state banners

**Transactional email** — invitation(+resend), password reset (Resend w/ fallback)

## SHOULD HAVE (strong candidates, same release if capacity allows)

- Invitation-expired notification to inviter
- Overdue indicator on active sprints past endDate
- Board filters (assignee/type/label/priority) with hidden-count disclosure
- Keyboard shortcuts for task creation/navigation (Linear-style `c`)
- Task detail as sheet-from-board upgrading to full page
- Basic project overview widgets (status counts, recent tasks)

## NICE TO HAVE (post-MVP quick wins)

- WIP limits (guidance mode) on board columns
- Card ordering persistence (fractional rank)
- Comment edit history ("edited" badge exists; full history later)
- Export member/audit lists (CSV)

## DEFERRED (roadmap, see doc 24)

Real billing; file attachments; notification center/watchers/@mentions; custom workflow transition graphs; custom task
types UI; automation rules; integrations (GitHub/GitLab/Slack); advanced full-text search; dashboards/reporting
(velocity/burndown/carry-over); saved views beyond filters; bulk operations; project templates; SSO/SCIM; AI features;
epics/subtasks; multi-project task homing.

## Explicit exclusions carried from product decisions

Viewer writes; auto-completing sprints at endDate; sprint-owned boards; simultaneous multi-board display; separate
Backlog/TaskLink entities; replacing MongoDB.

## MVP acceptance heuristic

A new team can: register → workspace → project → 10 tasks → move them across a board → run one sprint cycle → invite 3
members with correct roles → search historical work after deleting a user — **without reading documentation**.
