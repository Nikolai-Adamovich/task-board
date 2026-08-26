# 28 — Implementation Gap Analysis

Comparison of the **current codebase** (server + ui + shared) against [`product-analysis/`](.) and the original
`business_analysis/` docs. Each finding is classified:

- ✅ **DONE** — implemented and aligned with the analysis
- 🔧 **REWORK** — implemented but diverges or buggy; needs a decision
- ➕ **MISSING** — required by analysis/MVP but absent
- ❓ **DECISION** — explicit choice needed between existing code behavior and the analysis recommendation

---

## A. What is already done (✅)

| Area                                                                                                                                                                                                                                                                                                                                                                                                                  | Evidence                                                                                                              |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Auth: register/login, JWT (`hono/jwt`), bcrypt, soft-delete users (`deletedAt`)                                                                                                                                                                                                                                                                                                                                       | `routes/auth.ts`, `services/auth.service.ts`, `repositories/user.repository.ts`                                       |
| RBAC v5: action-based matrix, tenant bypass for Owner/Admin, `ensurePermission()` guard                                                                                                                                                                                                                                                                                                                               | `services/rbac.service.ts`, `middleware/rbac.ts` — mirrors [11-permissions-and-roles.md](11-permissions-and-roles.md) |
| Project seed: 5 statuses, 3 types, default board (TODO+REOPENED / IN_PROGRESS / IN_REVIEW / DONE), defaults linked, creator membership, key validation, cleanup-on-failure                                                                                                                                                                                                                                            | `services/project.service.ts`                                                                                         |
| Archive/restore + DELETION_PENDING grace period (30 days) + cancel, for Tenant and Project                                                                                                                                                                                                                                                                                                                            | `tenant.service.ts`, `project.service.ts`                                                                             |
| Tasks: sequential numbers (counter repo), identity snapshots (reporter/assignee/creator), `version` optimistic concurrency with `TASK_VERSION_CONFLICT`, cross-tenant "My Tasks" route                                                                                                                                                                                                                                | `task.service.ts`, `shared/types/task.ts`                                                                             |
| Status deletion: mandatory replacement when used by tasks; board column replacement                                                                                                                                                                                                                                                                                                                                   | `status.service.ts`                                                                                                   |
| Sprints: FUTURE/ACTIVE/COMPLETED, unrestricted transitions, date validation `endDate >= startDate`, completion fills endDate, delete → tasks back to backlog                                                                                                                                                                                                                                                          | `sprint.service.ts`                                                                                                   |
| Invitations: 7-day derived TTL, hashed tokens, resend replaces token, decline/revoke, "my invitations" listing                                                                                                                                                                                                                                                                                                        | `tenant-member.service.ts`, `routes/invitations.ts`                                                                   |
| UI: board view with drag-drop + multi-status column prompt dialog, task detail inline editing with conflict dialog + reload, error interceptor mapping API codes → i18n messages, Milkdown editor, pagination component, filter panel, saved-filter client, audit log viewer, tenant switcher, labels/statuses/task-types managers, sprint backlog/detail, comments, task relationships, 11 locales, unit + e2e tests | `ui/src/app/features/**`                                                                                              |
| Conventions: request-scoped DI (`provideServices` + AsyncLocalStorage DB), zValidator bodies, `{data}`/`{error}` envelope, no type suffixes, signals-first UI                                                                                                                                                                                                                                                         | throughout                                                                                                            |

## B. Divergences needing rework or a decision (🔧/❓)

### D-01 — Sprint start also sets `endDate = now` ❓ Q-01

`sprint.service.ts:102-104`: when a sprint transitions to ACTIVE and `endDate` is null, the server sets `endDate = now`.
The fixed product decision (and [14-sprint-analysis.md](14-sprint-analysis.md)) says start fills **only startDate**;
endDate is filled on completion. Setting endDate at start effectively pre-completes the sprint's date range.

### D-02 — Whole projects router gated by `create_project` ❓ Q-02

`routes/index.ts:42` applies `requirePermission('create_project')` to **all** `/projects/*` routes. `create_project` is
tenant-level and allowed only for OWNER/ADMIN ⇒ **Tenant Members, Editors and Viewers receive 403 on every project
read** (list, get, tasks, boards…). This contradicts the permission matrix (`view_task` for Viewer) and the entire
Viewer concept. Individual routes pass `userRole` into services, which do their own checks.

### D-03 — Membership is ACTIVE while invitation is still PENDING ❓ Q-03

`tenant-member.service.ts:141` creates the member doc with `status: ACTIVE` and relies on the embedded
`invitation.status === PENDING` to mean "not yet accepted". The requirements model ([REQ §5–6]) treats acceptance as the
flip to ACTIVE and revocation as ACCESS_REVOKED; access checks must therefore consult `invitation.status` everywhere
(must verify they do).

### D-04 — User deletion semantics ❓ Q-04

`tenant.service.ts:229 deleteUser`: any **Owner** (of _any_ tenant — no tenant-scope check in the service) can
soft-delete **any** user; memberships are **not** removed; comment says "only tenant owners" but no role/tenancy
validation is visible. Analysis ([11-permissions-and-roles.md](11-permissions-and-roles.md), BR-039) expects
Owner/TAdmin **within the same tenant**, removal of live memberships, snapshots preserved (snapshots are preserved ✅
since they're denormalized).

### D-05 — Comment edit/delete rights ❓ Q-05

Code matrix grants `edit_comment`/`delete_comment` to EDITOR unconditionally (`rbac.service.ts:90-91`). Analysis says
Editors may modify **their own** comments only; moderation of others' = PAdmin+. Need to verify whether comment.service
enforces ownership; if not, this is a privilege escalation between peers.

### D-06 — Audit event visibility & actor snapshots ❓ Q-06 / Q-13

- `view_audit_events` = PROJECT_ADMIN only (+ tenant bypass). Analysis: task-level history readable by all project
  members; project audit PAdmin+; tenant audit Owner/TAdmin.
- Audit calls pass `actorId` only; the [AuditEvent] spec requires an actor **displayName snapshot** so history survives
  user deletion. Verify `audit.service.ts` resolution; if it resolves display name at write time ✅, else rework.

### D-07 — Invitation acceptance model ❓ Q-12

Requirements/user-flows describe **opaque email token links** (`/invite/:token`). Implementation uses login-based flow:
invitee logs in, sees "my invitations" (`getMyInvitations(email)`), accepts by memberId; the raw token is emailed but
acceptance appears memberId-scoped. Simpler and safer in some ways, but diverges from the documented flow and the
`AcceptInvitation` shared type.

## C. Missing versus the analysis MVP (➕)

| #    | Item                                                                                                                                                                         | Analysis ref                                                                 |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| M-1  | **Mock checkout / plan selection step** in first-tenant onboarding (UI shows a static "Free Plan" info card only; no billing boundary)                                       | [17-onboarding](17-onboarding-and-authentication.md) §5, [UF §3.1] — ❓ Q-07 |
| M-2  | **Password reset** flow (no reset/forgot endpoints; login page link TBD)                                                                                                     | US-AUTH-03 — ❓ Q-08                                                         |
| M-3  | **Email verification** flag (absent — matches OQ-001 recommendation (a); confirm)                                                                                            | OQ-001 — ❓ Q-09                                                             |
| M-4  | **Saved filters UI wiring** — filter-client exists; verify save/apply loop is complete in task-table/filter-panel                                                            | US-SRCH-03                                                                   |
| M-5  | **Board card ordering persistence** — `MoveTask.position` exists client-side; verify server persists ordering; if yes, DEC-013 (defer fractional rank) stands; if no, decide | ❓ Q-11                                                                      |
| M-6  | **Overdue active-sprint indicator** and **multi-ACTIVE-sprint warning** (OQ-003 recommendations)                                                                             | ❓ Q-14                                                                      |
| M-7  | **Tenant archive cascade** (`archiveReason = TENANT_ARCHIVE` restore semantics) — ArchiveReason constant exists; verify tenant archive cascades to projects                  | BR-005                                                                       |
| M-8  | **Project key immutability after first task** — verify `updateProject` enforces it                                                                                           | BR-002                                                                       |
| M-9  | **Rate limiting** on auth/invitation endpoints                                                                                                                               | [21-security] §6                                                             |
| M-10 | **Conflict resolution options** — UI conflict dialog currently offers reload; analysis wants "keep mine / take theirs / cancel". Acceptable simplification?                  | ❓ Q-15                                                                      |

## D. Verified non-issues

- Sprint transitions unrestricted ✅ (matches DEC-005 except D-01).
- Status case-insensitive uniqueness ✅ (`DUPLICATE_STATUS`).
- Optimistic concurrency end-to-end incl. UI conflict dialog ✅.
- Per-request MongoClient via AsyncLocalStorage ✅ (hard rule respected).
- Error envelope + i18n error mapping ✅.

---

## E. Decision questions

Each question lists the **existing code behavior** vs the **analysis recommendation**. Answers will drive updates to
both the code plan and the product-analysis documents.

---

**Q-01 — Sprint start date side effects** Code: start sets `startDate = now` **and** `endDate = now` if missing.
Analysis/decision: start fills only `startDate`; endDate fills only on completion. Options: (a) fix code to match
decision (recommended — pre-filling endDate distorts sprint reporting and contradicts the fixed decision); (b) keep code
and amend the analysis + decision log. **Recommendation: (a).**

**Q-02 — Access to project routes for non-admin tenants** Code: entire `/projects/*` router requires `create_project`
(OWNER/ADMIN) ⇒ Members/Editors/Viewers cannot read anything. Analysis: Viewers/Editors must read projects;
per-route/service checks suffice. Options: (a) remove the router-level gate; enforce per-action checks in services
(recommended — current behavior breaks the Viewer concept and probably e2e member scenarios); (b) keep admin-only access
(then Viewer/Editor roles are dead code and the analysis must be rewritten). **Recommendation: (a).**

**Q-03 — Membership status while invitation pending** Code: member doc ACTIVE immediately; `invitation.status = PENDING`
marks "not yet accepted". Requirements: acceptance flips membership to ACTIVE (pre-acceptance state effectively
not-active). Options: (a) keep code model; add explicit rule "access = ACTIVE && !pendingInvitation" everywhere + update
analysis/glossary (cheapest); (b) rework to ACCESS_REVOKED-until-accepted (cleaner semantics, more migration work).
**Recommendation: (a)** — provided access checks consistently consult invitation status (needs a verification task
either way).

**Q-04 — User deletion permissions & scope** Code: any Owner soft-deletes any user; no same-tenant check; memberships
untouched. Analysis: Owner/TAdmin of the **same tenant** only; soft-delete + remove live memberships; snapshots persist.
Options: (a) implement analysis semantics (scope check + membership cleanup) (recommended); (b) keep as-is and mark the
app single-tenant-administrative (weak security posture). **Recommendation: (a).**

**Q-05 — Comment ownership enforcement** Code matrix: EDITOR can edit/delete any comment. Analysis: Editor own-only;
PAdmin+ moderate. Options: (a) enforce ownership in comment.service (Editor own-only) (recommended); (b) keep open
editing within a project (simpler, small teams only). **Recommendation: (a).**

**Q-06 — Audit visibility granularity** Code: `view_audit_events` = PROJECT_ADMIN+ only. Analysis: task History tab for
all members; project audit PAdmin+; tenant audit Owner/TAdmin. Options: (a) split into `view_task_history` (all roles) +
`view_audit_events` (PAdmin+/tenant admins) (recommended); (b) keep single admin-only audit action and drop the
task-history tab requirement. **Recommendation: (a).**

**Q-07 — Mock checkout step** Code: absent; welcome screen shows a static Free-plan card. Analysis/onboarding flow: plan
choice + mock checkout step isolating a future billing boundary. Options: (a) add the mock step now (journey fidelity,
cheap); (b) defer and rewrite [17-onboarding]/flows to describe the current single-step creation (also legitimate for an
internal tool). **Recommendation: (a)** if the learning goal includes billing-boundary design; otherwise (b).

**Q-08 — Password reset** Code: absent entirely. Analysis: US-AUTH-03 MUST-have. Options: (a) implement email-based
reset (needs Resend template + neutral responses) (recommended); (b) defer explicitly and remove "Forgot password"
affordances until then. **Recommendation: (a).**

**Q-09 — Email verification** Code: absent (registration → immediate session). Analysis OQ-001 recommended deferral
((a)). Options: (a) confirm deferral, close OQ-001 (recommended); (b) implement now behind a flag. **Recommendation:
(a).**

**Q-10 — Project seed atomicity** Code: ordered inserts + compensating delete ("simulates transaction"). Analysis
BR-003: transaction where topology supports. Options: (a) keep compensating-cleanup (works without replica set;
acceptable risk window) (recommended for current deployment); (b) wrap seed in a MongoDB transaction when the Atlas
topology supports sessions. **Recommendation: (a) now, note (b) as infra-dependent improvement.**

**Q-11 — Board card ordering** Code: `MoveTask.position` sent by the client — persistence semantics on the server need
verification. Analysis DEC-013: defer persistent ordering; order by number/updated. Options: (a) verify & keep
integer-position ordering if implemented (fine for MVP scale); (b) strip position and use number/updated ordering; (c)
jump to fractional ranks now. **Recommendation: (a)** — verify first; avoid (c) until scale demands.

**Q-12 — Invitation acceptance channel** Code: login-based — invitee authenticates, sees "my invitations", accepts by
memberId (emailed token seems informational). Analysis/[UF §27]: opaque `/invite/:token` public landing that routes to
login/register. Options: (a) keep login-based flow and rewrite
[16-invitation-and-membership-flows.md](16-invitation-and-membership-flows.md) acceptance section accordingly (simpler,
avoids token-in-URL leakage; loses "accept directly from email" convenience); (b) implement token-link landing per
analysis. **Recommendation:** your call — (a) is less work and arguably safer; (b) matches the documented UX and
competitor convention.

**Q-13 — Audit actor snapshot** Verify `audit.service.ts` stores actor displayName at write time (analysis BR-014/§19).
If it stores only `actorId`, add snapshot. (Not a choice — alignment item, unless you prefer id-only + join-at-read,
which breaks the deleted-user guarantee.) **Recommendation: store snapshot.**

**Q-14 — Sprint UX guards (OQ-003/OQ-004 follow-ups)** Adopt overdue indicator + >1-ACTIVE-sprint warning banner?
Options: (a) yes, both (recommended); (b) neither; (c) only overdue indicator. **Recommendation: (a).**

**Q-15 — Conflict dialog scope** Code: conflict dialog explains and reloads (take-theirs). Analysis: keep-mine /
take-theirs / cancel. Options: (a) accept reload-only for MVP and soften [12-task-workflow.md](12-task-workflow.md) §8
(recommended — keep-mine requires re-PATCH machinery); (b) implement full three-option resolution now. **Recommendation:
(a).**

---

## E′ — Resolutions (decided)

All fifteen questions were answered. Binding resolutions:

| Q    | Decision                                          | Consequence                                                                                                                                                                                                                                                                                                 |
| ---- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q-01 | **(a)** Fix code                                  | Sprint start fills only `startDate = now` when null; never touches endDate. Rework D-01.                                                                                                                                                                                                                    |
| Q-02 | **(a)** Remove router-level `create_project` gate | Per-action/service-level authorization; Viewers/Editors/Members regain read access. Rework D-02.                                                                                                                                                                                                            |
| Q-03 | **(b)** Rework membership semantics               | Pre-acceptance membership persisted as `ACCESS_REVOKED` (+ invitation PENDING); acceptance flips to ACTIVE. Rework D-03 + access checks. Docs 09/16/26 already describe the target model.                                                                                                                   |
| Q-04 | **(a)** Scoped user deletion                      | Owner/TAdmin of the **same tenant** only; soft-delete + remove live memberships; snapshots persist. Rework D-04.                                                                                                                                                                                            |
| Q-05 | **(a)** Comment ownership                         | Editor may edit/delete **own** comments only; PAdmin+ moderate others'. Rework D-05.                                                                                                                                                                                                                        |
| Q-06 | **(a)** Split audit permissions                   | New `view_task_history` (all project roles) vs `view_audit_events` (PAdmin+, tenant admins). Rework D-06.                                                                                                                                                                                                   |
| Q-07 | **(a)** Add mock checkout step                    | Plan selection + mock checkout in first-tenant onboarding, isolated billing boundary. Implements M-1.                                                                                                                                                                                                       |
| Q-08 | **(a)** Implement password reset                  | Email-based reset, hashed single-use tokens, neutral anti-enumeration responses. Implements M-2.                                                                                                                                                                                                            |
| Q-09 | **(a)** Confirm deferral                          | Email verification stays out; OQ-001 closed.                                                                                                                                                                                                                                                                |
| Q-10 | **(b)** Transaction-based project seed            | MongoDB transactions everywhere; local Docker runs as **single-node replica set**, production uses **Atlas Free replica set**; identical transaction-based code in both environments; compensating delete is no longer the primary mechanism. Updates BR-003 / [22-NFR](22-non-functional-requirements.md). |
| Q-11 | **(a)** Verify & keep integer `position` ordering | Fractional ranks stay deferred (DEC-013 stands).                                                                                                                                                                                                                                                            |
| Q-12 | **(b)** Token-link invitations                    | Implement opaque `/invite/:token` public landing routing to login/register, per [16-invitation-and-membership-flows.md](16-invitation-and-membership-flows.md). Replaces the login+"my invitations" accept path as the primary channel.                                                                     |
| Q-13 | Store actor snapshot                              | Audit events persist actor displayName at write time (BR-014).                                                                                                                                                                                                                                              |
| Q-14 | **(c)** Overdue indicator only                    | Active sprints past endDate get a visual flag; **no** multi-ACTIVE-sprint warning. OQ-003 resolved accordingly.                                                                                                                                                                                             |
| Q-15 | **(a)** Reload-only conflict dialog for MVP       | Task conflict UI = explanation + reload (take-theirs) + cancel; keep-mine deferred. [12-task-workflow.md](12-task-workflow.md) §8 softened.                                                                                                                                                                 |

## F. Implementation work plan (ordered by dependency)

1. **RBAC route fix (Q-02)** — unblock reads; prerequisite for verifying everything else as non-admin.
2. **Membership semantics rework (Q-03)** — ACCESS_REVOKED-until-accepted + access-check updates; touches invitations,
   guards, member lists.
3. **Token-link invitation flow (Q-12)** — `/invite/:token` landing, register/login resume, replaces primary accept
   channel.
4. **Sprint start fix (Q-01)** — small service change + tests.
5. **User deletion scoping (Q-04)** + **comment ownership (Q-05)** + **audit split & actor snapshot (Q-06/Q-13)** —
   server-side authorization/integrity batch.
6. **Transaction-based seed (Q-10)** — Docker single-node replica set config, sessions in seed code, drop compensating
   delete.
7. **Mock checkout (Q-07)** + **password reset (Q-08)** — onboarding/auth features (server + UI).
8. **UX additions (Q-14, Q-15)** — overdue indicator; conflict-dialog copy adjustments.
9. **Verification items** — M-4 saved-filter wiring, M-5 position persistence, M-7 tenant archive cascade, M-8 key
   immutability, M-9 rate limiting.
10. **Docs sync** — applied in this package (decision-log, docs 10/12/16/22/25/26).
