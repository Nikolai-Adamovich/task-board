/**
 * Board pagination contract.
 *
 * The board API does NOT accept a client-controlled page size: every board
 * pagination request means exactly {@link BOARD_PAGE_SIZE} cards per column.
 * The server probes one extra document internally (`BOARD_PAGE_SIZE + 1`) to
 * derive `hasMore` without a `countDocuments` query — the probe size never
 * appears in the public API.
 */
export const BOARD_PAGE_SIZE = 50;
