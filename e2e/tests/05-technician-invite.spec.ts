import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TECH_AUTH_FILE = join(__dirname, '../.auth/tech.json');

async function loginAs(browser: Parameters<typeof test>[1] extends { browser: infer B } ? B : never, email: string, password: string) {
  // @ts-expect-error browser type shortcut
  const ctx = await browser.newContext({ storageState: undefined });
  const page = await ctx.newPage();
  await page.goto('/login');
  await expect(page.getByTestId('input-email')).toBeVisible({ timeout: 10_000 });
  await page.getByTestId('input-email').fill(email);
  await page.getByTestId('input-password').fill(password);
  await page.getByTestId('btn-login').click();
  await page.waitForURL(/\/(app|worker)/, { timeout: 15_000 });
  return { ctx, page };
}

test.describe('Team management', () => {
  test('team section is accessible from sidebar', async ({ page }) => {
    await page.goto('/app');
    await expect(page.getByTestId('dashboard')).toBeVisible();
    await page.getByTestId('nav-equipo').click();
    await expect(page.getByText(/equipo|miembros|trabajadores/i).first()).toBeVisible({ timeout: 8_000 });
  });

  test('invite member form is visible in team section', async ({ page }) => {
    await page.goto('/app');
    await page.getByTestId('nav-equipo').click();
    const inviteBtn = page.getByRole('button', { name: /invitar|añadir miembro|nuevo miembro/i });
    await expect(inviteBtn).toBeVisible({ timeout: 8_000 });
  });
});

test.describe('Technician access restrictions', () => {
  test('tech account can log in', async ({ browser }) => {
    const techEmail = process.env.E2E_TECH_EMAIL;
    const techPassword = process.env.E2E_TECH_PASSWORD;
    if (!techEmail || !techPassword) { test.skip(true, 'Credenciales técnico no definidas'); return; }

    // @ts-expect-error browser type
    const { ctx, page } = await loginAs(browser, techEmail, techPassword);
    await expect(page.getByTestId('dashboard')).toBeVisible({ timeout: 10_000 });
    await ctx.storageState({ path: TECH_AUTH_FILE });
    await ctx.close();
  });

  test('tech does NOT see upgrade or settings', async ({ browser }) => {
    const techEmail = process.env.E2E_TECH_EMAIL;
    const techPassword = process.env.E2E_TECH_PASSWORD;
    if (!techEmail || !techPassword) { test.skip(true, 'Credenciales técnico no definidas'); return; }

    // @ts-expect-error browser type
    const { ctx, page } = await loginAs(browser, techEmail, techPassword);
    await expect(page.getByTestId('btn-upgrade')).not.toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('nav-settings')).not.toBeVisible({ timeout: 3_000 });
    await ctx.close();
  });

  test('/admin is not accessible to tech', async ({ browser }) => {
    const techEmail = process.env.E2E_TECH_EMAIL;
    const techPassword = process.env.E2E_TECH_PASSWORD;
    if (!techEmail || !techPassword) { test.skip(true, 'Credenciales técnico no definidas'); return; }

    // @ts-expect-error browser type
    const { ctx, page } = await loginAs(browser, techEmail, techPassword);
    await page.goto('/admin');
    await expect(page.getByTestId('admin-panel')).not.toBeVisible({ timeout: 5_000 });
    await ctx.close();
  });
});
