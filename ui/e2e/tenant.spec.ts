/**
 * E2E tests for workspace (tenant) creation.
 *
 * A freshly registered user has no workspace, so the full flow is:
 * register → /workspace/create → fill name/slug → land on the tenant home.
 *
 * Requires: Angular dev server (port 4200) + backend API (port 8787).
 */
import { test, expect } from '@playwright/test';
import { registerUser, uniqueEmail } from './helpers';

test.describe('Workspace creation', () => {
  test('requires authentication', async ({ page }) => {
    await page.goto('/workspace/create');

    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('shows the creation form with name and slug fields', async ({ page }) => {
    const email = uniqueEmail('tenant-form');

    await registerUser(page, email);
    await page.goto('/workspace/create');

    await expect(page.getByPlaceholder('My Workspace')).toBeVisible();
    await expect(page.getByPlaceholder('my-workspace')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('creates a workspace and lands on its home page', async ({ page }) => {
    const email = uniqueEmail('tenant-create');

    await registerUser(page, email);
    await page.goto('/workspace/create');

    const workspaceName = `E2E Workspace ${Date.now()}`;

    await page.getByPlaceholder('My Workspace').fill(workspaceName);
    await page.locator('button[type="submit"]').click();

    // After creation the user is taken into the tenant-scoped area (/w/:slug)
    await expect(page).toHaveURL(/\/w\//, { timeout: 10_000 });
    await expect(page).not.toHaveURL(/\/workspace\/create/);
  });

  test('created workspace appears on the dashboard', async ({ page }) => {
    const email = uniqueEmail('tenant-list');

    await registerUser(page, email);
    await page.goto('/workspace/create');

    const workspaceName = `E2E Listed ${Date.now()}`;

    await page.getByPlaceholder('My Workspace').fill(workspaceName);
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/w\//, { timeout: 10_000 });

    // Back on the root dashboard the workspace is listed/active
    await page.goto('/');
    await expect(page.getByText(workspaceName).first()).toBeVisible({ timeout: 10_000 });
  });
});
