/**
 * State for expandable / toggleable UI elements (sheets, dialogs, collapsibles).
 */

export const ExpandState = {
  Open: 'open',
  Closed: 'closed',
} as const;

export type ExpandState = (typeof ExpandState)[keyof typeof ExpandState];
