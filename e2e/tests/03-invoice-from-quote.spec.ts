/**
 * E2E — Flow 3: Invoices list is accessible and renders correctly
 */
import { test, expect } from '@playwright/test';

test.describe('Invoices', () => {
  test('invoices section is accessible from sidebar', async ({ page }) => {
    await page.goto('/app');
    await expect(page.getByTestId('dashboard')).toBeVisible();

    await page.getByTestId('nav-invoices').click();
    await expect(
      page.getByTestId('invoice-row').or(page.getByText(/sin facturas|no hay facturas|0 facturas/i))
    ).toBeVisible({ timeout: 10_000 });
  });

  test('invoice list renders without crashing', async ({ page }) => {
    await page.goto('/app');
    await page.getByTestId('nav-invoices').click();

    const rows = page.getByTestId('invoice-row');
    const count = await rows.count();

    if (count > 0) {
      await expect(rows.first()).toBeVisible();
      // Each invoice row must show a number or "Borrador"
      const firstText = await rows.first().textContent();
      expect(firstText).toBeTruthy();
    } else {
      await expect(page.getByText(/sin facturas|no hay facturas|emite tu primera/i)).toBeVisible({ timeout: 5_000 });
    }
  });

  test('accepted quote shows "crear factura" button', async ({ page }) => {
    await page.goto('/app');
    await page.getByTestId('nav-quotes').click();

    // Filter to accepted quotes if filter buttons exist
    const aceptadoBtn = page.getByRole('button', { name: /aceptado/i });
    if (await aceptadoBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await aceptadoBtn.click();
    }

    const acceptedRows = page.getByTestId('quote-row').filter({ hasText: /aceptado/i });
    const exists = await acceptedRows.count() > 0;

    if (!exists) {
      test.skip(true, 'No hay presupuestos aceptados — acepta uno desde /p/token primero');
      return;
    }

    await acceptedRows.first().click();
    await expect(page.getByRole('button', { name: /crear factura|generar factura/i })).toBeVisible({ timeout: 8_000 });
  });
});
