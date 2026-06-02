-- ─────────────────────────────────────────────────────────────────────────────
-- Account recovery phrase hashes.
--
-- SERVER-ONLY by design: RLS is ENABLED with NO policies, so neither anonymous
-- nor authenticated clients can read or write this table. Only the service role
-- (used by the signUp / recoverAccount server actions) can touch it, and the
-- service role bypasses RLS.
--
-- We store ONLY a scrypt hash of each user's recovery phrase (see
-- lib/recovery/hash.ts). The phrase itself is never persisted, logged, or
-- returned to anyone — not even staff.
--
-- Run this after schema.sql (it is also included there for fresh setups).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.account_recovery (
  profile_id  uuid primary key references public.profiles (id) on delete cascade,
  phrase_hash text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.account_recovery enable row level security;

-- Intentionally NO policies. Clients get zero access; the service role bypasses
-- RLS for the signUp (insert) and recoverAccount (select) server actions.

comment on table public.account_recovery is
  'Scrypt hashes of per-user account recovery phrases. Service-role only; the recovery phrase is never stored in readable form.';
