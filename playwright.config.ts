import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: [['list']]
});


