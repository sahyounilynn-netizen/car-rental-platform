import { defineConfig, devices } from "@playwright/test";

// Run on demand against already-running dev servers:
//   npm run dev:server   (http://localhost:4000)
//   npm run dev:client   (http://localhost:5173)
// then, from client/:
//   npm run test:e2e
//
// Intentionally has no `webServer` block — it does not start or manage the
// dev servers itself, and is not wired into build/lint/CI.
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
