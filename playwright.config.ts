import { defineConfig, devices } from '@playwright/test';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: resolve(__dirname, '.env.e2e') });

const BASE_URL = process.env.E2E_BASE_URL ?? 'https://trabflow.com';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['html', { outputFolder: 'playwright-report', open: 'never' }], ['list']],
  timeout: 30_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
    // NO storageState aquí — cada proyecto lo define individualmente
  },

  projects: [
    {
      name: 'setup',
      testMatch: '**/auth.setup.ts',
      // Sin storageState — este proyecto ES el que crea el archivo
    },
    {
      name: 'e2e',
      testDir: './e2e/tests',
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/owner.json',
      },
    },
  ],
});
