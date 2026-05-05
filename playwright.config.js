import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    headless: true,
  },
  projects: [
    {
      name: 'fixtures-chromium',
      testMatch: /fixtures\/.*\.spec\.js$/,
      use: { ...devices['Desktop Chrome'] },
      timeout: 15_000,
    },
    {
      name: 'fixtures-webkit',
      testMatch: /fixtures\/.*\.spec\.js$/,
      use: { ...devices['Desktop Safari'], browserName: 'webkit' },
      timeout: 15_000,
    },
    {
      name: 'live',
      testMatch: /live\/.*\.spec\.js$/,
      use: { ...devices['Desktop Chrome'] },
      timeout: 60_000,
      retries: 2,
    },
    {
      name: 'live-webkit',
      testMatch: /live\/.*\.spec\.js$/,
      use: { ...devices['Desktop Safari'], browserName: 'webkit' },
      timeout: 60_000,
      retries: 2,
    },
  ],
});
