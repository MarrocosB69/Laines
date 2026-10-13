import { defineConfig, devices } from 'playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173';

export default defineConfig({
  testDir: './tests/browser',
  testMatch: '**/tour-completo.spec.js',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL,
    headless: false,
    trace: 'off',
    screenshot: 'off',
    video: 'off',
    viewport: { width: 1280, height: 800 }
  },
  reporter: [
    ['list'],
    ['json', { outputFile: 'e2e-artifacts/tour-completo.json' }]
  ],
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
});
