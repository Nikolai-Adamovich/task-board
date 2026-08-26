# 10 — Business Rules Catalog

Authoritative rule registry. Sources: **[REQ]** = requirements doc, **[UF]** = user-flows doc, **[DEC]** = product
decision (fixed), **[REC]** = recommendation from this analysis. Traceability in
[27-traceability-matrix.md](27-traceability-matrix.md).

---

## Tenancy & Projects

**BR-001 — Tenant ownership uniqueness** Rule: exactly one Tenant Owner exists per Tenant; ownership transfer is an
explicit operation, never a side effect of role edits. Rationale: accountability and unambiguous billing/admin
authority. Entities: Tenant, TenantMembership. Source: [REQ §5.2].

**BR-002 — Project key format & immutability** Rule: key matches `^[A-Z][A-Z0-9]{1,9}$`, unique per Tenant; immutable
after the first Task is created. Entities: Project. Edge case: renaming allowed before first Task only. Source: [REQ
§7.1].

**BR-003 — Atomic project seed** Rule: creating a Project atomically creates 3 types, 5 statuses, default status TODO,
default Board with columns [TODO+REOPENED | IN_PROGRESS | IN_REVIEW | DONE], and links defaults on the Project. The seed
runs inside a **MongoDB transaction** (DEC-025): development Docker MongoDB is configured as a single-node replica set,
production uses an Atlas replica set — identical transaction-based code in both environments; compensating delete is not
the primary mechanism. Edge case: failed/aborted transaction ⇒ project never visible. Source: [REQ §39], DEC-025.

**BR-004 — Archive over delete** Rule: archiving makes an entity read-only but fully readable; permanent deletion
requires grace period + explicit confirmation. Entities: Project, Tenant. Source: [REQ §25], [UF §33–34].

**BR-005 — Tenant archive cascade with reason memory** Rule: archiving a Tenant archives its Projects with
`archiveReason = TENANT_ARCHIVE`; restoring the Tenant restores exactly those Projects; independently archived Projects
stay archived. Source: [REQ §3.1].

## Tasks

**BR-006 — Sequential task numbers** Rule: per-Project sequential numbers via atomic counter (`$inc`); displayed as
`KEY-n`. Source: [REQ §9.1–9.2].

**BR-007 — Default status at creation** Rule: new Tasks receive Project.defaultStatusId unless the creator explicitly
selects another valid Project status during creation. Source: [DEC], [REQ §9.5].

**BR-008 — Title constraint** Rule: title required, ≤255 chars. Source: [REQ §9.3].

**BR-009 — Description is Markdown** Rule: stored as Markdown string; no HTML document model; rendered safely
(sanitized). Source: [REQ §9.4].

**BR-010 — Optimistic concurrency** Rule: mutations carry client-observed `version`; update applies only if versions
match; conflicts return structured error (`TASK_VERSION_CONFLICT` + currentVersion), never silent overwrite. Multi-field
patches should attempt field-level three-way merge where practical. Source: [REQ §34], research (GitLab optimistic
locking for title/description).

**BR-011 — Backlog semantics** Rule: Backlog = tasks with `sprintId = null`; not an entity; sprint assignment never
removes a Task from the Project. Source: [DEC], [REQ §10].

**BR-012 — Task deletion cascade** Rule: hard delete removes Comments, relationships, label associations; audit event
written before deletion; no orphans remain. Source: [REQ §26].

**BR-013 — Same-project relationships** Rule: both endpoints of BLOCKS/RELATES_TO/DUPLICATES must belong to the same
Project. Source: [REQ §20].

**BR-014 — Historical identity snapshots** Rule: reporter/assignee/creator/comment-author/audit-actor store displayName
snapshots; snapshots are NOT updated on later name changes; User deletion nulls live ids but keeps snapshots; search
must match snapshot names. Source: [DEC], [REQ §4.2, §22, §31].

## Statuses

**BR-015 — Case-insensitive status names** Rule: uniqueness enforced on normalizedName within a Project. Source: [REQ
§12].

**BR-016 — Status deletion with mandatory replacement when used** Rule: if Tasks use the Status, replacement is
mandatory; all affected Tasks AND all board column references get the replacement. Source: [DEC], [REQ §12.1].

**BR-017 — Status deletion without task usage** Rule: if only Boards reference it, warn listing boards; allow replace or
delete-anyway; after delete-without-replacement boards hide the missing column and the editor marks it red/invalid.
Source: [DEC], [REQ §12.1].

**BR-018 — Default status protection** Rule: deleting the current default Status requires selecting a replacement that
becomes the new default; a Project always has ≥1 status. Source: [REC] (implied by REQ §7 defaults; prevents
unresolvable state).

## Labels

**BR-019 — Case-insensitive label reuse** Rule: "Bug"/"bug"/"BUG" resolve to one Label; creation from a Task registers
it Project-wide. Source: [DEC], [REQ §18].

**BR-020 — Label deletion detaches only** Rule: removing a Label strips it from Tasks; Tasks themselves unchanged.
Source: [REQ §29].

## Boards

**BR-021 — Board is a Project view** Rule: Boards belong to Projects, never Sprints; multiple boards allowed; one
displayed at a time; selected board is a per-user/per-project preference. Source: [DEC], [REQ §13–15].

**BR-022 — Column may group statuses** Rule: a column references ≥1 statusIds; drag-to-multi-status-column asks the user
which status applies; backend stores Status only. Source: [DEC], [UF §18].

**BR-023 — Board deletion is inert to tasks** Rule: deleting a Board affects no Tasks; Project.defaultBoardId cannot
dangle (deleting the default board requires promoting another board or blocking). Source: [REQ §28]; second clause
[REC].

## Sprints

**BR-024 — Optional sprint dates** Rule: FUTURE sprints may have no dates / startDate / endDate / both; when both exist
`endDate >= startDate`. Source: [DEC], [REQ §16].

**BR-025 — Start sprint** Rule: Start sets ACTIVE; missing startDate becomes now; configured dates preserved. Source:
[DEC], [REQ §16.3].

**BR-026 — Complete sprint** Rule: Complete sets COMPLETED; missing endDate becomes now; existing endDate preserved.
Source: [DEC], [REQ §16.4].

**BR-027 — No auto-completion by date** Rule: passing endDate never transitions an ACTIVE sprint; no background job
performs this. Source: [DEC — final].

**BR-028 — Unrestricted sprint transitions** Rule: any status → any status (including COMPLETED → ACTIVE) for authorized
roles; dates preserved unless explicitly changed. Source: [DEC], [REQ §16.1].

**BR-029 — Sprint authorization** Rule: create/status-change restricted to Owner/TAdmin/PAdmin. Source: [REQ §17].

**BR-030 — Sprint deletion returns tasks to backlog** Rule: deleting a Sprint sets affected Tasks' sprintId = null, then
hard-deletes the Sprint. Source: [REQ §27].

**BR-031 — Completion handles unfinished work explicitly** Rule: completing with unfinished Tasks prompts disposition
(move to Backlog or a chosen future Sprint); never silently leaves them in a COMPLETED sprint context. Source: [REC]
based on Jira's documented complete-sprint flow
([Atlassian docs](https://support.atlassian.com/jira-software-cloud/docs/complete-a-sprint/)).

## Memberships & Invitations

**BR-032 — Unique memberships** Rule: unique (tenantId,userId) and (projectId,userId). Source: [REQ §5, §8].

**BR-033 — Tenant authority without project membership** Rule: Owner/TAdmin exercise tenant-level administrative rights
on Projects without holding Project Memberships. Source: [REQ §8.1].

**BR-034 — Invitation lifecycle states** Rule: PENDING → EXPIRED (derived: invitedOn + TTL, evaluated dynamically) |
DECLINED | REVOKED | accepted (invitation data cleared, membership ACTIVE). Source: [DEC], [REQ §5.3].

**BR-035 — Resend invalidates old link** Rule: resend replaces token hash, invitedBy, invitedOn; resets PENDING; old URL
dead; new email sent. Source: [DEC], [UF §26.2].

**BR-036 — Explicit acceptance only** Rule: administrators can never force a PENDING invitation to ACTIVE; the invitee
must accept. Source: [DEC].

**BR-037 — Revocation messaging** Rule: revoked/expired access yields "Your access … has expired"; restoration yields
"…has been restored." Expired invitation also clears invitation data. Source: [DEC], [REQ §6].

**BR-038 — Project removal preserves everything else** Rule: removing a Project member keeps Tenant membership, Tasks,
Comments, history; re-addition restores edit capability per granted role. Source: [DEC], [REQ §8.2].

**BR-039 — User deletion preserves history** Rule: deleting a User removes live access/memberships only; snapshots
persist; search continues to match historical names. Source: [DEC], [REQ §31].

## Permissions (summary — full matrix in doc 11)

**BR-040 — Viewer strictly read-only.** Source: [DEC — final]. **BR-041 — Backend authoritative.** UI hiding is
convenience; every mutation re-validates auth/membership/scope/state server-side. Source: [REQ §37, §41]. **BR-042 —
Archived/deletion-pending entities reject writes** except administrative restore/cancel operations. Source: [REQ §25],
[UF §33].

## Pagination & API

**BR-043 — Server-side pagination required** for large collections; page/limit with max limit (e.g., 100); response
includes totals; indexes must back common filter+sort combinations. Source: [DEC], [REQ §23, §35]. **BR-044 — Structured
error envelope** `{ error: { code, message, details? } }` with the documented code vocabulary. Source: [REQ §38].
**BR-045 — Referential scope validation** — every referenced entity (status/type/label/sprint/board/replacement status)
must belong to the same Project/Tenant scope as the request. Source: [REQ §37].

**BR-046 — Pre-acceptance membership is not active** Rule: a membership created via invitation persists with
`status = ACCESS_REVOKED` and embedded invitation PENDING; only explicit acceptance flips it to ACTIVE; all access
checks test membership status alone. Source: DEC-018.

**BR-047 — Scoped user deletion** Rule: only Owner/TAdmin of the same Tenant may delete a User; deletion soft-deletes
the account AND removes their live memberships; identity snapshots persist. Source: DEC-019, BR-039.

**BR-048 — Comment ownership for Editors** Rule: Editors may edit/delete only comments they authored; Project Admin+ may
moderate any comment within project scope. Source: DEC-020.
