-- ============================================================================
-- Digital Asset Investigations — Secure Escrow & Investigation Management
-- schema.sql — enums, tables, foreign keys, indexes, triggers
-- ----------------------------------------------------------------------------
-- Run ORDER (see supabase/SETUP.md):
--   1. schema.sql        (this file)
--   2. rls-policies.sql
--   3. storage.sql
--   4. seed.sql          (optional demo data)
--
-- Safe to re-run: this file is written to be idempotent (IF NOT EXISTS guards,
-- enum bootstrapping via DO blocks, CREATE OR REPLACE for functions/triggers).
--
-- Conventions (per SPEC):
--   * snake_case columns
--   * uuid PKs default gen_random_uuid()
--   * created_at / updated_at timestamptz default now()
-- ============================================================================

-- ── Extensions ──────────────────────────────────────────────────────────────
-- pgcrypto provides gen_random_uuid().
create extension if not exists pgcrypto;

-- ============================================================================
-- ENUM TYPES
-- ----------------------------------------------------------------------------
-- Created defensively so the file can be re-run without error. Each enum's
-- values mirror the string-literal unions in lib/types.ts EXACTLY.
-- ============================================================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type user_role as enum ('client', 'counterparty', 'admin');
  end if;

  if not exists (select 1 from pg_type where typname = 'case_status') then
    create type case_status as enum ('draft', 'active', 'suspended', 'closed', 'under_dispute');
  end if;

  if not exists (select 1 from pg_type where typname = 'party_role') then
    create type party_role as enum ('party_a', 'party_b', 'observer');
  end if;

  if not exists (select 1 from pg_type where typname = 'escrow_status') then
    create type escrow_status as enum (
      'pending_deposit',
      'securely_escrowed',
      'under_dispute_audit',
      'ready_for_release',
      'release_frozen',
      'released'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'deposit_status') then
    create type deposit_status as enum ('awaiting', 'received', 'failed');
  end if;

  if not exists (select 1 from pg_type where typname = 'release_status') then
    create type release_status as enum ('not_started', 'eligible', 'requested', 'completed');
  end if;

  if not exists (select 1 from pg_type where typname = 'txn_type') then
    create type txn_type as enum ('deposit', 'release', 'fee', 'refund');
  end if;

  if not exists (select 1 from pg_type where typname = 'txn_status') then
    create type txn_status as enum ('pending', 'confirmed', 'failed');
  end if;

  if not exists (select 1 from pg_type where typname = 'file_category') then
    create type file_category as enum (
      'csv',
      'pdf_receipt',
      'image_receipt',
      'chat_log',
      'text',
      'tx_hash',
      'other'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'dispute_status') then
    create type dispute_status as enum (
      'open',
      'under_review',
      'resolved_release',
      'resolved_refund',
      'rejected'
    );
  end if;
end$$;

-- ============================================================================
-- SHARED updated_at TRIGGER FUNCTION
-- ----------------------------------------------------------------------------
-- Sets NEW.updated_at = now() on every UPDATE. Attached to tables that carry an
-- updated_at column.
-- ============================================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================================
-- TABLE: profiles
-- ----------------------------------------------------------------------------
-- One row per auth user. id references auth.users(id). Auto-populated by the
-- handle_new_user() trigger below on sign-up (default role 'client').
-- ============================================================================
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text,
  role        user_role not null default 'client',
  company     text,
  phone       text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_profiles_role on public.profiles(role);

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ============================================================================
-- TABLE: cases
-- ----------------------------------------------------------------------------
-- A case/project (investigation + escrow engagement).
-- ============================================================================
create table if not exists public.cases (
  id                    uuid primary key default gen_random_uuid(),
  case_number           text not null unique,          -- e.g. AEG-2026-0001
  title                 text not null,
  description           text,
  category              text,
  status                case_status not null default 'draft',
  created_by            uuid not null references public.profiles(id) on delete restrict,
  assigned_admin        uuid references public.profiles(id) on delete set null,
  contract_terms        text,
  contract_signed_by_a  boolean not null default false,
  contract_signed_by_b  boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists idx_cases_created_by     on public.cases(created_by);
create index if not exists idx_cases_assigned_admin on public.cases(assigned_admin);
create index if not exists idx_cases_status         on public.cases(status);
create index if not exists idx_cases_case_number    on public.cases(case_number);

drop trigger if exists trg_cases_updated_at on public.cases;
create trigger trg_cases_updated_at
  before update on public.cases
  for each row execute function public.set_updated_at();

-- ============================================================================
-- TABLE: case_parties
-- ----------------------------------------------------------------------------
-- Drives per-user case access. A profile (or an invited email pending sign-up)
-- participates in a case with a party_role.
-- ============================================================================
create table if not exists public.case_parties (
  id            uuid primary key default gen_random_uuid(),
  case_id       uuid not null references public.cases(id) on delete cascade,
  profile_id    uuid references public.profiles(id) on delete set null,
  invited_email text,
  party_role    party_role not null,
  accepted      boolean not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists idx_case_parties_case_id    on public.case_parties(case_id);
create index if not exists idx_case_parties_profile_id on public.case_parties(profile_id);
create index if not exists idx_case_parties_email      on public.case_parties(invited_email);

-- A given profile holds at most one role per case; a given email is invited once
-- per case. Partial unique indexes keep NULLs from colliding.
create unique index if not exists uq_case_parties_case_profile
  on public.case_parties(case_id, profile_id)
  where profile_id is not null;

create unique index if not exists uq_case_parties_case_email
  on public.case_parties(case_id, invited_email)
  where invited_email is not null;

-- ============================================================================
-- TABLE: escrow_contracts
-- ----------------------------------------------------------------------------
-- One escrow contract per case. Amounts are display/representation values only;
-- NO balance arithmetic is performed anywhere in the app.
-- ============================================================================
create table if not exists public.escrow_contracts (
  id                         uuid primary key default gen_random_uuid(),
  case_id                    uuid not null unique references public.cases(id) on delete cascade,
  currency                   text not null default 'USD',
  total_amount               numeric(14,2) not null default 0,
  platform_fee               numeric(14,2) not null default 0,
  provider_fee               numeric(14,2) not null default 0,
  net_release_amount         numeric(14,2) not null default 0,
  escrow_status              escrow_status not null default 'pending_deposit',
  deposit_status             deposit_status not null default 'awaiting',
  release_status             release_status not null default 'not_started',
  provider_reference         text,
  release_eligibility_reason text,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);

create index if not exists idx_escrow_contracts_case_id on public.escrow_contracts(case_id);
create index if not exists idx_escrow_contracts_status  on public.escrow_contracts(escrow_status);

drop trigger if exists trg_escrow_contracts_updated_at on public.escrow_contracts;
create trigger trg_escrow_contracts_updated_at
  before update on public.escrow_contracts
  for each row execute function public.set_updated_at();

-- ============================================================================
-- TABLE: escrow_transactions
-- ----------------------------------------------------------------------------
-- Append-only ledger of provider-confirmed events. NO balance math: each row is
-- a record of a deposit/release/fee/refund status as reported by the provider.
-- ============================================================================
create table if not exists public.escrow_transactions (
  id                  uuid primary key default gen_random_uuid(),
  escrow_contract_id  uuid not null references public.escrow_contracts(id) on delete cascade,
  case_id             uuid not null references public.cases(id) on delete cascade,
  type                txn_type not null,
  amount              numeric(14,2) not null default 0,
  currency            text not null default 'USD',
  provider_reference  text,
  provider_status     text,
  status              txn_status not null default 'pending',
  initiated_by        uuid references public.profiles(id) on delete set null,
  notes               text,
  created_at          timestamptz not null default now()
);

create index if not exists idx_escrow_txns_contract on public.escrow_transactions(escrow_contract_id);
create index if not exists idx_escrow_txns_case_id  on public.escrow_transactions(case_id);
create index if not exists idx_escrow_txns_type     on public.escrow_transactions(type);

-- ============================================================================
-- TABLE: uploaded_files
-- ----------------------------------------------------------------------------
-- Evidence metadata. The binary lives in the private "evidence" storage bucket
-- at storage_path = '<case_id>/<file_name>' (see storage.sql).
-- ============================================================================
create table if not exists public.uploaded_files (
  id           uuid primary key default gen_random_uuid(),
  case_id      uuid not null references public.cases(id) on delete cascade,
  uploaded_by  uuid not null references public.profiles(id) on delete restrict,
  file_name    text not null,
  file_type    file_category not null default 'other',
  storage_path text not null,
  file_url     text,
  size_bytes   bigint not null default 0,
  notes        text,
  created_at   timestamptz not null default now()
);

create index if not exists idx_uploaded_files_case_id     on public.uploaded_files(case_id);
create index if not exists idx_uploaded_files_uploaded_by on public.uploaded_files(uploaded_by);

-- ============================================================================
-- TABLE: chat_messages
-- ----------------------------------------------------------------------------
-- Per-case secure messaging. Communication is logged for dispute review (NOT
-- claimed to be end-to-end encrypted anywhere in the UI).
-- ============================================================================
create table if not exists public.chat_messages (
  id         uuid primary key default gen_random_uuid(),
  case_id    uuid not null references public.cases(id) on delete cascade,
  sender_id  uuid not null references public.profiles(id) on delete cascade,
  body       text not null,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_chat_messages_case_id   on public.chat_messages(case_id);
create index if not exists idx_chat_messages_sender_id on public.chat_messages(sender_id);
create index if not exists idx_chat_messages_case_time on public.chat_messages(case_id, created_at);

-- ============================================================================
-- TABLE: approvals
-- ----------------------------------------------------------------------------
-- One row per (case, party_role). Release requires BOTH party_a and party_b to
-- be approved (or an admin dispute resolution). unique(case_id, party_role).
-- ============================================================================
create table if not exists public.approvals (
  id                 uuid primary key default gen_random_uuid(),
  case_id            uuid not null references public.cases(id) on delete cascade,
  escrow_contract_id uuid not null references public.escrow_contracts(id) on delete cascade,
  party_role         party_role not null,
  approved_by        uuid references public.profiles(id) on delete set null,
  approved           boolean not null default false,
  note               text,
  created_at         timestamptz not null default now(),
  constraint uq_approvals_case_party unique (case_id, party_role)
);

create index if not exists idx_approvals_case_id  on public.approvals(case_id);
create index if not exists idx_approvals_contract on public.approvals(escrow_contract_id);

-- ============================================================================
-- TABLE: disputes
-- ----------------------------------------------------------------------------
-- A dispute against a case. Resolved by an admin; resolution may make the
-- escrow release-eligible (resolved_release) or refund-bound (resolved_refund).
-- ============================================================================
create table if not exists public.disputes (
  id              uuid primary key default gen_random_uuid(),
  case_id         uuid not null references public.cases(id) on delete cascade,
  opened_by       uuid not null references public.profiles(id) on delete restrict,
  reason          text not null,
  status          dispute_status not null default 'open',
  resolution_note text,
  resolved_by     uuid references public.profiles(id) on delete set null,
  resolved_at     timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists idx_disputes_case_id on public.disputes(case_id);
create index if not exists idx_disputes_status  on public.disputes(status);

-- ============================================================================
-- TABLE: audit_logs
-- ----------------------------------------------------------------------------
-- Append-only. Every important action inserts one row. NO updates/deletes are
-- permitted (enforced by RLS — see rls-policies.sql).
-- ============================================================================
create table if not exists public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  case_id     uuid references public.cases(id) on delete set null,
  actor_id    uuid references public.profiles(id) on delete set null,
  action      text not null,
  entity_type text not null,
  entity_id   uuid,
  metadata    jsonb not null default '{}'::jsonb,
  reason      text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_audit_logs_case_id  on public.audit_logs(case_id);
create index if not exists idx_audit_logs_actor_id on public.audit_logs(actor_id);
create index if not exists idx_audit_logs_entity   on public.audit_logs(entity_type, entity_id);
create index if not exists idx_audit_logs_created  on public.audit_logs(created_at desc);

-- ============================================================================
-- AUTH HOOK: handle_new_user()
-- ----------------------------------------------------------------------------
-- Inserts a profiles row whenever a new auth.users row is created. Pulls
-- full_name / company / phone from raw_user_meta_data when present. Role
-- defaults to 'client' (admins are promoted manually — see SETUP.md). Runs as
-- SECURITY DEFINER so it can write to public.profiles regardless of the caller.
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, company, phone, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'company',
    new.raw_user_meta_data ->> 'phone',
    'client'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- End of schema.sql
-- ============================================================================
