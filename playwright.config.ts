import { defineConfig } from '@playwright/test'

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 30_000 },
  reporter: 'list',
  use: {
    channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge',
    headless: true,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'production', use: { baseURL: 'http://127.0.0.1:4173' } },
    { name: 'development', grep: /all image outputs|jpeg same format|fatal engine failure|typography/, use: { baseURL: 'http://127.0.0.1:5174' } },
  ],
  webServer: [
    {
      command: `${npmCommand} run preview -- --host 127.0.0.1 --port 4173 --strictPort`,
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: !process.env.CI,
    },
    {
      command: `${npmCommand} run dev -- --host 127.0.0.1 --port 5174 --strictPort`,
      url: 'http://127.0.0.1:5174',
      reuseExistingServer: !process.env.CI,
    },
  ],
})
