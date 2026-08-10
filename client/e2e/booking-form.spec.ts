import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
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

// The bookings API has no cancel/delete endpoint reachable with a plain
// USER token (PATCH /:bookingId/status requires ADMIN + ownership of the
// car's shop, which this suite intentionally doesn't have — see
// getOrCreateBookableCar above), so leftover bookings from earlier runs
// can't be cleaned up. The date window instead needs to be strictly unique
// per invocation.
//
// A pure wall-clock derivation (e.g. elapsed seconds since a fixed anchor,
// used directly as a day offset) was tried and rejected: any granularity
// fine enough to avoid same-session collisions (runs a few tens of seconds
// apart) grows the offset fast enough that, over weeks of real usage
// against this same persistent dev DB, it blows past year 9999 — at which
// point `toISOString()` switches to ISO-8601's extended year format
// ("+054467-11-DD"), which HTML `<input type="date">` rejects outright.
// Confirmed by hitting exactly that failure.
//
// A persisted counter avoids the tradeoff entirely: each invocation gets a
// day strictly greater than every prior invocation's, regardless of how
// much (or how little) real time elapsed between them, so the growth rate
// is bounded by *number of test runs* rather than wall-clock time — even
// tens of thousands of runs stay within a few decades of today.
const OFFSET_FILE = path.join(import.meta.dirname, ".booking-date-offset.txt");
const BASE_OFFSET_DAYS = 1000; // ~2.7 years out — comfortably clear of the old buggy [30, 329]-day fixture range

function nextOffsetDays(): number {
  let current = BASE_OFFSET_DAYS;
  if (existsSync(OFFSET_FILE)) {
    const stored = Number.parseInt(readFileSync(OFFSET_FILE, "utf8").trim(), 10);
    if (Number.isFinite(stored)) current = stored;
  }
  const next = current + 3; // > the 2-day booking span, so consecutive windows never touch
  writeFileSync(OFFSET_FILE, String(next));
  return next;
}

function futureDateRange() {
  const start = new Date(Date.now() + nextOffsetDays() * 86400000);
  const end = new Date(start.getTime() + 2 * 86400000);
  return { start: toISODate(start), end: toISODate(end) };
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
    const { start, end } = futureDateRange();

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
    const { start } = futureDateRange();

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
