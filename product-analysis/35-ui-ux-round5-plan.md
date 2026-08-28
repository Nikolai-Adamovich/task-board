# 35 — UI/UX Round 5 Plan

Owner feedback list (30 items). Decisions: DEC-054..DEC-056 in [decision-log.md](decision-log.md).

## Findings

- **F-01 (item 1)**: `tenant-home.ts` `projectsResource`/`myTasksResource` use `stream: () => client.list()` with NO
  dependency on `activeTenant` — switching workspace never re-runs the resource (API is re-fired by something else, but
  the resource keeps the old value).
- **F-02 (item 11)**: vendored `hlm-numbered-pagination` hides Previous/Next at the edges
  (`@if (showEdges() && !_isFirstPageActive())`). Always-visible disabled state = small vendored-lib patch (standard
  means, no hacks).
- **F-03 (item 26)**: membership has NO expiresAt field (only invitation TTL). Owner answered: full feature (DEC-055).
- **F-04 (items 28/29)**: `DateFormatPreference` is a 3-value enum (shared constants + Zod + DB). Owner answered:
  free-form validated string (DEC-056). DatePipe + registered Angular locale data gives localized `MMM` names.
- **F-05 (item 12)**: task-table checkbox regression — toggles then immediately unsets. Debug live; suspects:
  selection-clearing fetch effect re-running, or the new `swallowNextClick` one-shot listeners interfering.
- **F-06 (item 13)**: theme CSS is applied only after login (theme loading lives behind auth); must load at app
  bootstrap for the login/landing screens too.
- **F-07 (item 24)**: column chooser is a single popover anchored to the toolbar Columns button; the context-menu path
  opens the same popover → wrong position (and position "sticks" to the toolbar after first use).

## Packages

| ID  | Items   | Scope                                                                                                                                                               |
| --- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | 1, 2, 6 | Tenant-home resources track activeTenant; project-overview cards equal height; description textarea 3 rows                                                          |
| P2  | 3, 5    | 120-char description limits (create workspace + project), UI maxlength + Zod (shared+server)                                                                        |
| P3  | 4a      | Workspace settings: edit description; "Tenant Settings"→"Workspace Settings"; UI wording tenant→workspace                                                           |
| P4  | 4b      | URL /t/ → /w/ (+ redirect /t/** → /w/**), routes/guards/links/e2e                                                                                                   |
| P5  | 7, 8    | Remove body-spacer rows + dead TS (task-table, member-table); members table full height like task-table                                                             |
| P6  | 9       | Sidebar: square footer toggle bottom-right w/ 16px icon + always-tooltip; hover highlight; visible active state (esp. collapsed); rail stays                        |
| P7  | 10, 11  | project-switcher "+ Create Project" (permission-gated); pagination Prev/Next always visible, disabled at edges                                                      |
| P8  | 12, 13  | Checkbox regression fix (live debug); theme load before login                                                                                                       |
| P9  | 24, 25  | Column chooser opens near cursor from context menu; Select all; dialog-style header with x                                                                          |
| P10 | 26      | Member expiration: server expiresAt + auto-revoke (ACCESS_REVOKED, restorable, Owner forbidden) + UI edit dialog (name/email/role/expiration) + table column        |
| P11 | 27, 30  | Priority labels translated in table cells + board columns; shortcuts dialog merged help row                                                                         |
| P12 | 28, 29  | Date-format: free-form validated format (shared+server+UI), preset quick options, localized MMM via Angular locale data; date filter trigger uses preference format |
| P13 | 31      | Hotkeys: uppercase C; m user menu, w workspace switcher, p project switcher, t /tasks, b board, x toggle sidebar                                                    |
| P14 | 32      | Dead code, duplication, code smells; bundle-size audit with before/after per fix; @defer (on idle(1000)) where it wins                                              |
| P15 | 33      | 10+ standalone landing variants in `landings/` (isolated, external images, no app integration)                                                                      |

## Verification

Gate after each package: `npm run typecheck && npm test && npm run lint`. Final live QA round delegated to a subagent
(Playwright policy in AGENTS.md).
