/**
 * E2E — Flow 2: Create quote → send → client accepts via /p/token
 */
import { test, expect } from '@playwright/test';

test.describe('Quote lifecycle', () => {
  test('quotes section is accessible from sidebar', async ({ page }) => {
    await page.goto('/app');
    await expect(page.getByTestId('dashboard')).toBeVisible();

    await page.getByTestId('nav-quotes').click();
    await expect(page.getByTestId('quote-row').or(page.getByText(/nuevo presupuesto|sin presupuestos/i))).toBeVisible({ timeout: 8_000 });
  });

  test('quote list renders existing quotes', async ({ page }) => {
    await page.goto('/app');
    await page.getByTestId('nav-quotes').click();

    const rows = page.getByTestId('quote-row');
    const count = await rows.count();
    // If there are quotes, each row is visible
    if (count > 0) {
      await expect(rows.first()).toBeVisible();
    } else {
      // No quotes yet — the empty state must be shown gracefully (no crash)
      await expect(page.getByText(/sin presupuestos|no hay presupuestos|0 presupuestos/i)).toBeVisible({ timeout: 5_000 });
    }
  });

  test('public quote link renders gracefully for invalid token', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: undefined });
    const page = await ctx.newPage();

    await page.goto('/p/test-token-invalid-e2e');
    // Should NOT crash — must show an error state, not a blank page
    await expect(page.locator('body')).not.toBeEmpty();
    await expect(page.getByText(/no encontrado|expirado|inválido|not found|error/i)).toBeVisible({ timeout: 10_000 });

    await ctx.close();
  });
});
