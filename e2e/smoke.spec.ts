import { test, expect } from "@playwright/test";

// These run against a production build in DEMO mode (see playwright.config.ts),
// so the auth guard is bypassed and pages render from mock data.

test.describe("Digital Asset Investigations smoke (demo mode)", () => {
  test("landing renders the positioning headline and brand", async ({
    page,
  }) => {
    // domcontentloaded (not full 'load') — the hero video shouldn't gate asserting
    // server-rendered content, and avoids flakiness under parallel workers.
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveTitle(/Digital Asset Investigations/);
    await expect(
      page.getByRole("heading", {
        name: /Secure Escrow & Investigation Management/i,
      })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Start a Project/i }).first()
    ).toBeVisible();
  });

  test("how-it-works shows the escrow steps", async ({ page }) => {
    await page.goto("/how-it-works");
    await expect(page.getByText(/HELD IN ESCROW/i).first()).toBeVisible();
  });

  test("login page shows a sign-in form", async ({ page }) => {
    await page.goto("/login");
    await expect(
      page.getByRole("button", { name: /sign in|log in/i }).first()
    ).toBeVisible();
  });

  test("login button submits and reaches the dashboard (demo)", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("demo@example.com");
    await page.getByLabel("Password").fill("password1234");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("operator login reaches the admin console (demo)", async ({ page }) => {
    await page.goto("/operator");
    await page.getByLabel("Email").fill("operator@example.com");
    await page.getByLabel("Password").fill("password1234");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/admin/);
  });

  test("client dashboard is reachable in demo mode", async ({ page }) => {
    await page.goto("/dashboard");
    // Demo bypass: should NOT redirect to /login.
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("admin command center is reachable in demo mode", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin/);
  });
});
