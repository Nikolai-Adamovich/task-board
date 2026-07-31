import { z } from 'zod';

/** UI theme preference */
export const Theme = {
  Light: 'light',
  Dark: 'dark',
} as const;

export type Theme = (typeof Theme)[keyof typeof Theme];
export const ThemeSchema = z.enum(Theme);
export const ThemeValues = Object.values(Theme) as [Theme, ...Theme[]];
