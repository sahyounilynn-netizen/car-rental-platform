import { expect, request as pwRequest, test } from "@playwright/test";
import type { APIRequestContext, Page } from "@playwright/test";

// Browser-driven coverage of InventoryPage's add-car form (Stage 2.5).
// Requires the dev servers to already be running: `npm run dev:server`
// (http://localhost:4000) and `npm run dev:client` (http://localhost:5173).
// Run with `npm run test:e2e` (whole e2e/ dir) or
// `npx playwright test e2e/inventory-form.spec.ts` (this file only) from
// client/.
const TOKEN_STORAGE_KEY = "car-rental-access-token";
const API_BASE = "http://localhost:4000/api";
const PASSWORD = "TestPass123";

function unique(label: string) {
  return `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Same idempotent-fixture pattern used in profile-form.spec.ts: Auth(4) +
// Booking(1) signups already sit at the server's 5-signups-per-15-minutes
// budget (see playwright.config.ts), so a fresh signup per run here would
// push combined e2e/ runs over it. Log in if the fixture admin/shop already
// exists, and only ever sign up once, the very first time this suite runs
// against a given database.
const FIXTURE_EMAIL = "e2e.inventory.fixture@example.com";
const FIXTURE_NAME = "Inventory Fixture Admin";
const FIXTURE_SHOP_NAME = "E2E Inventory Fixture Shop";

async function getOrCreateFixtureAdmin(api: APIRequestContext) {
  const loginRes = await api.post(`${API_BASE}/auth/login`, {
    data: { email: FIXTURE_EMAIL, password: PASSWORD },
  });
  if (loginRes.ok()) {
    const json = await loginRes.json();
    return { accessToken: json.accessToken as string, shopId: json.user.shop.id as string };
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
  return { accessToken: json.accessToken as string, shopId: json.user.shop.id as string };
}

let adminToken: string;
let shopId: string;
let brandId: string;

test.beforeAll(async () => {
  const api = await pwRequest.newContext();
  const admin = await getOrCreateFixtureAdmin(api);
  adminToken = admin.accessToken;
  shopId = admin.shopId;

  const brandsRes = await api.get(`${API_BASE}/cars/brands`);
  const brandsJson = await brandsRes.json();
  brandId = brandsJson.brands[0].id as string;

  await api.dispose();
});

async function gotoInventory(page: Page) {
  await page.addInitScript(
    ({ key, token }) => {
      window.localStorage.setItem(key, token);
    },
    { key: TOKEN_STORAGE_KEY, token: adminToken },
  );
  await page.goto("/inventory");
  await expect(page.getByRole("heading", { name: "Add inventory" })).toBeVisible();
}

test.describe("Inventory add-car form", () => {
  test("valid car creation succeeds and appears in inventory", async ({ page, request }) => {
    await gotoInventory(page);
    const model = unique("E2E Test Car");

    await page.getByLabel("Brand").selectOption(brandId);
    await page.getByPlaceholder("Model").fill(model);
    await page.getByPlaceholder("Year").fill(String(new Date().getFullYear()));
    await page.getByPlaceholder("Price/day").fill("55");
    await page.getByPlaceholder("Image URLs, one per line").fill("https://example.com/car.jpg");
    await page.getByRole("button", { name: "Add car" }).click();

    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(page.getByText(model)).toBeVisible();

    const inventory = await request.get(`${API_BASE}/cars?shopId=${shopId}&page=1&limit=50`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const inventoryJson = await inventory.json();
    type CarSummary = { model: string };
    const created = (inventoryJson.items as CarSummary[]).find((c) => c.model === model);
    expect(created).toBeTruthy();
  });

  test("invalid year and price show inline errors and fire no request", async ({ page }) => {
    await gotoInventory(page);

    let requestFired = false;
    page.on("request", (req) => {
      if (req.method() === "POST" && req.url().includes("/api/cars")) requestFired = true;
    });

    await page.getByLabel("Brand").selectOption(brandId);
    await page.getByPlaceholder("Model").fill(unique("Bad Range Car"));
    await page.getByPlaceholder("Year").fill("1800");
    await page.getByPlaceholder("Price/day").fill("0");
    await page.getByRole("button", { name: "Add car" }).click();

    await expect(page.getByText("pricePerDay must be greater than 0")).toBeVisible();
    // Year 1800 fails z.coerce.number().min(1990) — no custom message
    // server-side, so this is zod's own default wording (confirmed directly
    // against the installed zod package, not guessed).
    await expect(page.getByText("Number must be greater than or equal to 1990")).toBeVisible();

    await page.waitForTimeout(300);
    expect(requestFired).toBe(false);
  });

  test("missing required fields (brand, model) show inline errors and fire no request", async ({ page }) => {
    await gotoInventory(page);

    let requestFired = false;
    page.on("request", (req) => {
      if (req.method() === "POST" && req.url().includes("/api/cars")) requestFired = true;
    });

    // Brand left as "Select brand", model left blank.
    await page.getByRole("button", { name: "Add car" }).click();

    await expect(page.getByText("brandId is required")).toBeVisible();
    await expect(page.getByText("Model is required")).toBeVisible();
    await page.waitForTimeout(300);
    expect(requestFired).toBe(false);
  });

  test("more than 10 image URLs shows an inline error and fires no request", async ({ page }) => {
    await gotoInventory(page);

    let requestFired = false;
    page.on("request", (req) => {
      if (req.method() === "POST" && req.url().includes("/api/cars")) requestFired = true;
    });

    await page.getByLabel("Brand").selectOption(brandId);
    await page.getByPlaceholder("Model").fill(unique("Too Many URLs Car"));
    await page.getByPlaceholder("Year").fill(String(new Date().getFullYear()));
    await page.getByPlaceholder("Price/day").fill("55");
    const elevenUrls = Array.from({ length: 11 }, (_, i) => `https://example.com/img${i}.jpg`).join("\n");
    await page.getByPlaceholder("Image URLs, one per line").fill(elevenUrls);
    await page.getByRole("button", { name: "Add car" }).click();

    await expect(page.getByText("Array must contain at most 10 element(s)")).toBeVisible();
    await page.waitForTimeout(300);
    expect(requestFired).toBe(false);
  });

  test("a malformed URL in the list shows an inline error and fires no request", async ({ page }) => {
    await gotoInventory(page);

    let requestFired = false;
    page.on("request", (req) => {
      if (req.method() === "POST" && req.url().includes("/api/cars")) requestFired = true;
    });

    await page.getByLabel("Brand").selectOption(brandId);
    await page.getByPlaceholder("Model").fill(unique("Bad URL Car"));
    await page.getByPlaceholder("Year").fill(String(new Date().getFullYear()));
    await page.getByPlaceholder("Price/day").fill("55");
    await page.getByPlaceholder("Image URLs, one per line").fill("https://example.com/ok.jpg\nnot-a-url");
    await page.getByRole("button", { name: "Add car" }).click();

    await expect(page.getByText("Image URL must be a valid URL")).toBeVisible();
    await page.waitForTimeout(300);
    expect(requestFired).toBe(false);
  });
});
