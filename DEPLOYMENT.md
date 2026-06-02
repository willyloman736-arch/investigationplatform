# Digital Asset Investigations — Deployment Guide

A step-by-step checklist to take Digital Asset Investigations from this repo to a working deployment.

> **MVP / compliance reminder:** Digital Asset Investigations does **not** move real money. All fund
> movement is represented as provider-confirmed status changes through the
> abstraction in `lib/escrow/provider.ts` (a mock). **Before accepting real
> deposits you must integrate a licensed escrow/payment provider** — see
> [§5](#5-going-live-with-real-funds).

---

## 0. Prerequisites

- Node.js 18.17+ (20 LTS recommended)
- A [Supabase](https://supabase.com) project (free tier is fine to start)
- A [Vercel](https://vercel.com) account (the repo is already connected)
- For real funds: an account with a **licensed** escrow/payment provider

---

## 1. Supabase setup

1. **Create a project** at app.supabase.com and wait for it to provision.
2. **Run the SQL in order** (SQL Editor → paste → Run), from the `supabase/` folder:
   1. `schema.sql` — enums, tables, indexes, `handle_new_user` trigger
   2. `rls-policies.sql` — Row Level Security + `is_admin` / `has_case_access`
   3. `storage.sql` — the private `evidence` bucket + access policies
   4. `recovery.sql` — `account_recovery` table (service-role-only phrase hashes)
   5. `seed.sql` — *optional* demo data (run **after** creating auth users)
3. **Confirm the `evidence` bucket** exists and is **Private** (Storage tab).
4. **Grab your keys** (Project Settings → API):
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` *(server-only — keep secret)*
5. **Create your first admin:** sign up through the app (or Supabase Auth), then in
   the SQL editor: `update profiles set role = 'admin' where email = 'you@example.com';`

See `supabase/SETUP.md` for more detail.

---

## 2. Local development

```bash
cp .env.example .env.local      # then fill in values
npm install
npm run dev                     # http://localhost:3000
```

`.env.local` ships ready for **demo mode** (`NEXT_PUBLIC_DEMO_MODE=true`): the auth
guard is bypassed and the UI renders from `lib/mock-data.ts`, so you can click
through `/dashboard` and `/admin` without Supabase. Set it to `false` and fill the
real keys to use live auth/data.

> If port 3000 is busy, run `npm run dev -- -p 3411`.

---

## 3. Deploy to Vercel

The repo is connected, so every push to `main` deploys. Configure env vars once:

**Project → Settings → Environment Variables** (Production + Preview):

| Variable | Example / value | Exposure |
| --- | --- | --- |
| `NEXT_PUBLIC_DEMO_MODE` | `false` (prod) / `true` (demo) | public |
| `NEXT_PUBLIC_APP_URL` | `https://your-domain.com` | public |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` | public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ…` | public |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ…` | **server-only** |
| `ESCROW_PROVIDER_API_KEY` | `<provider key>` | **server-only** |
| `ESCROW_PROVIDER_WEBHOOK_SECRET` | `<webhook secret>` | **server-only** |

⚠️ **Never** prefix the bottom three with `NEXT_PUBLIC_` — that would inline them
into the browser bundle. Anything without `NEXT_PUBLIC_` stays server-side.

After setting vars, **redeploy** (Deployments → ⋯ → Redeploy) so they take effect.

### Public demo vs. protected
- The generated `*.vercel.app` URLs may be behind **Deployment Protection**
  (returns HTTP 401 to anonymous visitors). To share a public demo, either map a
  custom domain or disable protection: **Settings → Deployment Protection**.

---

## 4. Post-deploy smoke test

- [ ] `/` and `/how-it-works` load with correct styling
- [ ] `/dashboard` + `/admin` redirect to `/login` when logged out (prod mode)
- [ ] Sign up, then promote yourself to `admin` (SQL above)
- [ ] Admin can create a case and assign Party A / Party B
- [ ] A party can upload evidence (lands in the `evidence` bucket, scoped by case id)
- [ ] Secure chat persists messages
- [ ] Both parties approve → escrow moves to `READY FOR RELEASE`
- [ ] Admin escrow actions require a reason note and appear in the audit log

---

## 5. Going live with real funds

This is the **only** part that touches real money, and it is intentionally a stub.

1. **Pick a licensed provider** (e.g. Stripe Connect/Treasury, Escrow.com, or a
   regional licensed partner). Confirm it covers escrow/hold-and-release for your
   jurisdiction.
2. **Implement** the methods in `lib/escrow/provider.ts` (each marked
   `// TODO(provider)`): `createEscrowAccount`, `getDepositStatus`,
   `confirmDepositFromWebhook`, `checkReleaseEligibility`, `requestRelease`,
   `verifyWebhookSignature`.
3. **Wire the routes** (already structured for it):
   - `app/api/escrow/release/route.ts` — the **only** release trigger; re-checks
     eligibility server-side before calling the provider.
   - `app/api/escrow/webhook/route.ts` — point the provider's webhook here and
     verify the signature with `ESCROW_PROVIDER_WEBHOOK_SECRET`.
4. **Set the webhook URL** in the provider dashboard to
   `https://your-domain.com/api/escrow/webhook`.
5. Keep the invariant: funds are marked `released` **only** after the provider
   confirms (webhook or `requestRelease` returns `confirmed`).

---

## Security checklist

- [ ] `SUPABASE_SERVICE_ROLE_KEY` and `ESCROW_PROVIDER_*` are server-only (no `NEXT_PUBLIC_`)
- [ ] RLS is enabled on every table (`rls-policies.sql` ran without error)
- [ ] `evidence` bucket is **Private**
- [ ] `NEXT_PUBLIC_DEMO_MODE=false` in production
- [ ] No real fund movement until a licensed provider is integrated
- [ ] Security headers are served (configured in `next.config.mjs`)
- [ ] Consider adding a Content-Security-Policy via middleware before launch
- [ ] Rotate any key that was ever pasted outside Vercel/Supabase

---

## Troubleshooting

| Symptom | Likely cause / fix |
| --- | --- |
| `/dashboard` redirects to `/login` even when "logged in" | `NEXT_PUBLIC_DEMO_MODE` unset and no Supabase session — set env vars and redeploy |
| Build fails on Vercel | A `NEXT_PUBLIC_*` var is missing — they're read at build time |
| Uploads fail | `evidence` bucket missing or storage policies not applied (`storage.sql`) |
| "Invalid resolution" on dispute resolve | Ensure you're on the latest commit (enum mapping fix) |
| 401 on `*.vercel.app` | Vercel Deployment Protection is on (expected) |
