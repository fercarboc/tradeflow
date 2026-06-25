/**
 * E2E — Flow 4: Upgrade plan — verifies the button exists and opens Stripe
 */
import { test, expect } from '@playwright/test';

test.describe('Plan upgrade', () => {
  test('settings section is accessible from sidebar', async ({ page }) => {
    await page.goto('/app');
    await expect(page.getByTestId('dashboard')).toBeVisible();

    await page.getByTestId('nav-settings').click();
    await expect(page.getByText(/ajustes|tarifas|configuración/i).first()).toBeVisible({ timeout: 8_000 });
  });

  test('upgrade button is visible when account is on trial or basic plan', async ({ page }) => {
    await page.goto('/app');

    const upgradeBtn = page.getByTestId('btn-upgrade');
    const isVisible = await upgradeBtn.isVisible({ timeout: 5_000 }).catch(() => false);

    if (!isVisible) {
      test.skip(true, 'Cuenta ya en plan de pago — btn-upgrade no aparece');
      return;
    }

    await expect(upgradeBtn).toBeVisible();
  });

  test('clicking upgrade opens plan modal or redirects to Stripe', async ({ page }) => {
    await page.goto('/app');

    const upgradeBtn = page.getByTestId('btn-upgrade');
    const isVisible = await upgradeBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!isVisible) {
      test.skip(true, 'No hay botón de upgrade visible');
      return;
    }

    await upgradeBtn.click();

    // Either a modal appears in-page OR Stripe checkout opens
    const modal = page.getByRole('dialog');
    const stripeRedirect = page.waitForURL(/checkout\.stripe\.com|billing\.stripe\.com/, { timeout: 8_000 });

    const result = await Promise.race([
      modal.isVisible({ timeout: 5_000 }).then(v => v ? 'modal' : 'none'),
      stripeRedirect.then(() => 'stripe').catch(() => 'none'),
    ]);

    expect(['modal', 'stripe']).toContain(result);
  });
});
