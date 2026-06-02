# AEGIS — Secure Escrow & Investigation Management (MVP)

AEGIS is a trust-heavy platform where clients open investigation/projects, fund
escrow, upload evidence, communicate securely, track escrow status, and release
funds **only** after mutual approval or admin dispute resolution. It is built as
a single, coherent Next.js 14 (App Router) + Supabase codebase, dark-themed by
default, mobile-first, and styled like an institutional fintech product.

> ⚠️ **This is an MVP scaffold.** AEGIS **does not move real money** and performs
> **no internal balance arithmetic**. Every "fund movement" is represented as a
> **provider-confirmed status change** behind a server-side abstraction
> (`lib/escrow/provider.ts`). Before any real value can change hands you **must**
> integrate a **licensed payment/escrow provider** (see
> [Where to integrate a licensed escrow/payment provider](#where-to-integrate-a-licensed-escrowpayment-provider)).

---

## Table of contents

- [Compliance posture](#compliance-posture)
- [Features](#features)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Setup](#setup)
  - [1. Install dependencies](#1-install-dependencies)
  - [2. Environment variables](#2-environment-variables)
  - [3. Supabase database + storage](#3-supabase-database--storage)
  - [4. Run locally](#4-run-locally)
- [Demo mode](#demo-mode)
- [Deploying to Vercel](#deploying-to-vercel)
- [Security notes](#security-notes)
- [Escrow state machine](#escrow-state-machine)
- [Database schema overview](#database-schema-overview)
- [Where to integrate a licensed escrow/payment provider](#where-to-integrate-a-licensed-escrowpayment-provider)
- [Rebranding](#rebranding)
- [Honest-copy policy](#honest-copy-policy)

---

## Compliance posture

AEGIS is designed to be **defensible, not just slick**. The non-negotiable rules
are encoded consistently across the UI and the server:

- **No fake money movement.** The app never moves funds and never computes
  balances. `escrow_contracts` amounts and the `escrow_transactions` ledger only
  **represent** provider-confirmed status. The ledger is **append-only**.
- **Provider-abstracted.** All "money movement" goes through a single server-only
  abstraction, `lib/escrow/provider.ts`. Client code can never trigger a transfer.
- **Provider-confirmed release.** A release is finalized (`escrow_status =
  released`) **only** after the provider confirms — either `requestRelease()`
  returns `"confirmed"` or the webhook (`/api/escrow/webhook`) reports
  `release.confirmed`.
- **Release requires consent.** A release is permitted **only** when both
  `party_a` **and** `party_b` have approved, **or** an admin resolved a dispute
  as *release* and set a release-eligibility reason. Either path sets
  `release_status = eligible` / `escrow_status = ready_for_release`.
- **Admins never move money from the UI.** Admin status overrides require a
  non-empty **reason** and are written to `audit_logs`. The only place a release
  is triggered is the protected server route `POST /api/escrow/release`.
- **Row Level Security on every table.** Clients/counterparties can see only the
  cases they belong to; admins see all. The browser only ever holds the Supabase
  `anon` key, which is safe **because RLS is enabled everywhere**.
- **Server-only secrets.** `SUPABASE_SERVICE_ROLE_KEY` and `ESCROW_PROVIDER_*`
  are never imported into client components. All mutations run through server
  actions or API routes.
- **Append-only audit trail.** Every important action (auth, case lifecycle,
  uploads, messages, approvals, escrow status changes, disputes, releases) writes
  an `audit_logs` row.
- **Honest copy.** We never claim encryption or certifications we do not
  implement. The standard disclaimer is: *"Funds are processed only through
  licensed payment/escrow partners where available."*

---

## Features

**Client / counterparty**
- Landing page and an escrow-transparency **How it works** page.
- Email/password auth (Supabase Auth) with self-service `client` / `counterparty`
  registration. (Admin is provisioned out-of-band — users can never self-assign
  admin.)
- Dashboard overview with headline status summary cards.
- Case list and a per-case workspace with two tabs:
  - **Intake & Case Management** — case summary, contract terms + signature
    state, drag-and-drop **evidence uploader** (type/size validated), uploaded
    files list, and a **Secure Case Channel** chat.
  - **Escrow Ledger** — escrow status, fee breakdown table, the dual-party
    **Approval Panel**, the append-only transaction ledger, and the case audit
    timeline.

**Admin**
- Command center overview.
- Case management: create/assign/manage cases.
- Per-case control surface: contract verification, evidence review, escrow
  ledger, **reason-gated escrow controls**, dispute review, and full audit trail.
- Disputes view.

**Platform**
- Strict escrow state machine with status badges driven by a single config.
- Protected release route and provider webhook handler.
- **Demo mode** so the entire UI is viewable from deterministic mock data without
  Supabase configured.

---

## Tech stack

- **Framework:** Next.js `^14.2` (App Router, Server Components, Server Actions),
  React `^18`, TypeScript `^5` (strict).
- **Styling:** Tailwind CSS `^3.4` with shadcn-style HSL CSS variables,
  `tailwindcss-animate`, `class-variance-authority`, `clsx`, `tailwind-merge`.
  Dark theme by default via `<html className="dark">`. Inter font via
  `next/font/google`.
- **UI primitives:** Radix (`dialog`, `dropdown-menu`, `label`, `separator`,
  `tabs`, `tooltip`, `avatar`, `scroll-area`, `select`, `slot`), `lucide-react`
  icons, `sonner` toasts, `framer-motion` animations.
- **Backend:** Supabase (`@supabase/supabase-js`, `@supabase/ssr`) — Postgres,
  Auth, Storage, Row Level Security.
- **Utilities:** `zod` (validation), `date-fns` (formatting), `react-dropzone`
  (uploads).

Scripts: `dev`, `build`, `start`, `lint`.

---

## Project structure

```text
crpto site/
├─ app/
│  ├─ (auth)/                  # login + register (route group)
│  │  ├─ login/                #   login page + client form
│  │  └─ register/             #   register page + client form
│  ├─ auth/callback/route.ts   # Supabase auth code exchange
│  ├─ admin/                   # admin command center, cases, disputes
│  │  ├─ cases/[caseId]/       #   full per-case control surface
│  │  └─ disputes/
│  ├─ dashboard/               # client/counterparty area
│  │  └─ cases/[caseId]/       #   two-tab case workspace
│  ├─ api/escrow/
│  │  ├─ release/route.ts      # POST — the ONLY place a release is triggered
│  │  └─ webhook/route.ts      # POST — provider webhook (deposit/release confirm)
│  ├─ how-it-works/page.tsx
│  ├─ globals.css              # design tokens (:root + .dark)
│  ├─ layout.tsx               # root layout (dark, Inter, Toaster)
│  └─ page.tsx                 # landing
├─ components/
│  ├─ ui/                      # shadcn-style primitives
│  ├─ shared/                  # Logo, EscrowStatusBadge, AuditLogTimeline, …
│  ├─ marketing/               # Navbar, Hero, Footer, …
│  ├─ dashboard/               # DashboardLayout, Sidebar, FileUploader, chat, …
│  └─ admin/                   # CaseManagementTable, EscrowControlPanel, …
├─ lib/
│  ├─ actions/                 # "use server" mutations (auth, cases, escrow, …)
│  ├─ escrow/provider.ts       # SERVER-ONLY mock provider abstraction
│  ├─ supabase/                # client.ts, server.ts, middleware.ts
│  ├─ constants.ts             # status configs, fee rates, nav, file rules, DEMO_MODE
│  ├─ data.ts                  # read-side helpers (mock now; TODO real queries)
│  ├─ mock-data.ts             # deterministic demo dataset
│  ├─ types.ts                 # row types + enum unions
│  ├─ audit.ts                 # logAudit() best-effort writer
│  └─ utils.ts                 # cn, formatCurrency, formatDate(Time)
├─ supabase/
│  ├─ schema.sql               # enums, tables, indexes, triggers
│  ├─ rls-policies.sql         # Row Level Security policies
│  ├─ storage.sql              # private "evidence" bucket + policies
│  ├─ seed.sql                 # optional demo dataset (matches mock-data)
│  └─ SETUP.md                 # detailed Supabase setup guide
├─ middleware.ts               # guards /dashboard and /admin (bypassed in demo)
├─ .env.example                # copy to .env.local
├─ next.config.mjs
├─ tailwind.config.ts
└─ package.json
```

---

## Setup

### 1. Install dependencies

Dependencies are **not** pre-installed. From the project root:

```bash
npm install
```

> `npm` is assumed below; `pnpm` / `yarn` work equally well.

### 2. Environment variables

Copy the example file and fill in the values:

```bash
cp .env.example .env.local
```

There are **five** functional variables plus the demo flag and an app URL:

| Variable | Required | Exposure | Where to get it |
|----------|----------|----------|-----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes (prod) | Public | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes (prod) | Public | Supabase → Project Settings → API → `anon` `public` key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes (prod) | **Server-only** | Supabase → Project Settings → API → `service_role` `secret` key |
| `ESCROW_PROVIDER_API_KEY` | For real escrow | **Server-only** | Your licensed escrow/payment provider dashboard |
| `ESCROW_PROVIDER_WEBHOOK_SECRET` | For real escrow | **Server-only** | Your provider's webhook settings |
| `NEXT_PUBLIC_APP_URL` | Recommended | Public | Your site origin (used for OG metadata + auth redirect) |
| `NEXT_PUBLIC_DEMO_MODE` | Optional | Public | `"true"` to preview without Supabase. **Must be `false`/unset in production.** |

Example `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...your-anon-key...
SUPABASE_SERVICE_ROLE_KEY=eyJ...your-service-role-key...

ESCROW_PROVIDER_API_KEY=replace-with-licensed-provider-key
ESCROW_PROVIDER_WEBHOOK_SECRET=replace-with-provider-webhook-secret

NEXT_PUBLIC_APP_URL=http://localhost:3000

# Preview-only. Set to false (or remove) in production.
NEXT_PUBLIC_DEMO_MODE=true
```

> **If you only want to preview the UI**, set `NEXT_PUBLIC_DEMO_MODE=true` and you
> can skip the Supabase and provider variables entirely — the app renders from
> mock data and the auth guard is bypassed.

### 3. Supabase database + storage

Full instructions live in [`supabase/SETUP.md`](supabase/SETUP.md). In short:

1. Create a Supabase project at <https://supabase.com/dashboard>.
2. Open the **SQL Editor** and run the SQL files **in this exact order**. Each
   file is idempotent (safe to re-run):
   1. `supabase/schema.sql` — enums, tables, foreign keys, indexes, `updated_at`
      triggers, and the `handle_new_user()` trigger that auto-creates a
      `profiles` row on sign-up.
   2. `supabase/rls-policies.sql` — enables Row Level Security on every table and
      defines the access policies (`is_admin()`, `has_case_access()`).
   3. `supabase/storage.sql` — creates the **private `evidence` storage bucket**
      and its access policies (path convention: `<case_id>/<file_name>`).
   4. `supabase/seed.sql` — **optional**; loads the same demo dataset shown in
      demo mode. Requires the five demo auth users to exist first (see SETUP.md).
3. **Confirm the `evidence` bucket.** `storage.sql` creates it for you; verify
   under **Storage** that a bucket named `evidence` exists and is **Private**. To
   create it manually instead: **Storage → New bucket → `evidence`**, Public OFF,
   file size limit **15 MB**, then run the policy portion of `storage.sql`.
4. **Create the first admin.** New sign-ups default to `client`. Promote a user:
   ```sql
   update public.profiles set role = 'admin' where email = 'you@example.com';
   ```

### 4. Run locally

```bash
npm run dev
```

Open <http://localhost:3000>. With `NEXT_PUBLIC_DEMO_MODE=true` you can browse the
dashboard and admin areas immediately. With real Supabase env vars and demo mode
off, register an account and (optionally) promote it to admin as above.

Production build:

```bash
npm run build
npm run start
```

---

## Demo mode

When `NEXT_PUBLIC_DEMO_MODE === "true"`:

- `middleware.ts` lets `/dashboard` and `/admin` through **without** an auth
  session.
- Pages render from the deterministic mock dataset in `lib/mock-data.ts` (via the
  read helpers in `lib/data.ts`), so the app is fully viewable without Supabase.
- Mutating server actions **no-op gracefully** (they return `{ success: true }`)
  so the UI stays demonstrable without persisting anything.
- A **"Demo Mode" pill** and banner appear in the app shell.

**Demo mode is preview-only and MUST be `false` (or unset) in production.** It
deliberately bypasses authentication and authorization.

---

## Deploying to Vercel

1. Push this repository to GitHub/GitLab/Bitbucket.
2. In Vercel, **Add New → Project** and import the repo. Vercel auto-detects
   Next.js (build `next build`, output handled automatically).
3. Under **Settings → Environment Variables**, add the variables for the
   **Production** (and Preview) environments:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` *(server-only — do not prefix with `NEXT_PUBLIC_`)*
   - `ESCROW_PROVIDER_API_KEY` *(server-only)*
   - `ESCROW_PROVIDER_WEBHOOK_SECRET` *(server-only)*
   - `NEXT_PUBLIC_APP_URL` *(your deployed origin, e.g. `https://aegis.example.com`)*
   - `NEXT_PUBLIC_DEMO_MODE` → **`false`** (or omit) for production.
4. Ensure the Supabase SQL has been run against the project these keys point to,
   and that the `evidence` bucket exists.
5. Deploy. After the first deploy, set your **provider webhook URL** to
   `https://YOUR-DOMAIN/api/escrow/webhook`.
6. Add your deployed origin to Supabase **Authentication → URL Configuration**
   (Site URL + redirect URLs) so the `/auth/callback` flow works.

> Only `NEXT_PUBLIC_*` variables are exposed to the browser. Keep the service-role
> key and provider secrets **unprefixed** so they stay server-side.

---

## Security notes

- **Service role is server-only.** `SUPABASE_SERVICE_ROLE_KEY` is read only in
  `lib/supabase/server.ts` (`createAdminClient()`), which bypasses RLS and is used
  on trusted server paths only (webhook confirmation, guaranteed audit writes).
  It is never imported into a client component. The webhook secret and provider
  API key live only in `lib/escrow/provider.ts` and the webhook route.
- **Release only via `POST /api/escrow/release`.** This is the single place a
  release is ever triggered. It re-authenticates the caller, re-checks
  eligibility **server-side** (both parties approved **or** admin dispute-release
  with an eligibility reason), refuses when frozen / under dispute / already
  released / deposit not received, calls `escrowProvider.requestRelease()`, writes
  an append-only `escrow_transactions` row, advances state, and audits. No release
  logic exists in any client component.
- **Webhook signature verification.** `POST /api/escrow/webhook` reads the **raw**
  body and verifies it with `escrowProvider.verifyWebhookSignature(rawBody,
  signature, ESCROW_PROVIDER_WEBHOOK_SECRET)` before doing anything; invalid
  signatures get `401`. (The mock requires both a signature and a configured
  secret to be present — replace it with the provider's real HMAC scheme +
  constant-time comparison when integrating.)
- **RLS everywhere + defense in depth.** Every table has RLS on. Server actions
  *also* re-check role/ownership (`requireAdmin`, `userCanAccessCase`,
  `partyRoleForUser`) so authorization does not rely on the UI.
- **Reason-gated admin actions.** Escrow status overrides, freezes, verification
  requests, dispute resolutions, and activity flags require a non-empty reason and
  are written to `audit_logs`. `adminSetEscrowStatus` explicitly **refuses** to
  set `released` — only the provider flow can do that.
- **Upload validation.** `uploadFile` validates MIME type/extension against
  `ACCEPTED_FILE_TYPES` and size against `MAX_FILE_SIZE` (15 MB) **before**
  touching storage, uploads to the private `evidence` bucket at
  `<caseId>/<filename>`, and stores a path (not a public URL).
- **Honest auth copy.** Auth, password hashing, and session security are handled
  by Supabase Auth + HTTP-only cookies (refreshed by middleware). We do not claim
  custom/proprietary encryption.

---

## Escrow state machine

Status presentation is centralized in `ESCROW_STATUS_CONFIG` (`lib/constants.ts`)
and the `EscrowStatus` union (`lib/types.ts`).

| `escrow_status` | Badge label | Color | Meaning |
|-----------------|-------------|-------|---------|
| `pending_deposit` | PENDING DEPOSIT | amber | Awaiting the funding deposit to be confirmed by the provider. |
| `securely_escrowed` | SECURELY ESCROWED | green | Provider-confirmed funds held; locked pending approvals. |
| `under_dispute_audit` | UNDER DISPUTE AUDIT | red | A dispute is open; release blocked during review. |
| `ready_for_release` | READY FOR RELEASE | blue | Both parties approved (or dispute resolved to release); eligible. |
| `release_frozen` | RELEASE FROZEN | orange | Admin froze release pending verification; no funds can move. |
| `released` | RELEASED | slate/green | Provider confirmed the release; case can be closed. |

**Supporting status fields:** `deposit_status` (`awaiting → received / failed`)
and `release_status` (`not_started → eligible → requested → completed`).

**Release rules (encoded in UI + server):**

1. Release is permitted **only** when:
   - approvals for `party_a` **and** `party_b` are both `approved`, **or**
   - an admin resolved a dispute as **release** and set
     `release_eligibility_reason`.
   Either path sets `release_status = eligible`, `escrow_status =
   ready_for_release`.
2. **Admins cannot move money from the UI.** Admin actions only steer status /
   eligibility (mark pending deposit, confirm deposit *reflecting the provider*,
   mark securely escrowed, place under dispute audit, freeze release, request
   additional verification, approve release eligibility, and submit a release
   *request*). Status overrides require a reason and are audited.
3. The actual release is triggered **only** by `POST /api/escrow/release`, which
   re-checks eligibility, calls `provider.requestRelease()`, writes an
   `escrow_transactions` row, audits, and sets `release_status = requested`. Funds
   become `released` / `completed` **only** after the provider confirms
   (`requestRelease()` returns `"confirmed"`, or the webhook reports
   `release.confirmed`).

Typical happy path:

```text
pending_deposit ──(provider/webhook deposit confirmed)──▶ securely_escrowed
   securely_escrowed ──(party_a + party_b approve)──▶ ready_for_release
      ready_for_release ──(POST /api/escrow/release → provider requested)──▶ release_status=requested
         ──(webhook release.confirmed)──▶ released
```

Dispute / hold branches: `securely_escrowed`/`ready_for_release` →
`under_dispute_audit` (dispute opened) or `release_frozen` (admin freeze /
verification request / flagged activity). A dispute resolved to **release** →
`ready_for_release`; to **refund** → `release_frozen` (refund is a provider
action); **rejected** → back to `securely_escrowed`.

---

## Database schema overview

Postgres via Supabase. snake_case columns; `uuid` PKs default
`gen_random_uuid()`; `created_at` / `updated_at` are `timestamptz` default
`now()`. Full DDL is in `supabase/schema.sql`; TypeScript mirrors live in
`lib/types.ts`.

**Enums:** `user_role`, `case_status`, `party_role`, `escrow_status`,
`deposit_status`, `release_status`, `txn_type`, `txn_status`, `file_category`,
`dispute_status`.

**Tables:**

| Table | Purpose |
|-------|---------|
| `profiles` | One per `auth.users` row: email, full_name, `role`, company, phone, avatar. |
| `cases` | The investigation/project: `case_number` (e.g. `AEG-2026-0001`), title, status, `created_by`, `assigned_admin`, contract terms + per-party signature flags. |
| `case_parties` | Per-user case access: links a `profile_id` (or `invited_email`) to a case with a `party_role` (`party_a` / `party_b` / `observer`). |
| `escrow_contracts` | One per case: currency, `total_amount`, `platform_fee`, `provider_fee`, `net_release_amount` (display-only math), `escrow_status`, `deposit_status`, `release_status`, `provider_reference`, `release_eligibility_reason`. |
| `escrow_transactions` | **Append-only ledger** of provider-confirmed events (`deposit` / `release` / `fee` / `refund`). No balance math. |
| `uploaded_files` | Evidence metadata: `file_type` (category), `storage_path`, size, notes. Bytes live in the private `evidence` bucket. |
| `chat_messages` | Per-case secure channel messages (sender, body, read). |
| `approvals` | Per-party release approval, `unique(case_id, party_role)`. |
| `disputes` | Disputes with `status`, resolution note, resolver. |
| `audit_logs` | **Append-only** trail: actor, action, entity, metadata (jsonb), reason. |

**Access model (RLS):** `has_case_access(uid, case_id)` is true for an **admin**,
the **case creator**, the **assigned admin**, or a **party** on the case.
`escrow_transactions` and `audit_logs` have insert + select only (append-only).
The `evidence` bucket grants read/write only under a case-id prefix the user can
access. See `supabase/rls-policies.sql` and `supabase/storage.sql`.

---

## Where to integrate a licensed escrow/payment provider

> 🔌 **This is the single most important integration point before going live.**
> Until it is done, AEGIS only *represents* money movement — it never performs it.

All provider interaction is isolated behind one **server-only** module and two API
routes. Replace the mock with a real, **licensed** payment/escrow provider; every
spot to change is marked with a `// TODO(provider):` comment.

1. **`lib/escrow/provider.ts`** — the mock abstraction (`escrowProvider`). Wire
   each method to the licensed provider:
   - `createEscrowAccount(input)` — open the provider-side escrow hold/intent;
     return its canonical reference (+ hosted deposit instructions URL).
   - `getDepositStatus(ref)` — query the provider's deposit/charge status.
   - `confirmDepositFromWebhook(payload)` — map a verified inbound event to a
     confirmed/failed deposit.
   - `checkReleaseEligibility(contractId)` — confirm funds are cleared / not on
     hold on the provider side (AEGIS still enforces its own approval/dispute
     rules first).
   - `requestRelease(input)` — create the payout/release (use the idempotency
     key); return `{ status: "requested" | "confirmed", providerReference }`.
   - `verifyWebhookSignature(rawBody, signature, secret)` — implement the
     provider's exact HMAC scheme with a constant-time comparison.
   Keys are read from `process.env` (`ESCROW_PROVIDER_API_KEY`,
   `ESCROW_PROVIDER_WEBHOOK_SECRET`) and are **server-only**.

2. **`app/api/escrow/release/route.ts`** (`POST`) — the **only** place a release
   is triggered. It already re-checks eligibility, writes the ledger row, audits,
   and advances state. You only need `requestRelease()` to talk to the real
   provider; the rest is provider-agnostic.

3. **`app/api/escrow/webhook/route.ts`** (`POST`) — the provider's inbound
   webhook. Update the **signature header name** and verification, then map the
   provider's real event types to AEGIS's `deposit.confirmed` /
   `release.confirmed` handling. It uses the service-role client so updates
   succeed without a user session.

Other `// TODO(provider):` markers: `resolveDispute(... "refund" ...)` in
`lib/actions/admin.ts` (issue the refund + append a `refund` ledger row once the
provider confirms).

After integrating, run a full sandbox cycle: create escrow → deposit webhook →
approvals → release request → release webhook, and confirm the ledger + audit
trail reflect each provider-confirmed step.

---

## Rebranding

The brand name **AEGIS** is a placeholder. To rebrand the whole app:

- Change `APP_NAME` (and optionally `APP_TAGLINE`) in `lib/constants.ts`.
- Swap the `ShieldCheck` icon / wordmark in `components/shared/Logo.tsx`.
- Optionally adjust the palette CSS variables in `app/globals.css`.

Nothing in the SQL depends on the brand name (the `AEG-` prefix in
`case_number` is cosmetic — change it freely in `lib/actions/cases.ts` and the
seed).

---

## Honest-copy policy

Every piece of user-facing copy must be truthful. Do **not** claim end-to-end
encryption, custody, certifications, or guarantees that are not actually
implemented. Use the standard disclaimer where funds are referenced:

> **Funds are processed only through licensed payment/escrow partners where
> available.**

This is an MVP scaffold. **Real fund movement MUST go through a licensed
provider** before AEGIS is used with real value.
