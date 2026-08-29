/**
 * E2E tests for project creation and navigation.
 *
 * The project creation modal lives on the tenant home page ("Create Project"
 * CTA opens a dialog with name/key fields). Tests create their own workspace
 * first so they are independent of seeded data.
 *
 * Requires: Angular dev server (port 4200) + backend API (port 8787).
 */
import { test, expect } from '@playwright/test';
import { registerUser, uniqueEmail } from './helpers';

/** Register a user, create a workspace, and land on the tenant home page. */
async function setupWorkspace(page: import('@playwright/test').Page): Promise<string> {
  await registerUser(page, uniqueEmail('project'));
  await page.goto('/workspace/create');

  const workspaceName = `E2E Projects ${Date.now()}`;

  await page.getByPlaceholder('My Workspace').fill(workspaceName);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/w\//, { timeout: 10_000 });

  // Extract the tenant slug from the URL for deep-link navigation
  return page.url().split('/w/')[1].split('/')[0];
}

test.describe('Projects', () => {
  test('tenant home shows the Create Project CTA', async ({ page }) => {
    await setupWorkspace(page);

    await expect(page.getByRole('button', { name: /Create Project/i })).toBeVisible();
  });

  test('creates a project and navigates to its detail page', async ({ page }) => {
    await setupWorkspace(page);

    const projectName = `E2E Project ${Date.now()}`;

    await page
      .getByRole('button', { name: /Create Project/i })
      .first()
      .click();

    // The creation dialog opens — fill the first text input (project name)
    const dialog = page.getByRole('dialog');

    await expect(dialog).toBeVisible();
    await dialog.locator('input[type="text"]').first().fill(projectName);
    await dialog.getByRole('button', { name: /Create/i }).click();

    // Project detail is routed under /w/:slug/projects/:key
    await expect(page).toHaveURL(/\/projects\//, { timeout: 10_000 });
    await expect(page.getByText(projectName).first()).toBeVisible();
  });

  test('project detail exposes the task table route', async ({ page }) => {
    const slug = await setupWorkspace(page);
    const projectName = `E2E Tasks ${Date.now()}`;

    await page
      .getByRole('button', { name: /Create Project/i })
      .first()
      .click();

    const dialog = page.getByRole('dialog');

    await dialog.locator('input[type="text"]').first().fill(projectName);
    await dialog.getByRole('button', { name: /Create/i }).click();
    await expect(page).toHaveURL(/\/projects\//, { timeout: 10_000 });

    const projectKey = page.url().split('/projects/')[1].split('/')[0];

    // The task table route resolves for the created project
    await page.goto(`/w/${slug}/projects/${projectKey}/tasks`);
    await expect(page).toHaveURL(new RegExp(`/w/${slug}/projects/${projectKey}/tasks`));
  });
});
