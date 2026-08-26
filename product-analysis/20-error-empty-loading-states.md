# 20 — Error, Empty & Loading States

Systematic UX specification. Core rule ([UF §39–40]): loading, empty, error, forbidden, not-found, and archived states
must be **visually distinct** — never show "No tasks" while data is still loading, never expose raw exceptions.

---

## 1. State matrix

| State                | Trigger                              | Visual treatment                                                                                        | Actions offered                                   |
| -------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| **Loading**          | Resource request in flight           | Skeleton/spinner in the content region; previous data may stay visible with subtle indicator on refetch | None (non-interactive skeleton)                   |
| **Empty (no data)**  | Successful response, zero items      | Friendly message + primary CTA                                                                          | Create / configure                                |
| **Empty (filtered)** | Filters exclude everything           | "No tasks match your filters" + clear-filters action                                                    | Clear filters                                     |
| **Error**            | Request failed (5xx/network)         | Message + retry; error details logged not shown                                                         | Retry, report                                     |
| **Forbidden**        | Authenticated but lacking permission | Explanation of why access is denied; no partial data leak                                               | Navigate out / request access                     |
| **Not found**        | Resource missing/deleted/no scope    | Neutral "not found"; never confirms existence to unauthorized users                                     | Go back / go home                                 |
| **Archived**         | Entity ARCHIVED                      | Persistent read-only banner; content fully readable                                                     | Restore (admins)                                  |
| **Deletion pending** | DELETION_PENDING                     | Banner with grace-period info; read-only                                                                | Cancel deletion (admins)                          |
| **Conflict**         | Version mismatch                     | Dedicated resolution UI (keep mine / take theirs / cancel)                                              | Per [12-task-workflow.md](12-task-workflow.md) §8 |
| **Validation error** | Client/server validation             | Inline field errors; server errors mapped to fields where possible                                      | Correct input                                     |

## 2. Screen-specific empty states

| Screen                  | Copy pattern                                                   |
| ----------------------- | -------------------------------------------------------------- |
| Tenant dashboard        | "No projects yet. Create your first project." → CTA            |
| Tasks table             | "No tasks found. Create a task or change your filters."        |
| Board (no tasks at all) | Column headers render; guidance card: "Create your first task" |
| Sprints                 | "No sprints yet. Create a future sprint to start planning."    |
| Comments                | "No comments yet. Start the discussion."                       |
| Members                 | "No additional members yet. Invite someone to collaborate."    |
| Saved filters           | "No saved filters yet." (secondary affordance)                 |
| Search results          | Distinguish "no matches" from "no data"                        |

## 3. Loading specifics per surface

- **Board:** per-column skeletons; column counts appear when loaded.
- **Tasks table:** row skeletons preserving column layout.
- **Task detail:** shell renders (key/type once known); field-level spinners during individual saves (inline,
  non-blocking).
- **Optimistic operations:** apply immediately; pending indicator subtle; rollback restores prior state + toast on
  failure.

## 4. Error copy standards

- Human-readable, action-oriented; map API error codes to copy (`TASK_VERSION_CONFLICT` → "The task was modified by
  another user. Reload it and try again."; `PROJECT_ARCHIVED` → "This Project is archived and is read-only.";
  `INVITATION_EXPIRED` → "This invitation has expired…").
- Never raw stack traces/HTTP jargon; log details client-side for support.

## 5. Forbidden vs not-found policy

For resources the user has no scope relationship to, return/render **not-found** (existence-hiding). For resources
in-scope but role-insufficient, render **forbidden** with explanation. This distinction prevents information leakage
([21-security-and-abuse-considerations.md](21-security-and-abuse-considerations.md)).

## 6. Accessibility notes

State changes announced via live regions (loading finished, error occurred); focus management moves to error summaries
on failed submissions; skeletons include `aria-busy`.
