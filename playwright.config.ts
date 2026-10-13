import { defineConfig, devices } from "@playwright/test";

/**
 * E2E-Smoke-Tests gegen den Produktions-Build mit eingespielten Testdaten.
 * Vorher: npm run build && npm run ingest -- testdaten
 * Lokal mit vorinstalliertem Chromium: PLAYWRIGHT_CHROMIUM_EXECUTABLE setzen.
 */
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
    ...(executablePath ? { launchOptions: { executablePath } } : {}),
  },
  projects: [{ name: "handy", use: { ...devices["Pixel 7"], ...(executablePath ? { launchOptions: { executablePath } } : {}) } }],
  webServer: {
    command: "npx next start -p 3100",
    url: "http://localhost:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
