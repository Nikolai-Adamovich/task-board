# 15 — Search, Filter & Pagination

---

## 1. Requirements summary

- Tasks (and other large collections) use **server-side pagination** with URL-reproducible state (BR-043).
- Filters combinable across: status, type, priority, assignee, reporter, sprint (incl. "Backlog"), label + free text.
- Sorting on common fields; stable tiebreaker (`_id` or number).
- Saved filters per user+project (unique name within that pair).
- Historical user search must survive User deletion (snapshot fields indexed).

## 2. Search semantics

| Query target                    | Mechanism (MVP)                                                                                   |
| ------------------------------- | ------------------------------------------------------------------------------------------------- |
| Task number / key (`PROJ-123`)  | Exact/prefix match on projectId+number                                                            |
| Title                           | Case-insensitive substring (regex or normalized field)                                            |
| Description                     | Deferred full-text; substring acceptable initially                                                |
| Assignee/Reporter/Creator names | Match against snapshot displayName fields (case-insensitive) — works after User deletion (BR-014) |
| Structured filters              | Indexed equality/in filters                                                                       |

Full text search (Atlas Search or equivalent) is explicitly a future upgrade ([REQ §22]); structured indexes must cover
MVP.

## 3. Example URLs

```
GET /projects/:projectId/tasks?page=345&limit=30&sort=createdAt:desc
GET /projects/:projectId/tasks?status=<id>&status=<id2>&assignee=<id>&page=2&limit=30&sort=priority:asc
GET /projects/:projectId/tasks?q=investigate%20login&sprint=backlog&page=1
GET /projects/:projectId/tasks?label=<id>&type=<bugTypeId>&sort=updatedAt:desc
```

Response envelope:

```json
{ "data": [ ... ],
  "pagination": { "page": 345, "limit": 30, "total": 10352, "totalPages": 346 } }
```

## 4. Sorting

Whitelist sortable fields: `createdAt, updatedAt, number, priority, title`. Format `field:dir`. Always append
deterministic tiebreaker to keep pages stable across requests.

## 5. Indexing implications (aligned with [REQ §35])

Core set backing the above:

- `{projectId:1, number:-1}` — key sort/default listing
- `{projectId:1, createdAt:-1}` / `{projectId:1, updatedAt:-1}` — time sorts
- `{projectId:1, statusId:1, number:-1}` — board columns
- `{projectId:1, sprintId:1, number:-1}` — sprint boards/backlog
- `{projectId:1, assigneeId:1, number:-1}`, `{projectId:1, reporterId:1, number:-1}`
- `{projectId:1, typeId:1, number:-1}`, `{projectId:1, priority:1, number:-1}`
- Snapshot text matching: consider lowercased derived fields (e.g., `assigneeSnapshot.nameLower`) with index if name
  search becomes hot; otherwise collation-based regex is acceptable at MVP scale.

## 6. Board loading vs table pagination

Boards use **per-column windows** (first N cards + total count + "show more") rather than global pagination — the
pattern recommended in issue-tracker design literature
([sujeet.pro design article](https://sujeet.pro/articles/design-issue-tracker)). Tables use page/limit pagination.

## 7. URL state contract

- All table controls write to query params (replaceUrl on change; params are the single source of truth — matches repo
  convention of binding query params to `input()`).
- Invalid page (beyond totalPages after deletions): server clamps to last valid page and response metadata indicates the
  clamp; UI updates URL accordingly instead of erroring ([UF §9.1]).
- Saved filter = named copy of param state; opening one replaces query params.

## 8. Keyboard navigation & autocomplete (UX conventions)

- `/` or `Ctrl+K` focuses search (deferred if costly); filter dropdowns support type-ahead; assignee/reporter pickers
  autocomplete over project members; label picker autocompletes over project labels with case-insensitive matching
  (BR-019).
- Deep links to filtered views are shareable — PM persona's primary collaboration mechanism.

## 9. Deleted-user search guarantee

Because snapshots live denormalized on Task documents, name search requires no joins and keeps working post-deletion.
This is the decisive reason snapshots (not lookups) back historical display/search ([REQ §22], BR-014).
