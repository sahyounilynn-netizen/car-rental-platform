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
  // Auth/booking specs create real accounts against the dev server's
  // 5-signups-per-15-minutes rate limiter (server/src/middlewares/
  // rateLimit.ts). fullyParallel:false only serializes tests *within* a
  // file — across files Playwright still assigned multiple workers, so
  // both suites' signups could race each other and blow the budget faster
  // than running strictly one-at-a-time. Pinning to a single worker fixes
  // that without touching the rate limiter itself.
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
