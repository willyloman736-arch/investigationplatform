import { test, expect } from "@playwright/test";

// Runs against a production build in DEMO mode (see playwright.config.ts). In
// demo mode signUp returns success without Supabase, so the one-time recovery
// phrase reveal is exercised end-to-end.

test.describe("Account recovery phrase (demo mode)", () => {
  test("registration reveals a one-time 12-word recovery phrase", async ({
    page,
  }) => {
    await page.goto("/register");

    await page.getByLabel("Full name").fill("Test User");
    await page.getByLabel("Email").fill("test.user@example.com");
    await page.getByLabel("Password").fill("password1234");
    // Account type defaults to "client" via a hidden input — no need to open it.

    await page.getByRole("button", { name: /create account/i }).click();

    // The form is replaced by the reveal step.
    await expect(
      page.getByRole("heading", { name: /save your recovery phrase/i })
    ).toBeVisible();

    // Exactly 12 words are shown.
    const words = page
      .getByRole("list", { name: /your recovery phrase/i })
      .getByRole("listitem");
    await expect(words).toHaveCount(12);

    // Continue stays disabled until the user confirms they saved it.
    const continueBtn = page.getByRole("button", {
      name: /continue to dashboard/i,
    });
    await expect(continueBtn).toBeDisabled();
    await page
      .getByLabel(/i.?ve saved my recovery phrase/i)
      .check();
    await expect(continueBtn).toBeEnabled();
  });

  test("recover page renders the phrase form", async ({ page }) => {
    await page.goto("/recover");
    await expect(
      page.getByRole("heading", { name: /recover your account/i })
    ).toBeVisible();
    await expect(page.getByLabel("Recovery phrase")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /reset password/i })
    ).toBeVisible();
  });
});
