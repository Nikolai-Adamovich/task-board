/**
 * E2E tests for the authentication flows: registration, sign in, sign out.
 *
 * These tests exercise the real register/login forms (Signal Forms + Spartan
 * Helm fields) against the running backend. Each run registers a unique user
 * so the suite is re-runnable against a shared database.
 *
 * Requires: Angular dev server (port 4200) + backend API (port 8787).
 */
import { test, expect } from '@playwright/test';
import { registerUser, loginUser, logoutUser, uniqueEmail, TEST_PASSWORD } from './helpers';

test.describe('Authentication', () => {
  test.describe('Registration', () => {
    test('shows the registration form with all required fields', async ({ page }) => {
      await page.goto('/auth/register');

      await expect(page.getByPlaceholder('John Doe')).toBeVisible();
      await expect(page.getByPlaceholder('you@example.com')).toBeVisible();
      await expect(page.locator('input[type="password"]')).toHaveCount(2);
      await expect(page.locator('button[type="submit"]')).toBeVisible();
    });

    test('prevents submission when passwords do not match', async ({ page }) => {
      await page.goto('/auth/register');

      await page.getByPlaceholder('John Doe').fill('E2E User');
      await page.getByPlaceholder('you@example.com').fill(uniqueEmail('mismatch'));
      await page.locator('input[type="password"]').nth(0).fill(TEST_PASSWORD);
      await page.locator('input[type="password"]').nth(1).fill('Different123!');
      await page.locator('button[type="submit"]').click();

      // Validation keeps the user on the register page
      await expect(page).toHaveURL(/\/auth\/register/);
    });

    test('registers a new user and lands on the authenticated area', async ({ page }) => {
      const email = uniqueEmail('register');

      await registerUser(page, email);

      // Authenticated users leave the auth section (dashboard or workspace creation)
      await expect(page).not.toHaveURL(/\/auth\//);
    });
  });

  test.describe('Sign in', () => {
    test('shows the sign in form', async ({ page }) => {
      await page.goto('/auth/login');

      await expect(page.getByPlaceholder('you@example.com')).toBeVisible();
      await expect(page.locator('input[type="password"]')).toBeVisible();
      await expect(page.locator('button[type="submit"]')).toBeVisible();
    });

    test('rejects a wrong password with a visible error', async ({ page }) => {
      const email = uniqueEmail('badlogin');

      await registerUser(page, email);
      await logoutUser(page);

      await page.goto('/auth/login');
      await page.getByPlaceholder('you@example.com').fill(email);
      await page.locator('input[type="password"]').fill('WrongPassword123!');
      await page.locator('button[type="submit"]').click();

      // The login card renders a destructive alert on failed sign-in
      await expect(page.locator('hlm-alert, [data-slots="alert"], .destructive').first()).toBeVisible({
        timeout: 10_000,
      });
      await expect(page).toHaveURL(/\/auth\/login/);
    });

    test('signs in a registered user', async ({ page }) => {
      const email = uniqueEmail('login');

      await registerUser(page, email);
      await logoutUser(page);

      await loginUser(page, email);

      await expect(page).not.toHaveURL(/\/auth\//);
    });

    test('navigates to the register page from sign in', async ({ page }) => {
      await page.goto('/auth/login');

      const registerLink = page.locator('a[href="/auth/register"]');

      await expect(registerLink).toBeVisible();
      await registerLink.click();
      await expect(page).toHaveURL(/\/auth\/register/);
    });
  });

  test.describe('Sign out', () => {
    test('returns to the sign in page after sign out', async ({ page }) => {
      const email = uniqueEmail('logout');

      await registerUser(page, email);

      await logoutUser(page);

      await expect(page).toHaveURL(/\/auth\/login/);
    });

    test('protected areas redirect to sign in after sign out', async ({ page }) => {
      const email = uniqueEmail('guard');

      await registerUser(page, email);
      await logoutUser(page);

      // Workspace creation requires auth — the guard must bounce us to login
      await page.goto('/workspace/create');

      await expect(page).toHaveURL(/\/auth\/login/);
    });
  });
});
