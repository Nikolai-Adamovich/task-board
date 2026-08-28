/**
 * Resolve the board a project link should target: the preferred (default)
 * board when it still exists, else the first board, else null.
 *
 * Shared by the sidebar's reactive `boardId` computed and the keyboard
 * shortcuts' on-demand `b` navigation (P14 item 32 dedup).
 */
export function resolveBoardId(boards: { id: string }[], preferredId: string | null | undefined): string | null {
  if (preferredId && boards.some((b) => b.id === preferredId)) return preferredId;

  return boards[0]?.id ?? null;
}
