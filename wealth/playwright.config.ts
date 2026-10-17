import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  expect: { timeout: 30_000 },
  use: { baseURL: 'http://localhost:4174' },
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4174',
    reuseExistingServer: true,
    timeout: 180_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] } },
    },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
