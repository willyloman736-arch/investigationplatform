import { test, expect } from "@playwright/test";

// These run against a production build in DEMO mode (see playwright.config.ts),
// so the auth guard is bypassed and pages render from mock data.

test.describe("AEGIS smoke (demo mode)", () => {
  test("landing renders the positioning headline and brand", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/AEGIS/);
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
