import { expect, request as pwRequest, test } from "@playwright/test";
import type { APIRequestContext, Page } from "@playwright/test";

// Browser-driven coverage of ShopProfilePage's form (Shop Profile CRUD
// stage). Requires the dev servers to already be running:
// `npm run dev:server` (http://localhost:4000) and `npm run dev:client`
// (http://localhost:5173). Run with `npm run test:e2e` (whole e2e/ dir) or
// `npx playwright test e2e/shop-profile-form.spec.ts` (this file only) from
// client/.
//
// Deliberately does NOT add a second "non-admin can't access" browser test:
// that would cost a second one-time signup, and the ADMIN-only route guard
// here is the same shared RoleRoute component already exercised for
// Inventory in auth-panel.spec.ts ("valid signup as USER" asserts the
// Inventory link is absent) — this route sits inside the identical
// `allow={["ADMIN"]}` block, so that coverage already applies. Role
// enforcement on the API side is covered directly in
// server/src/modules/shops/__tests__/shops.test.ts.
const TOKEN_STORAGE_KEY = "car-rental-access-token";
const API_BASE = "http://localhost:4000/api";
const PASSWORD = "TestPass123";

// Same idempotent-fixture pattern used in profile-form.spec.ts and
// inventory-form.spec.ts: Auth(3) + Booking(1) signups already sit near the
// server's 5-signups-per-15-minutes budget (see playwright.config.ts), so a
// fresh signup per run here would risk pushing combined e2e/ runs over it.
// Log in if the fixture admin/shop already exists, and only ever sign up
// once, the very first time this suite runs against a given database.
const FIXTURE_EMAIL = "e2e.shop-profile.fixture@example.com";
const FIXTURE_NAME = "Shop Profile Fixture Admin";
const FIXTURE_SHOP_NAME = "E2E Shop Profile Fixture Shop";

async function getOrCreateFixtureAdmin(api: APIRequestContext) {
  const loginRes = await api.post(`${API_BASE}/auth/login`, {
    data: { email: FIXTURE_EMAIL, password: PASSWORD },
  });
  if (loginRes.ok()) {
    const json = await loginRes.json();
    return { accessToken: json.accessToken as string };
  }

  const signupRes = await api.post(`${API_BASE}/auth/signup`, {
    data: {
      name: FIXTURE_NAME,
      email: FIXTURE_EMAIL,
      password: PASSWORD,
      asShop: true,
      shopName: FIXTURE_SHOP_NAME,
    },
  });
  if (!signupRes.ok()) {
    throw new Error(`Fixture admin setup failed (${signupRes.status()}): ${await signupRes.text()}`);
  }
  const json = await signupRes.json();
  return { accessToken: json.accessToken as string };
}

let adminToken: string;

test.beforeAll(async () => {
  const api = await pwRequest.newContext();
  const admin = await getOrCreateFixtureAdmin(api);
  adminToken = admin.accessToken;
  await api.dispose();
});

async function gotoShopProfile(page: Page) {
  await page.addInitScript(
    ({ key, token }) => {
      window.localStorage.setItem(key, token);
    },
    { key: TOKEN_STORAGE_KEY, token: adminToken },
  );
  await page.goto("/shop-profile");
  // The heading is present during the initial "Loading…" state too, so wait
  // for a field that only renders once the shop query has resolved and the
  // form is actually interactive.
  await expect(page.getByLabel("Shop name")).toBeVisible();
}

test.describe("Shop profile form", () => {
  test("valid update saves all fields and persists them", async ({ page, request }) => {
    await gotoShopProfile(page);
    const stamp = Date.now();

    await page.getByLabel("Shop name").fill(`Updated Shop ${stamp}`);
    await page.getByLabel("Description").fill("A great place to rent cars.");
    await page.getByLabel("Address").fill("123 Main St");
    await page.getByLabel("Phone").fill("+14155552671");
    await page.getByLabel("Logo URL").fill("https://example.com/logo.png");
    await page.getByRole("button", { name: "Save shop profile" }).click();

    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(page.getByLabel("Shop name")).toHaveValue(`Updated Shop ${stamp}`);

    const me = await request.get(`${API_BASE}/shops/me`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const meJson = await me.json();
    expect(meJson.shop.name).toBe(`Updated Shop ${stamp}`);
    expect(meJson.shop.description).toBe("A great place to rent cars.");
    expect(meJson.shop.address).toBe("123 Main St");
    expect(meJson.shop.phone).toBe("+14155552671");
    expect(meJson.shop.logoUrl).toBe("https://example.com/logo.png");
  });

  test("invalid phone format shows an inline error and fires no request", async ({ page }) => {
    await gotoShopProfile(page);

    let requestFired = false;
    page.on("request", (req) => {
      if (req.method() === "PATCH" && req.url().includes("/api/shops/me")) requestFired = true;
    });

    await page.getByLabel("Phone").fill("abc123");
    await page.getByRole("button", { name: "Save shop profile" }).click();

    await expect(page.getByText("Invalid phone number")).toBeVisible();
    await page.waitForTimeout(300);
    expect(requestFired).toBe(false);
  });

  test("shop name too short shows an inline error and fires no request", async ({ page }) => {
    await gotoShopProfile(page);

    let requestFired = false;
    page.on("request", (req) => {
      if (req.method() === "PATCH" && req.url().includes("/api/shops/me")) requestFired = true;
    });

    await page.getByLabel("Shop name").fill("A");
    await page.getByRole("button", { name: "Save shop profile" }).click();

    await expect(page.getByText("Name must be at least 2 characters")).toBeVisible();
    await page.waitForTimeout(300);
    expect(requestFired).toBe(false);
  });

  test("invalid logo URL shows an inline error and fires no request", async ({ page }) => {
    await gotoShopProfile(page);

    let requestFired = false;
    page.on("request", (req) => {
      if (req.method() === "PATCH" && req.url().includes("/api/shops/me")) requestFired = true;
    });

    await page.getByLabel("Logo URL").fill("not-a-url");
    await page.getByRole("button", { name: "Save shop profile" }).click();

    await expect(page.getByText("logoUrl must be a valid URL")).toBeVisible();
    await page.waitForTimeout(300);
    expect(requestFired).toBe(false);
  });

  test("submitting with no changes succeeds (name is always sent, so the server's at-least-one-field rule can't trigger here)", async ({
    page,
  }) => {
    await gotoShopProfile(page);

    await page.getByRole("button", { name: "Save shop profile" }).click();

    await expect(page.getByRole("alert")).toHaveCount(0);
  });
});
