import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
  },
  projects: [
    // The keyboard game, on a computer.
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /touch\.spec\.ts/,
    },
    // The touch game, on a real phone screen size with real touch events.
    // Landscape, because that's how the game asks to be held.
    {
      name: 'phone',
      use: { ...devices['Pixel 7 landscape'] },
      testMatch: /touch\.spec\.ts/,
    },
  ],
  webServer: {
    command: 'pnpm run build && pnpm run preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
