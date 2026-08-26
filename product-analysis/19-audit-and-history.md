# 19 — Audit & History

What historical data must survive which events; MVP vs future. Research base:
[AppMaster audit patterns](https://appmaster.io/blog/audit-logging-internal-tools-activity-feed),
[Veld Systems audit guide](https://veldsystems.com/blog/audit-logging-complete-activity-trail).

---

## 1. Principles (research-aligned)

1. **Append-only**: audit events are never updated or deleted; corrections are new events.
2. **Field-level diffs** for updates (`field, oldValue, newValue`); snapshots for creates/deletes of important entities.
3. **Actor snapshots**: every event stores actor displayName at event time — survives renaming AND deletion ([REQ §24],
   BR-014).
4. **Single write path**: every mutation emits its audit event within the same service flow — no bypasses for
   imports/jobs (MVP has no imports/jobs, but the rule is structural).
5. **Log denials worth knowing**: failed permission checks on writes go to a security stream (aggregate-level acceptable
   in MVP).
6. **Don't log secrets**: no tokens/passwords in diffs; sensitive values redacted.

## 2. What survives which destructive event

| Event                         | Survives                                                | Mechanism                                        |
| ----------------------------- | ------------------------------------------------------- | ------------------------------------------------ |
| User renamed                  | Old snapshots unchanged                                 | Snapshots are write-once                         |
| User deleted                  | Tasks, Comments, authorship names, audit actors         | id→null + snapshot retained (BR-014/BR-039)      |
| Member removed from Project   | Their tasks/comments/history                            | Nothing detached (BR-038)                        |
| Status deleted w/ replacement | History references old status by name snapshot in diffs | Audit diffs store values, not just ids           |
| Sprint deleted                | Tasks (→ backlog), audit trail intact                   | BR-030                                           |
| Project archived              | Everything, read-only                                   | BR-004                                           |
| Project permanently deleted   | Project-scoped audit data removed too                   | [REQ §25] — archive instead if retention matters |
| Tenant permanently deleted    | All owned data incl. audit                              | Same principle                                   |

## 3. Event catalog (MVP)

| Domain                         | Events                                                                                                                                                  |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Task                           | created, updated (per-field diffs), status_changed, assigned/unassigned, sprint_assigned/removed, labels_changed, deleted                               |
| Comment                        | created, updated, deleted                                                                                                                               |
| Board/Status/Type/Label config | created, updated, deleted (+replacement applied for statuses)                                                                                           |
| Sprint                         | created, updated, started, completed, reopened, deleted                                                                                                 |
| Membership                     | invited, invitation_resent, invitation_accepted, invitation_declined, invitation_revoked, access_revoked, access_restored, role_changed, member_removed |
| Project/Tenant                 | created, updated, archived, restore, deletion_scheduled, deletion_cancelled, permanently_deleted                                                        |
| Auth/security                  | login_failed (aggregate), password_reset_requested/completed                                                                                            |

## 4. Exposure

- **Task page History tab**: task-scoped events, human-readable ("Status: TODO → IN_PROGRESS", "Assignee: Unassigned →
  John Doe"), all project members can read.
- **Project/Tenant audit view** (PAdmin+/Owner/TAdmin): filterable by actor/action/time range; export deferred.
- Linking rule: show "view record" links only when viewer has access; otherwise safe placeholder ([AppMaster guidance]).

## 5. Retention & future

- MVP: retain indefinitely except through explicit permanent aggregate deletions (documented behavior).
- Future: retention policies, export, tamper-evidence (hash chaining), security-stream partitioning — none block MVP
  ([22-non-functional-requirements.md](22-non-functional-requirements.md)).

## 6. Deferred items

Comment edit history (keep last-edited timestamp only in MVP), per-field edit attribution beyond latest, point-in-time
entity reconstruction.
