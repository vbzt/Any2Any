import { defineConfig } from '@playwright/test'

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const productionPort = process.env.PLAYWRIGHT_PORT || '4173'
const developmentPort = process.env.PLAYWRIGHT_DEV_PORT || '5174'
const productionURL = `http://127.0.0.1:${productionPort}`
const developmentURL = `http://127.0.0.1:${developmentPort}`

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
    { name: 'production', use: { baseURL: productionURL } },
    { name: 'development', grep: /all image outputs|jpeg same format|fatal engine failure|typography|video optimization/, use: { baseURL: developmentURL } },
  ],
  webServer: [
    {
      command: `${npmCommand} run preview -- --host 127.0.0.1 --port ${productionPort} --strictPort`,
      url: productionURL,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: `${npmCommand} run dev -- --host 127.0.0.1 --port ${developmentPort} --strictPort`,
      url: developmentURL,
      reuseExistingServer: !process.env.CI,
    },
  ],
})
