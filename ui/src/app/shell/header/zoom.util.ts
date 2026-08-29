export const ZOOM_VALUES = [25, 33, 50, 67, 75, 80, 90, 100, 110, 125, 150, 175, 200, 250, 300, 400, 500] as const;

export function getNextZoom(current: number, direction: 'in' | 'out'): number {
  const idx = ZOOM_VALUES.indexOf(current as (typeof ZOOM_VALUES)[number]);

  if (idx === -1) return 100;

  const next = direction === 'in' ? idx + 1 : idx - 1;

  return ZOOM_VALUES[Math.max(0, Math.min(ZOOM_VALUES.length - 1, next))] ?? 100;
}
