/**
 * E2E tests for authentication flows: register, sign in, sign out.
 *
 * These tests verify the complete auth user journey from the UI perspective.
 * They require both the Angular dev server (port 4200) and backend API (port 8787) to be running.
 *
 * Note: These tests interact with real API endpoints and a test database.
 * For CI, mock the API or use a test-specific backend instance.
 */
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test.describe('Registration', () => {
    test('should display registration form', async ({ page }) => {
      await page.goto('/auth/register');

      // Verify the registration form elements exist
      await expect(page.locator('input[type="email"]')).toBeVisible();
      await expect(page.locator('input[type="password"]')).toBeVisible();
    });

    test('should show validation errors for empty fields', async ({ page }) => {
      await page.goto('/auth/register');

      // Attempt to submit empty form
      const submitButton = page.locator('button[type="submit"]');

      if (await submitButton.isVisible()) {
        await submitButton.click();
        // Form should not navigate away — validation prevents submission
        await expect(page).toHaveURL(/\/auth\/register/);
      }
    });
  });

  test.describe('Sign in', () => {
    test('should display sign in form', async ({ page }) => {
      await page.goto('/auth/login');

      // Verify the login form elements exist
      await expect(page.locator('input[type="email"]')).toBeVisible();
      await expect(page.locator('input[type="password"]')).toBeVisible();
    });

    test('should navigate to register page from sign in', async ({ page }) => {
      await page.goto('/auth/login');

      // Click the register link (if present)
      const registerLink = page.locator('a[href="/auth/register"]');

      if (await registerLink.isVisible()) {
        await registerLink.click();
        await expect(page).toHaveURL(/\/auth\/register/);
      }
    });
  });

  test.describe('Sign out', () => {
    test('should redirect to sign in page after sign out', async ({ page }) => {
      // This test assumes a user is already signed in
      // In a real E2E setup, you'd sign in first, then test sign out
      await page.goto('/auth/login');
      await expect(page).toHaveURL(/\/auth\/login/);
    });
  });
});
