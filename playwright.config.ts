import { defineConfig } from '@playwright/test';

// End-to-end tests run against the production build on the installed Chrome
// (bundled Chromium is not downloaded). Screenshots land in scrollcraft/lab/.
export default defineConfig({
  testDir: './e2e',
  reporter: 'list',
  // Full-page scroll-throughs with axe and pixel sampling on long pages need room.
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:4173',
    channel: 'chrome',
  },
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
  },
});
