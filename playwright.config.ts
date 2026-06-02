import { defineConfig, devices } from "@playwright/test";

// Smoke E2E for the demo experience. The app is served via `next start` (a real
// production build) in DEMO mode, so no Supabase project is required.
const PORT = 3413;
const BASE_URL = `http://localhost:${PORT}`;

const DEMO_ENV = {
  NEXT_PUBLIC_DEMO_MODE: "true",
  NEXT_PUBLIC_APP_URL: BASE_URL,
  NEXT_PUBLIC_SUPABASE_URL: "https://placeholder.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "placeholder-anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "placeholder-service-role-key",
  ESCROW_PROVIDER_API_KEY: "placeholder-provider-key",
  ESCROW_PROVIDER_WEBHOOK_SECRET: "placeholder-webhook-secret",
};

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run start -- -p ${PORT}`,
    url: BASE_URL,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    env: DEMO_ENV,
  },
});
