import { test, expect } from '@playwright/test';

test.describe('Auth flow', () => {
  test('dashboard is visible after login', async ({ page }) => {
    await page.goto('/app');
    await expect(page.getByTestId('dashboard')).toBeVisible();
  });

  test('logout returns to login/home page', async ({ browser }) => {
    // Login fresco con tokens nuevos para no invalidar los de owner.json
    const ctx = await browser.newContext({ storageState: undefined });
    const page = await ctx.newPage();

    await page.goto('/login');
    await expect(page.getByTestId('input-email')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('input-email').fill(process.env.E2E_OWNER_EMAIL!);
    await page.getByTestId('input-password').fill(process.env.E2E_OWNER_PASSWORD!);
    await page.getByTestId('btn-login').click();
    await page.waitForURL(/\/app/, { timeout: 20_000 });
    await expect(page.getByTestId('dashboard')).toBeVisible({ timeout: 10_000 });

    await page.getByTestId('btn-logout').click();

    await page.waitForURL(/\/(login|)$/, { timeout: 10_000 });
    await expect(page.getByTestId('dashboard')).not.toBeVisible({ timeout: 5_000 });
    await ctx.close();
  });

  test('wrong credentials shows error message', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: undefined });
    const page = await ctx.newPage();

    await page.goto('/login');
    await expect(page.getByTestId('input-email')).toBeVisible({ timeout: 10_000 });

    await page.getByTestId('input-email').fill('nobody@trabflow.com');
    await page.getByTestId('input-password').fill('wrongpassword');
    await page.getByTestId('btn-login').click();

    await expect(page.getByText(/incorrectos|inválid|credenciales/i)).toBeVisible({ timeout: 8_000 });
    await ctx.close();
  });

  test('password recovery link is visible on login page', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: undefined });
    const page = await ctx.newPage();

    await page.goto('/login');
    await expect(page.getByText(/olvidaste tu contraseña/i)).toBeVisible({ timeout: 10_000 });
    await ctx.close();
  });
});
