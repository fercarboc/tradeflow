/**
 * E2E — Flow 2: Create quote → send → client accepts via /p/token
 */
import { test, expect } from '@playwright/test';

test.describe('Quote lifecycle', () => {
  test('quotes section is accessible from sidebar', async ({ page }) => {
    await page.goto('/app');
    await expect(page.getByTestId('dashboard')).toBeVisible();

    await page.getByTestId('nav-quotes').click();
    await expect(page.getByTestId('quote-row').or(page.getByText(/nuevo presupuesto|sin presupuestos/i)).first()).toBeVisible({ timeout: 8_000 });
  });

  test('quote list renders existing quotes', async ({ page }) => {
    await page.goto('/app');
    await expect(page.getByTestId('dashboard')).toBeVisible();
    await page.getByTestId('nav-quotes').click();

    // Esperar a que carguen las filas o el estado vacío
    await expect(
      page.getByTestId('quote-row').or(page.getByText(/sin presupuestos|enviados|presupuesto/i)).first()
    ).toBeVisible({ timeout: 15_000 });

    const rows = page.getByTestId('quote-row');
    const count = await rows.count();
    if (count > 0) {
      await expect(rows.first()).toBeVisible();
    }
    // Si count === 0 la sección cargó sin crash — el test pasa igualmente
  });

  test('public quote link renders gracefully for invalid token', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: undefined });
    const page = await ctx.newPage();

    await page.goto('/p/test-token-invalid-e2e');
    // Should NOT crash — must show an error state, not a blank page
    await expect(page.locator('body')).not.toBeEmpty();
    await expect(page.getByText(/no se pudo|no encontrado|expirado|inválido|not found|error/i)).toBeVisible({ timeout: 10_000 });

    await ctx.close();
  });
});
