/**
 * E2E tests for task CRUD on the task table.
 *
 * Two suites:
 * - "Task CRUD (self-contained)" builds its own user → workspace → project
 *   chain, so it works against any database.
 * - "Task CRUD (seeded)" runs against a seeded project configured via the
 *   E2E_TENANT_SLUG and E2E_PROJECT_KEY environment variables and is skipped
 *   when they are not set.
 *
 * Requires: Angular dev server (port 4200) + backend API (port 8787).
 */
import { test, expect, type Page } from '@playwright/test';
import { registerUser, uniqueEmail } from './helpers';

/** process.env without @types/node — the e2e tsconfig has no node types. */
const env = ((globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {}) as Record<
  string,
  string | undefined
>;
const SEEDED_TENANT_SLUG = env['E2E_TENANT_SLUG'];
const SEEDED_PROJECT_KEY = env['E2E_PROJECT_KEY'];

/** Register → create workspace → create project → open the task table. */
async function setupProjectAndOpenTaskTable(page: Page): Promise<{ slug: string; projectKey: string }> {
  await registerUser(page, uniqueEmail('task'));
  await page.goto('/workspace/create');

  await page.getByPlaceholder('My Workspace').fill(`E2E Tasks WS ${Date.now()}`);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/w\//, { timeout: 10_000 });

  const slug = page.url().split('/w/')[1].split('/')[0];

  await page
    .getByRole('button', { name: /Create Project/i })
    .first()
    .click();

  const dialog = page.getByRole('dialog');

  await dialog.locator('input[type="text"]').first().fill(`E2E Task Project ${Date.now()}`);
  await dialog.getByRole('button', { name: /Create/i }).click();
  await expect(page).toHaveURL(/\/projects\//, { timeout: 10_000 });

  const projectKey = page.url().split('/projects/')[1].split('/')[0];

  await page.goto(`/w/${slug}/projects/${projectKey}/tasks`);

  return { slug, projectKey };
}

/** Create a task through the /tasks/new form and submit it. */
async function createTask(page: Page, title: string): Promise<void> {
  await page.getByRole('button', { name: /New Task/i }).click();
  await expect(page).toHaveURL(/\/tasks\/new/, { timeout: 10_000 });

  await page.getByPlaceholder('Short, descriptive summary').fill(title);
  await page.locator('button[type="submit"]').click();

  // Successful creation navigates away from the form (task detail or table)
  await expect(page).not.toHaveURL(/\/tasks\/new/, { timeout: 10_000 });
}

test.describe('Task CRUD (self-contained)', () => {
  test('task table shows the New Task button for users who can create tasks', async ({ page }) => {
    await setupProjectAndOpenTaskTable(page);

    await expect(page.getByRole('button', { name: /New Task/i })).toBeVisible();
  });

  test('creates a task and it appears in the task table', async ({ page }) => {
    await setupProjectAndOpenTaskTable(page);

    const title = `E2E Task ${Date.now()}`;

    await createTask(page, title);

    // Back on the table, the new task is listed
    await page.goto(page.url().split('/tasks/')[0] + '/tasks');
    await expect(page.getByText(title).first()).toBeVisible({ timeout: 10_000 });
  });

  test('task creation form requires a title', async ({ page }) => {
    await setupProjectAndOpenTaskTable(page);

    await page.getByRole('button', { name: /New Task/i }).click();
    await expect(page).toHaveURL(/\/tasks\/new/);

    // Submitting without a title keeps the user on the form (validation)
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/tasks\/new/);
  });

  test('created task opens in the task detail view', async ({ page }) => {
    await setupProjectAndOpenTaskTable(page);

    const title = `E2E Detail ${Date.now()}`;

    await createTask(page, title);

    // After creation we land on the task detail page showing the title
    await expect(page.getByText(title).first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Task CRUD (seeded)', () => {
  test.skip(
    !SEEDED_TENANT_SLUG || !SEEDED_PROJECT_KEY,
    'Set E2E_TENANT_SLUG and E2E_PROJECT_KEY to run against a seeded DB',
  );

  test('task table loads for the seeded project', async ({ page }) => {
    await page.goto(`/w/${SEEDED_TENANT_SLUG}/projects/${SEEDED_PROJECT_KEY}/tasks`);

    await expect(page.getByRole('button', { name: /New Task/i })).toBeVisible({ timeout: 10_000 });
  });

  test('creates and lists a task in the seeded project', async ({ page }) => {
    // Seeded DB: sign in as the seeded owner (credentials provided via env)
    const email = env['E2E_USER_EMAIL'];
    const password = env['E2E_USER_PASSWORD'];

    test.skip(!email || !password, 'Set E2E_USER_EMAIL and E2E_USER_PASSWORD for authenticated seeded tests');
    if (!email || !password) return; // narrows for TS after test.skip

    await page.goto('/auth/login');
    await page.getByPlaceholder('you@example.com').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.locator('button[type="submit"]').click();
    await expect(page).not.toHaveURL(/\/auth\/login/, { timeout: 10_000 });

    await page.goto(`/w/${SEEDED_TENANT_SLUG}/projects/${SEEDED_PROJECT_KEY}/tasks`);

    const title = `E2E Seeded Task ${Date.now()}`;

    await createTask(page, title);

    await page.goto(page.url().split('/tasks/')[0] + '/tasks');
    await expect(page.getByText(title).first()).toBeVisible({ timeout: 10_000 });
  });
});
