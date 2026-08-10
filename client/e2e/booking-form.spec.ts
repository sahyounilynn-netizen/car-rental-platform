import { expect, request as pwRequest, test } from "@playwright/test";
import type { APIRequestContext, Page } from "@playwright/test";

// Browser-driven coverage of the booking form inside BrowsePage (Stage 2.2).
// Requires the dev servers to already be running: `npm run dev:server`
// (http://localhost:4000) and `npm run dev:client` (http://localhost:5173).
// Run with `npm run test:e2e` (whole e2e/ dir) or
// `npx playwright test e2e/booking-form.spec.ts` (this file only) from client/.
//
// Must match SessionProvider's localStorage key exactly, since this suite
// authenticates by seeding the token directly rather than driving the login
// form (that flow is already covered by auth-panel.spec.ts, and re-driving
// it here would burn more of the server's 5-signups-per-15-minutes budget
// than necessary).
const TOKEN_STORAGE_KEY = "car-rental-access-token";

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
  const json = await res.json();
  return { name, email, password: PASSWORD, accessToken: json.accessToken as string };
}

// Reuses an existing bookable car if the dev DB already has one (it does, as
// of earlier verification passes against this environment), instead of
// spending another signup on a throwaway shop/admin every run. Falls back to
// creating one only if none exists.
async function getOrCreateBookableCar(api: APIRequestContext) {
  const existing = await api.get(`${API_BASE}/cars?isBookableOnline=true&page=1&limit=1`);
  const existingJson = await existing.json();
  if (existingJson.items?.[0]) {
    return existingJson.items[0].id as string;
  }

  const adminSignup = await api.post(`${API_BASE}/auth/signup`, {
    data: {
      name: "Booking Fixture Admin",
      email: uniqueEmail("booking-admin"),
      password: PASSWORD,
      asShop: true,
      shopName: `Booking Fixture Shop ${Date.now()}`,
    },
  });
  const adminJson = await adminSignup.json();
  const adminToken: string = adminJson.accessToken;

  const brandsRes = await api.get(`${API_BASE}/cars/brands`);
  const brandsJson = await brandsRes.json();
  const brandId: string = brandsJson.brands[0].id;

  const carRes = await api.post(`${API_BASE}/cars`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: {
      brandId,
      type: "SEDAN",
      model: `Booking Fixture ${Date.now()}`,
      year: 2023,
      pricePerDay: 40,
      minRentalDays: 1,
      isBookableOnline: true,
    },
  });
  const carJson = await carRes.json();
  return carJson.car.id as string;
}

function toISODate(date: Date) {
  return date.toISOString().slice(0, 10);
}

// Spreads bookings across a wide, seed-varying future window so repeated
// runs (or re-runs in the same session) never collide with a prior run's
// booking and trip the server's overlap check.
function futureDateRange(seed: number) {
  const startOffsetDays = 30 + (seed % 300);
  const start = toISODate(new Date(Date.now() + startOffsetDays * 86400000));
  const end = toISODate(new Date(Date.now() + (startOffsetDays + 2) * 86400000));
  return { start, end };
}

let userToken: string;
let carId: string;

test.beforeAll(async () => {
  const api = await pwRequest.newContext();
  const user = await createUser(api, "booking-user");
  userToken = user.accessToken;
  carId = await getOrCreateBookableCar(api);
  await api.dispose();
});

async function gotoBookingForm(page: Page) {
  await page.addInitScript(
    ({ key, token }) => {
      window.localStorage.setItem(key, token);
    },
    { key: TOKEN_STORAGE_KEY, token: userToken },
  );
  await page.goto(`/?car=${carId}`);
  await expect(page.getByText("Create booking")).toBeVisible();
}

test.describe("Booking form", () => {
  test("valid booking succeeds, is persisted, and resets the form (existing success behavior)", async ({
    page,
    request,
  }) => {
    await gotoBookingForm(page);
    const { start, end } = futureDateRange(Date.now());

    await page.getByLabel("Start date").fill(start);
    await page.getByLabel("End date").fill(end);
    await page.getByRole("button", { name: "Book this car" }).click();

    // Existing success behavior: bookingForm.reset() clears both fields,
    // and no error Alert is shown (the app has no success toast to check).
    await expect(page.getByLabel("Start date")).toHaveValue("");
    await expect(page.getByLabel("End date")).toHaveValue("");
    await expect(page.getByRole("alert")).toHaveCount(0);

    // The app shows no success confirmation of its own, so confirm the
    // booking actually landed via the same endpoint MyBookingsPage reads.
    const myBookings = await request.get(`${API_BASE}/bookings/me`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const json = await myBookings.json();
    type BookingSummary = { startDate: string; endDate: string; carId: string };
    const created = (json.items as BookingSummary[]).find(
      (b) => b.carId === carId && b.startDate.startsWith(start) && b.endDate.startsWith(end),
    );
    expect(created).toBeTruthy();
  });

  test("invalid date range shows a validation error and fires no request", async ({ page }) => {
    await gotoBookingForm(page);
    const { start } = futureDateRange(Date.now());

    let bookingRequestFired = false;
    page.on("request", (req) => {
      if (req.method() === "POST" && req.url().includes("/api/bookings")) bookingRequestFired = true;
    });

    await page.getByLabel("Start date").fill(start);
    await page.getByLabel("End date").fill(start); // same day => not after startDate
    await page.getByRole("button", { name: "Book this car" }).click();

    await expect(page.getByText("endDate must be after startDate")).toBeVisible();
    await page.waitForTimeout(300);
    expect(bookingRequestFired).toBe(false);
  });

  test("missing required fields show inline errors and fire no request", async ({ page }) => {
    await gotoBookingForm(page);

    let bookingRequestFired = false;
    page.on("request", (req) => {
      if (req.method() === "POST" && req.url().includes("/api/bookings")) bookingRequestFired = true;
    });

    // Both date fields left blank.
    await page.getByRole("button", { name: "Book this car" }).click();

    await expect(page.getByText("Start date is required")).toBeVisible();
    await expect(page.getByText("End date is required")).toBeVisible();
    await page.waitForTimeout(300);
    expect(bookingRequestFired).toBe(false);
  });
});
