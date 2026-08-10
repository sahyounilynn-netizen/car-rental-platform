import { expect, request as pwRequest, test } from "@playwright/test";
import type { APIRequestContext, Page } from "@playwright/test";

// Browser-driven coverage of ProfilePage's form (Stage 2.4). Requires the
// dev servers to already be running: `npm run dev:server`
// (http://localhost:4000) and `npm run dev:client` (http://localhost:5173).
// Run with `npm run test:e2e` (whole e2e/ dir) or
// `npx playwright test e2e/profile-form.spec.ts` (this file only) from
// client/.
const TOKEN_STORAGE_KEY = "car-rental-access-token";
const API_BASE = "http://localhost:4000/api";
const PASSWORD = "TestPass123";

// Auth(4) + Booking(1) already use the server's full 5-signups-per-15-min
// budget (see playwright.config.ts). A fresh signup here would push the
// combined e2e/ run to 6 and trip the limiter regardless of worker count —
// confirmed by running the full suite. Rather than touching the other spec
// files or shared config (out of scope for this sub-stage), this fixture is
// idempotent: log in if the account already exists, and only ever sign up
// once, the very first time this suite runs against a given database.
const FIXTURE_EMAIL = "e2e.profile.fixture@example.com";
const FIXTURE_NAME = "Profile Fixture User";

async function getOrCreateFixtureUser(api: APIRequestContext) {
  const loginRes = await api.post(`${API_BASE}/auth/login`, {
    data: { email: FIXTURE_EMAIL, password: PASSWORD },
  });
  if (loginRes.ok()) {
    const json = await loginRes.json();
    return { accessToken: json.accessToken as string };
  }

  const signupRes = await api.post(`${API_BASE}/auth/signup`, {
    data: { name: FIXTURE_NAME, email: FIXTURE_EMAIL, password: PASSWORD },
  });
  if (!signupRes.ok()) {
    throw new Error(`Fixture user setup failed (${signupRes.status()}): ${await signupRes.text()}`);
  }
  const json = await signupRes.json();
  return { accessToken: json.accessToken as string };
}

let userToken: string;

test.beforeAll(async () => {
  const api = await pwRequest.newContext();
  const user = await getOrCreateFixtureUser(api);
  userToken = user.accessToken;
  await api.dispose();
});

async function gotoProfile(page: Page) {
  await page.addInitScript(
    ({ key, token }) => {
      window.localStorage.setItem(key, token);
    },
    { key: TOKEN_STORAGE_KEY, token: userToken },
  );
  await page.goto("/profile");
  await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible();
}

test.describe("Profile form", () => {
  test("valid update — name only", async ({ page, request }) => {
    await gotoProfile(page);

    await page.getByLabel("Name").fill("Updated Name Only");
    await page.getByRole("button", { name: "Save profile" }).click();

    await expect(page.getByRole("alert")).toHaveCount(0);
    // Session context updates on success — header reflects the new name.
    await expect(page.getByText("Updated Name Only")).toBeVisible();

    const me = await request.get(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const meJson = await me.json();
    expect(meJson.user.name).toBe("Updated Name Only");
  });

  test("valid update — phone only", async ({ page, request }) => {
    await gotoProfile(page);

    await page.getByLabel("Phone").fill("+14155552671");
    await page.getByRole("button", { name: "Save profile" }).click();

    await expect(page.getByRole("alert")).toHaveCount(0);

    const me = await request.get(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const meJson = await me.json();
    expect(meJson.user.phone).toBe("+14155552671");
  });

  test("invalid phone format shows an inline error and fires no request", async ({ page }) => {
    await gotoProfile(page);

    let requestFired = false;
    page.on("request", (req) => {
      if (req.method() === "PATCH" && req.url().includes("/api/users/me")) requestFired = true;
    });

    await page.getByLabel("Phone").fill("abc123");
    await page.getByRole("button", { name: "Save profile" }).click();

    await expect(page.getByText("Invalid phone number")).toBeVisible();
    await page.waitForTimeout(300);
    expect(requestFired).toBe(false);
  });

  test("name too short shows an inline error and fires no request", async ({ page }) => {
    await gotoProfile(page);

    let requestFired = false;
    page.on("request", (req) => {
      if (req.method() === "PATCH" && req.url().includes("/api/users/me")) requestFired = true;
    });

    await page.getByLabel("Name").fill("A");
    await page.getByRole("button", { name: "Save profile" }).click();

    await expect(page.getByText("Name must be at least 2 characters")).toBeVisible();
    await page.waitForTimeout(300);
    expect(requestFired).toBe(false);
  });

  // The server's updateProfileSchema rejects a truly empty PATCH body with
  // "At least one field must be provided" — verified directly against the
  // API before writing this test. But this form always sends `name` (it's
  // a required field), so that rule can never actually fire here: an
  // unchanged submit still succeeds, because the payload is never empty.
  test("submitting with no changes succeeds (name is always sent, so the server's at-least-one-field rule can't trigger here)", async ({
    page,
  }) => {
    await gotoProfile(page);

    await page.getByRole("button", { name: "Save profile" }).click();

    await expect(page.getByRole("alert")).toHaveCount(0);
  });
});
