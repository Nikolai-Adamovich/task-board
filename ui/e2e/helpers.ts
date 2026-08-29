/**
 * Shared helpers for E2E specs.
 *
 * The app's forms are transloco-driven and mostly lack data-testid attributes,
 * so helpers target stable semantic selectors (input types, placeholders,
 * button types) that exist in the component templates.
 */
import { expect, type Page } from '@playwright/test';

export const TEST_PASSWORD = 'Password123!';

/** Unique per-run email so repeated runs against a shared DB don't collide. */
export function uniqueEmail(prefix = 'e2e'): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}@e2e.test`;
}

/** Register a new user through the UI and wait for the post-auth dashboard. */
export async function registerUser(
  page: Page,
  email: string,
  password = TEST_PASSWORD,
  displayName = 'E2E User',
): Promise<void> {
  await page.goto('/auth/register');
  await page.getByPlaceholder('John Doe').fill(displayName);
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.locator('input[type="password"]').nth(0).fill(password);
  await page.locator('input[type="password"]').nth(1).fill(password);
  await page.locator('button[type="submit"]').click();

  // Successful registration signs the user in and leaves the auth pages
  await expect(page).not.toHaveURL(/\/auth\/register/, { timeout: 10_000 });
}

/** Sign in through the UI. */
export async function loginUser(page: Page, email: string, password = TEST_PASSWORD): Promise<void> {
  await page.goto('/auth/login');
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();

  await expect(page).not.toHaveURL(/\/auth\/login/, { timeout: 10_000 });
}

/** Sign out via the header user menu (aria-label "User menu" in the en locale). */
export async function logoutUser(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'User menu' }).click();
  await page.getByRole('button', { name: 'Sign out' }).click();

  await expect(page).toHaveURL(/\/auth\/login/, { timeout: 10_000 });
}
