# 13 — Board & Kanban Analysis

Research-informed analysis of board UX with recommendations for our implementation.

---

## 1. Established kanban UX patterns (research synthesis)

From [uxpatternsguide kanban pattern](https://uxpatternsguide.com/patterns/kanban-board/),
[uxpatterns.dev](https://uxpatterns.dev/patterns/data-display/kanban-board),
[Atlassian WIP limits](https://www.atlassian.com/agile/kanban/wip-limits),
[21st.dev drag-drop guide](https://21st.dev/blog/react-kanban-drag-drop-components):

1. **Columns represent workflow states** — visible names, counts, empty states; decorative categories are an
   anti-pattern.
2. **Card identity stays stable** across filters/sorts/moves; cards carry enough metadata (key, title, type, priority,
   assignee, labels) for triage without opening.
3. **Movement must be honest**: dropping a card updates the underlying status everywhere (detail view, reports); a board
   whose visual state diverges from stored state destroys trust.
4. **Non-drag move paths required**: keyboard move (focus card → Space/move keys → drop) and/or menu-based "Move to
   column". Drag-only boards exclude keyboard and AT users.
5. **Optimistic updates with rollback**: card moves immediately; failed requests restore position and explain why ("a
   board that silently keeps a card the server rejected is worse than one that felt slow").
6. **Hidden-card disclosure**: when filters hide cards, counts must disclose hidden items so WIP/throughput signals
   aren't misread.
7. **WIP limits** highlight bottlenecks (column turns red at limit per Atlassian convention) — guidance-level, not
   blocking, recommended for later phases.
8. **Responsive fallback**: stacked columns or horizontal scroll with sticky column headers; long-press to drag on
   touch; auto-scroll near edges.

## 2. Our specific model vs common conventions

| Aspect                      | Common convention                                                        | Our decision                                          | Assessment                                                                                                                                                                                       |
| --------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Column ↔ status             | 1:1 mapping (Jira criticized for coupling)                               | N:1 (multi-status columns)                            | Differentiator; resolves documented Jira pain (P4). Drag into multi-status column must prompt (BR-022).                                                                                          |
| Board ownership             | Board belongs to team/project; sprint boards sometimes separate entities | Boards are Project config; sprint scoping is a filter | Cleaner; matches GitHub Projects' saved-view philosophy.                                                                                                                                         |
| Selected board              | Global per project (everyone sees same board)                            | Per-user preference                                   | Personalization without config burden; low cost (one preference doc).                                                                                                                            |
| WIP limits                  | Standard kanban feature                                                  | Deferred                                              | Fine for MVP; add as optional column metadata later.                                                                                                                                             |
| Card ordering within column | LexoRank/fractional indexing in mature tools                             | Deferred — order by updated/number initially          | Documented trade-off in [decision-log.md](decision-log.md) DEC-xx; fractional rank is the known upgrade path ([issue-tracker design article](https://sujeet.pro/articles/design-issue-tracker)). |

## 3. Recommendations for initial implementation

1. **Render**: columns from board config (skipping invalid status references — BR-017), each column header shows name +
   count; cards show key, title, type icon, priority indicator, assignee avatar, labels.
2. **Interaction**: HTML5-pointer drag with optimistic status patch + rollback toast; explicit "move" affordance (card
   menu → choose column/status) as accessible fallback; multi-status destination opens status chooser.
3. **Data loading**: fetch tasks grouped by column statusIds with per-column limit (e.g., first 50) + count + "show
   more"; indexes `{projectId, statusId, number}` back this
   ([15-search-filter-pagination.md](15-search-filter-pagination.md)).
4. **Sprint scoping**: board URL carries `?sprint=`; when present, query filters `sprintId`; absent = whole project.
5. **Filters**: minimal set on board (assignee, label, type, priority) with hidden-count disclosure; full filtering
   lives on the Tasks table.
6. **Empty/loading/error states** per doc 20; loading skeletons per column.
7. **Performance guardrail**: virtualize columns beyond ~200 visible cards (deferred unless needed; noted in NFRs).

## 4. Mobile/responsive behavior

Initial target: usable read + basic moves on tablet/desktop-small; phones get stacked single-column navigation (column
switcher) rather than horizontal scroll of full boards. Full mobile optimization deferred
([22-non-functional-requirements.md](22-non-functional-requirements.md)).

## 5. Explicitly rejected for now

- WIP limit enforcement, swimlanes, cumulative flow diagrams, card cover images, board-level automation rules — all
  roadmap items; none block the core loop.
