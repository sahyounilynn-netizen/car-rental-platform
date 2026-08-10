import { expect, request as pwRequest, test } from "@playwright/test";
import type { APIRequestContext, Page } from "@playwright/test";

// Browser-driven coverage of AuthPanel (Stage 2.1). Requires the dev servers
// to already be running: `npm run dev:server` (http://localhost:4000) and
// `npm run dev:client` (http://localhost:5173). Run with `npm run test:e2e`
// from client/.
//
// The server rate-limits POST /api/auth/signup to 5 per 15 minutes per IP
// (see server/src/middlewares/rateLimit.ts). Tests below share a single
// pre-created fixture account for every scenario that just needs *some*
// existing account (login, invalid login, mode toggle, duplicate-email),
// so this suite only ever performs ~4 real signups per run.

const API_BASE = "http://localhost:4000/api";
const PASSWORD = "TestPass123";

function uniqueEmail(label: string) {
  return `pw.${label}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.com`;
}

async function createUser(api: APIRequestContext, label: string) {
  const email = uniqueEmail(label);
  const name = `Playwright ${label}`;
  const res = await api.post(`${API_BASE}/auth/signup`, {
    data: { name, email, password: PASSWORD },
  });
  if (!res.ok()) {
    throw new Error(`Fixture signup failed (${res.status()}): ${await res.text()}`);
  }
  return { name, email, password: PASSWORD };
}

async function openSignup(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Need an account?" }).click();
}

const HOME_URL = /^http:\/\/localhost:5173\/(\?.*)?$/;

let sharedUser: { name: string; email: string; password: string };

test.beforeAll(async () => {
  const api = await pwRequest.newContext();
  sharedUser = await createUser(api, "shared");
  await api.dispose();
});

test.describe("AuthPanel", () => {
  test("valid login redirects and shows the logged-in user", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Email").fill(sharedUser.email);
    await page.getByLabel("Password").fill(sharedUser.password);
    await page.getByRole("button", { name: "Login" }).click();

    await expect(page).toHaveURL(HOME_URL);
    await expect(page.getByText(sharedUser.name)).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
  });

  test("invalid login (wrong password) shows the Alert error banner", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Email").fill(sharedUser.email);
    await page.getByLabel("Password").fill("WrongPassword1");
    await page.getByRole("button", { name: "Login" }).click();

    const alert = page.getByRole("alert");
    await expect(alert).toBeVisible();
    await expect(alert).toContainText(/invalid/i);
    // API call failed, not client validation — the values should stay put.
    await expect(page.getByLabel("Email")).toHaveValue(sharedUser.email);
  });

  test("valid signup as USER", async ({ page }) => {
    await openSignup(page);
    const email = uniqueEmail("signup-user");

    await page.getByLabel("Name", { exact: true }).fill("Playwright New User");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page).toHaveURL(HOME_URL);
    await expect(page.getByText("Playwright New User")).toBeVisible();
    await expect(page.getByRole("link", { name: "Favorites" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Inventory" })).toHaveCount(0);
  });

  test("valid signup as ADMIN/shop reveals and requires the Shop name field", async ({ page }) => {
    await openSignup(page);
    const email = uniqueEmail("signup-admin");

    await expect(page.getByLabel("Shop name")).toHaveCount(0);
    await page.getByLabel("Sign up as a shop admin").check();
    await expect(page.getByLabel("Shop name")).toBeVisible();

    await page.getByLabel("Name", { exact: true }).fill("Playwright Admin");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByLabel("Shop name").fill("Playwright Shop");
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page).toHaveURL(HOME_URL);
    await expect(page.getByRole("link", { name: "Inventory" })).toBeVisible();
  });

  test("client-side validation: weak password, short name, missing shopName, malformed email", async ({ page }) => {
    await openSignup(page);

    let signupRequestFired = false;
    page.on("request", (req) => {
      if (req.url().includes("/api/auth/signup")) signupRequestFired = true;
    });

    await page.getByLabel("Name", { exact: true }).fill("A");
    await page.getByLabel("Email").fill("not-an-email");
    await page.getByLabel("Password").fill("test1234"); // no uppercase
    await page.getByLabel("Sign up as a shop admin").check();
    // Shop name deliberately left blank
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page.getByText("Name must be at least 2 characters")).toBeVisible();
    await expect(page.getByText("Invalid email address")).toBeVisible();
    await expect(page.getByText("Password must contain an uppercase letter")).toBeVisible();
    await expect(page.getByText("shopName is required when signing up as a shop")).toBeVisible();

    await page.waitForTimeout(300);
    expect(signupRequestFired).toBe(false);
  });

  test("empty-field submit shows inline errors and fires no network request", async ({ page }) => {
    await page.goto("/");

    let authSubmitFired = false;
    page.on("request", (req) => {
      const url = req.url();
      // Deliberately excludes /api/auth/refresh, which SessionProvider always
      // fires once on mount regardless of this form — not what's under test.
      if (url.includes("/api/auth/login") || url.includes("/api/auth/signup")) {
        authSubmitFired = true;
      }
    });

    await page.getByRole("button", { name: "Login" }).click();
    await page.waitForTimeout(300);

    await expect(page.getByText("Invalid email address")).toBeVisible();
    await expect(page.getByText("Password is required")).toBeVisible();
    expect(authSubmitFired).toBe(false);
  });

  test("login/signup mode toggle preserves the Email value and clears the error banner", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Email").fill(sharedUser.email);
    await page.getByLabel("Password").fill("WrongPassword1");
    await page.getByRole("button", { name: "Login" }).click();
    await expect(page.getByRole("alert")).toBeVisible();

    await page.getByRole("button", { name: "Need an account?" }).click();
    await expect(page.getByLabel("Email")).toHaveValue(sharedUser.email);
    await expect(page.getByRole("alert")).toHaveCount(0);
  });

  test("signup with an already-registered email shows the server's error via Alert", async ({ page }) => {
    await openSignup(page);
    await page.getByLabel("Name", { exact: true }).fill("Duplicate Test");
    await page.getByLabel("Email").fill(sharedUser.email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();

    const alert = page.getByRole("alert");
    await expect(alert).toBeVisible();
    await expect(alert).toContainText(/already exists/i);
  });
});
