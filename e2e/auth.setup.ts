import { test as setup, expect } from '@playwright/test';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const AUTH_FILE = join(__dirname, '.auth/owner.json');

setup('authenticate as owner', async ({ page }) => {
  const email = process.env.E2E_OWNER_EMAIL!;
  const password = process.env.E2E_OWNER_PASSWORD!;

  if (!email || !password) {
    throw new Error('E2E_OWNER_EMAIL y E2E_OWNER_PASSWORD deben estar en .env.e2e');
  }

  await page.goto('/login');
  await expect(page.getByTestId('input-email')).toBeVisible({ timeout: 15_000 });

  await page.getByTestId('input-email').fill(email);
  await page.getByTestId('input-password').fill(password);
  await page.getByTestId('btn-login').click();

  await page.waitForURL('**/app', { timeout: 20_000 });
  await expect(page.getByTestId('dashboard')).toBeVisible({ timeout: 10_000 });

  await page.context().storageState({ path: AUTH_FILE });
});
