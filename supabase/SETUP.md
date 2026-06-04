# Digital Asset Investigations — Supabase Setup

This folder contains the database layer for **Digital Asset Investigations — Secure Escrow & Investigation Management**.

> **Money-movement disclaimer.** Digital Asset Investigations never moves real funds and performs **no balance arithmetic**. The `escrow_contracts` amounts and the `escrow_transactions` ledger only *represent* provider-confirmed status. Real money movement happens exclusively through a licensed payment/escrow partner wired into `lib/escrow/provider.ts` (look for `// TODO(provider):`).

---

## Files (run in this exact order)

| # | File | What it does |
|---|------|--------------|
| 1 | `schema.sql` | Enables `pgcrypto`; creates all enums, tables, foreign keys, indexes, `updated_at` triggers, and the `handle_new_user()` trigger that auto-creates a `profiles` row on sign-up. |
| 2 | `rls-policies.sql` | Enables Row Level Security on every table; defines `is_admin()` / `has_case_access()`; adds all access policies. |
| 3 | `storage.sql` | Creates the private **`evidence`** storage bucket and its access policies (path = `<case_id>/<file_name>`). |
| 4 | `recovery.sql` | Creates **`account_recovery`** — service-role-only scrypt hashes of each user's recovery phrase. RLS enabled with **no policies**. |
| 5 | `recovery-operations.sql` | Creates KYC review, recovered-funds, withdrawal-condition, withdrawal-request, receipt, and email-log tables used by the admin command center and client dashboards. |
| 6 | `seed.sql` | **Optional.** Loads the same demo dataset the app shows in DEMO mode. Requires the five demo auth users to exist first (see below). |

Each file is **idempotent** — safe to re-run.

---

## Step-by-step

### 1. Create the Supabase project
1. Go to <https://supabase.com/dashboard> and create a new project.
2. Wait for provisioning to finish, then open the project.

### 2. Run the SQL
Open **SQL Editor** (left sidebar) and run the files **in order**. For each file: open a new query, paste the entire file contents, and click **Run**.

1. `schema.sql`
2. `rls-policies.sql`
3. `storage.sql`
4. `recovery.sql`
5. `recovery-operations.sql`
6. `seed.sql` *(optional — see "Demo seed" below)*

> The SQL Editor runs as the **service role**, which bypasses RLS — this is required for `seed.sql` to insert rows on behalf of multiple users.

The CLI alternative, if you use it:
```bash
supabase db execute --file supabase/schema.sql
supabase db execute --file supabase/rls-policies.sql
supabase db execute --file supabase/storage.sql
supabase db execute --file supabase/recovery.sql
supabase db execute --file supabase/recovery-operations.sql
# optional:
supabase db execute --file supabase/seed.sql
```

### 3. Confirm the `evidence` bucket
`storage.sql` creates the bucket for you. Verify under **Storage** in the dashboard:
- A bucket named **`evidence`** exists and is **Private** (not public).
- Its policies appear under **Storage → Policies → `objects`** (four `evidence_*` policies).

To create it manually instead (if you skipped `storage.sql`):
**Storage → New bucket** → name `evidence`, leave **Public** OFF, set the file size limit to **15 MB**, then re-run the policy portion of `storage.sql`.

> The upload path convention is `<case_id>/<file_name>` (see `lib/actions/files.ts` and `lib/mock-data.ts`). Access is granted only when the signed-in user has access to the case id in the **first path segment**.

### 4. Create the first admin
New sign-ups default to role **`client`** (via the `handle_new_user()` trigger). To promote a user to admin, run in the SQL Editor:
```sql
update public.profiles
set role = 'admin'
where email = 'you@example.com';
```

### 5. Demo seed (optional)
`seed.sql` reproduces the deterministic dataset used by DEMO mode. Because `profiles.id` references `auth.users(id)`, you must create the five demo auth users **first**:

- **Option A (Dashboard):** Authentication → Users → **Add user** for each of:
  `client@dai.demo`, `counterparty@dai.demo`, `admin@dai.demo`, `taylor@meridian.demo`, `casey@summit.demo`.
  Then update each `profiles` row's id to match, or use Option B.
- **Option B (SQL, exact UUIDs):** uncomment the `insert into auth.users (...)` block at the top of `seed.sql` (**STEP 0, Option B**) and run it once. It creates the users with the exact UUIDs the seed expects.

Then run the rest of `seed.sql`. The body is **guarded**: if the five demo users are not present it does nothing and raises a `NOTICE` (so it is harmless to run early). After seeding, promote the admin demo user if it is not already admin (the seed sets `admin@dai.demo` to `admin`).

---

## Environment variables

Create a `.env.local` in the project root (do **not** commit it). Values come from the Supabase dashboard:

| Variable | Where to find it | Exposure |
|----------|------------------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | **Project Settings → API → Project URL** | Public (client + server) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Project Settings → API → Project API keys → `anon` `public`** | Public (client + server) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Project Settings → API → Project API keys → `service_role` `secret`** | **SERVER-ONLY — never expose to the browser.** Bypasses RLS. |
| `ESCROW_PROVIDER_API_KEY` | Your licensed escrow/payment provider dashboard | **SERVER-ONLY.** Used by `lib/escrow/provider.ts`. Placeholder until a provider is integrated. |
| `ESCROW_PROVIDER_WEBHOOK_SECRET` | Your provider's webhook settings | **SERVER-ONLY.** Verifies inbound webhooks at `/api/escrow/webhook`. |
| `NEXT_PUBLIC_DEMO_MODE` | You choose | Public. `"true"` bypasses the auth guard and renders mock data. **Must be `false`/unset in production.** |

Example `.env.local`:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...your-anon-key...
SUPABASE_SERVICE_ROLE_KEY=eyJ...your-service-role-key...

ESCROW_PROVIDER_API_KEY=replace-with-licensed-provider-key
ESCROW_PROVIDER_WEBHOOK_SECRET=replace-with-provider-webhook-secret

# Preview-only. Set to false (or remove) in production.
NEXT_PUBLIC_DEMO_MODE=true
```

> **Security reminders**
> - `SUPABASE_SERVICE_ROLE_KEY`, `ESCROW_PROVIDER_API_KEY`, and `ESCROW_PROVIDER_WEBHOOK_SECRET` are **server-only**. They are read in `lib/supabase/server.ts` and `lib/escrow/provider.ts` and must never be imported into a client component.
> - The `anon` key is safe to ship to the browser **only because RLS is enabled on every table** (step 2). Do not disable RLS.

---

## How the security model works

- **RLS everywhere.** Every table has RLS on. Users can read/write only rows for cases they can access.
- **Case access** (`has_case_access(uid, case_id)`) is true when the user is an **admin**, the **case creator**, the **assigned admin**, or a **party** (`case_parties` row) on the case.
- **`profiles`:** self select/update; admins full access.
- **`approvals`:** a party may upsert only **their own** `party_role` row (`unique(case_id, party_role)`).
- **`escrow_transactions`:** insert + select only — an **append-only** ledger (no update/delete policy).
- **`audit_logs`:** insert by any authenticated user; select by case access or admin; **no update/delete policy** → append-only.
- **`evidence` storage:** private bucket; objects readable/writable only under a case-id prefix the user can access; admins all.
- **`account_recovery`:** RLS on with **no policies** → clients get zero access; only the service role can read/write it. It holds only a **scrypt hash** of each user's recovery phrase — the phrase itself is never stored, logged, or returned.
- **Recovery operations:** KYC reviews, recovered-funds entries, withdrawal conditions, receipts, and email logs are readable by case access and written by admins. Withdrawal requests can be created by the case user and reviewed by admins.
- **Service role bypasses RLS** and is used only on trusted server paths (webhook deposit/release confirmation, guaranteed audit writes, and `account_recovery` reads/writes for recovery-phrase signup/reset).

---

## Rebranding

To rebrand, update `APP_NAME` / `APP_SHORT_NAME` in `lib/constants.ts` and replace the SVG artwork in `public/brand/` (and `app/icon.svg`) used by `components/shared/Logo.tsx`. Nothing in this SQL depends on the brand name (the `case_number` prefix `AEG-` in the seed is cosmetic — change it freely).
