-- ============================================================================
-- Digital Asset Investigations — Recovery Operations Tables
-- recovery-operations.sql — KYC, recovered funds, withdrawal review, receipts
-- ----------------------------------------------------------------------------
-- Run AFTER schema.sql and rls-policies.sql.
--
-- These tables power the admin recovery command center and the client escrow /
-- recovery dashboards. They do not move money. Recovered-funds rows and
-- withdrawal statuses are operational records; real payout movement remains
-- provider/server-side only.
--
-- Safe to re-run.
-- ============================================================================

create extension if not exists pgcrypto;

-- ── ENUM TYPES ───────────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_type where typname = 'kyc_status') then
    create type kyc_status as enum (
      'not_started',
      'in_review',
      'verified',
      'rejected'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'kyc_document_status') then
    create type kyc_document_status as enum (
      'not_submitted',
      'submitted',
      'verified',
      'rejected'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'payout_method') then
    create type payout_method as enum (
      'bank_transfer',
      'card',
      'paypal'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'withdrawal_status') then
    create type withdrawal_status as enum (
      'not_requested',
      'conditions_required',
      'requested',
      'approved',
      'denied',
      'paid_out'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'withdrawal_condition_gate') then
    create type withdrawal_condition_gate as enum (
      'before_request',
      'before_approval',
      'before_payout'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'recovery_receipt_kind') then
    create type recovery_receipt_kind as enum (
      'case_update',
      'recovered_funds',
      'withdrawal_condition',
      'withdrawal_approval',
      'withdrawal_paid'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'email_delivery_status') then
    create type email_delivery_status as enum (
      'queued',
      'sent_placeholder',
      'failed'
    );
  end if;
end$$;

-- ── TABLE: recovery_kyc_reviews ─────────────────────────────────────────────
create table if not exists public.recovery_kyc_reviews (
  id                      uuid primary key default gen_random_uuid(),
  case_id                 uuid not null unique references public.cases(id) on delete cascade,
  profile_id              uuid not null references public.profiles(id) on delete cascade,
  status                  kyc_status not null default 'not_started',
  government_id_status    kyc_document_status not null default 'not_submitted',
  selfie_status           kyc_document_status not null default 'not_submitted',
  proof_of_address_status kyc_document_status not null default 'not_submitted',
  phone_verified          boolean not null default false,
  email_verified          boolean not null default false,
  reviewer_id             uuid references public.profiles(id) on delete set null,
  review_note             text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index if not exists idx_recovery_kyc_reviews_case_id on public.recovery_kyc_reviews(case_id);
create index if not exists idx_recovery_kyc_reviews_profile on public.recovery_kyc_reviews(profile_id);
create index if not exists idx_recovery_kyc_reviews_status  on public.recovery_kyc_reviews(status);

drop trigger if exists trg_recovery_kyc_reviews_updated_at on public.recovery_kyc_reviews;
create trigger trg_recovery_kyc_reviews_updated_at
  before update on public.recovery_kyc_reviews
  for each row execute function public.set_updated_at();

-- ── TABLE: recovered_funds_entries ──────────────────────────────────────────
create table if not exists public.recovered_funds_entries (
  id                  uuid primary key default gen_random_uuid(),
  case_id             uuid not null references public.cases(id) on delete cascade,
  amount              numeric(14,2) not null check (amount >= 0),
  currency            text not null default 'USD',
  source_label        text not null,
  provider_reference  text,
  visible_to_client   boolean not null default true,
  entered_by          uuid not null references public.profiles(id) on delete restrict,
  notes               text,
  created_at          timestamptz not null default now()
);

create index if not exists idx_recovered_funds_entries_case_id on public.recovered_funds_entries(case_id);
create index if not exists idx_recovered_funds_entries_visible on public.recovered_funds_entries(case_id, visible_to_client);
create index if not exists idx_recovered_funds_entries_created on public.recovered_funds_entries(created_at desc);

-- ── TABLE: withdrawal_conditions ────────────────────────────────────────────
create table if not exists public.withdrawal_conditions (
  id          uuid primary key default gen_random_uuid(),
  case_id     uuid not null references public.cases(id) on delete cascade,
  label       text not null,
  description text not null,
  gate        withdrawal_condition_gate not null default 'before_approval',
  satisfied   boolean not null default false,
  created_by  uuid not null references public.profiles(id) on delete restrict,
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists idx_withdrawal_conditions_case_id on public.withdrawal_conditions(case_id);
create index if not exists idx_withdrawal_conditions_open on public.withdrawal_conditions(case_id, satisfied);

-- ── TABLE: withdrawal_requests ──────────────────────────────────────────────
create table if not exists public.withdrawal_requests (
  id                uuid primary key default gen_random_uuid(),
  case_id           uuid not null references public.cases(id) on delete cascade,
  profile_id        uuid not null references public.profiles(id) on delete cascade,
  amount            numeric(14,2) not null check (amount >= 0),
  currency          text not null default 'USD',
  method            payout_method not null,
  destination_label text not null,
  status            withdrawal_status not null default 'requested',
  admin_note        text,
  requested_at      timestamptz not null default now(),
  reviewed_by       uuid references public.profiles(id) on delete set null,
  reviewed_at       timestamptz
);

create index if not exists idx_withdrawal_requests_case_id on public.withdrawal_requests(case_id);
create index if not exists idx_withdrawal_requests_profile on public.withdrawal_requests(profile_id);
create index if not exists idx_withdrawal_requests_status  on public.withdrawal_requests(status);

-- ── TABLE: recovery_receipts ────────────────────────────────────────────────
create table if not exists public.recovery_receipts (
  id              uuid primary key default gen_random_uuid(),
  case_id         uuid not null references public.cases(id) on delete cascade,
  receipt_number  text not null unique,
  kind            recovery_receipt_kind not null,
  title           text not null,
  amount          numeric(14,2),
  currency        text not null default 'USD',
  recipient_email text not null,
  issued_by       uuid not null references public.profiles(id) on delete restrict,
  issued_at       timestamptz not null default now(),
  notes           text
);

create index if not exists idx_recovery_receipts_case_id on public.recovery_receipts(case_id);
create index if not exists idx_recovery_receipts_issued  on public.recovery_receipts(issued_at desc);

-- ── TABLE: email_logs ───────────────────────────────────────────────────────
create table if not exists public.email_logs (
  id                 uuid primary key default gen_random_uuid(),
  case_id            uuid not null references public.cases(id) on delete cascade,
  recipient_email    text not null,
  subject            text not null,
  status             email_delivery_status not null default 'queued',
  provider_reference text,
  related_receipt_id uuid references public.recovery_receipts(id) on delete set null,
  created_at         timestamptz not null default now(),
  sent_at            timestamptz
);

create index if not exists idx_email_logs_case_id on public.email_logs(case_id);
create index if not exists idx_email_logs_created on public.email_logs(created_at desc);

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.recovery_kyc_reviews    enable row level security;
alter table public.recovered_funds_entries enable row level security;
alter table public.withdrawal_conditions   enable row level security;
alter table public.withdrawal_requests     enable row level security;
alter table public.recovery_receipts       enable row level security;
alter table public.email_logs              enable row level security;

-- KYC reviews: readable by case access; written by admins.
drop policy if exists recovery_kyc_reviews_select_access on public.recovery_kyc_reviews;
create policy recovery_kyc_reviews_select_access
  on public.recovery_kyc_reviews for select
  to authenticated
  using (public.has_case_access(case_id));

drop policy if exists recovery_kyc_reviews_insert_admin on public.recovery_kyc_reviews;
create policy recovery_kyc_reviews_insert_admin
  on public.recovery_kyc_reviews for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists recovery_kyc_reviews_update_admin on public.recovery_kyc_reviews;
create policy recovery_kyc_reviews_update_admin
  on public.recovery_kyc_reviews for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Recovered funds: readable by case access; written by admins.
drop policy if exists recovered_funds_entries_select_access on public.recovered_funds_entries;
create policy recovered_funds_entries_select_access
  on public.recovered_funds_entries for select
  to authenticated
  using (public.has_case_access(case_id));

drop policy if exists recovered_funds_entries_insert_admin on public.recovered_funds_entries;
create policy recovered_funds_entries_insert_admin
  on public.recovered_funds_entries for insert
  to authenticated
  with check (public.is_admin());

-- Withdrawal conditions: readable by case access; written by admins.
drop policy if exists withdrawal_conditions_select_access on public.withdrawal_conditions;
create policy withdrawal_conditions_select_access
  on public.withdrawal_conditions for select
  to authenticated
  using (public.has_case_access(case_id));

drop policy if exists withdrawal_conditions_insert_admin on public.withdrawal_conditions;
create policy withdrawal_conditions_insert_admin
  on public.withdrawal_conditions for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists withdrawal_conditions_update_admin on public.withdrawal_conditions;
create policy withdrawal_conditions_update_admin
  on public.withdrawal_conditions for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Withdrawal requests: clients can create/read their own case requests; admins review.
drop policy if exists withdrawal_requests_select_access on public.withdrawal_requests;
create policy withdrawal_requests_select_access
  on public.withdrawal_requests for select
  to authenticated
  using (public.has_case_access(case_id));

drop policy if exists withdrawal_requests_insert_case_user on public.withdrawal_requests;
create policy withdrawal_requests_insert_case_user
  on public.withdrawal_requests for insert
  to authenticated
  with check (
    public.has_case_access(case_id)
    and (profile_id = auth.uid() or public.is_admin())
  );

drop policy if exists withdrawal_requests_update_admin on public.withdrawal_requests;
create policy withdrawal_requests_update_admin
  on public.withdrawal_requests for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Receipts and email logs: readable by case access; written by admins.
drop policy if exists recovery_receipts_select_access on public.recovery_receipts;
create policy recovery_receipts_select_access
  on public.recovery_receipts for select
  to authenticated
  using (public.has_case_access(case_id));

drop policy if exists recovery_receipts_insert_admin on public.recovery_receipts;
create policy recovery_receipts_insert_admin
  on public.recovery_receipts for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists email_logs_select_access on public.email_logs;
create policy email_logs_select_access
  on public.email_logs for select
  to authenticated
  using (public.has_case_access(case_id));

drop policy if exists email_logs_insert_admin on public.email_logs;
create policy email_logs_insert_admin
  on public.email_logs for insert
  to authenticated
  with check (public.is_admin());

-- ============================================================================
-- End of recovery-operations.sql
-- ============================================================================
