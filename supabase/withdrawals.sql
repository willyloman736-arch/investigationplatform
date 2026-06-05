-- ============================================================================
-- Digital Asset Investigations — Fintech Withdrawal Request Flow
-- withdrawals.sql — extends withdrawal_requests for provider-reviewed payouts
-- ----------------------------------------------------------------------------
-- Run AFTER recovery-operations.sql and kyc.sql.
--
-- This extends the existing withdrawal_requests table instead of replacing it.
-- It preserves earlier dashboard fields while adding the full request/review
-- fields used by /dashboard/withdraw and /admin/withdrawals.
-- ============================================================================

create extension if not exists pgcrypto;

-- ── Extend the existing withdrawal_status enum safely ───────────────────────
do $$
begin
  if not exists (select 1 from pg_type where typname = 'withdrawal_status') then
    create type withdrawal_status as enum (
      'not_requested',
      'draft',
      'submitted',
      'pending_admin_review',
      'conditions_required',
      'requested',
      'approved_for_processing',
      'processing',
      'approved',
      'paid',
      'failed',
      'rejected',
      'denied',
      'paid_out',
      'cancelled'
    );
  else
    alter type withdrawal_status add value if not exists 'draft';
    alter type withdrawal_status add value if not exists 'submitted';
    alter type withdrawal_status add value if not exists 'pending_admin_review';
    alter type withdrawal_status add value if not exists 'approved_for_processing';
    alter type withdrawal_status add value if not exists 'processing';
    alter type withdrawal_status add value if not exists 'paid';
    alter type withdrawal_status add value if not exists 'failed';
    alter type withdrawal_status add value if not exists 'rejected';
    alter type withdrawal_status add value if not exists 'cancelled';
  end if;
end$$;

alter type escrow_status add value if not exists 'release_approved';

do $$
begin
  if not exists (select 1 from pg_type where typname = 'withdrawal_admin_review_status') then
    create type withdrawal_admin_review_status as enum (
      'not_started',
      'pending_review',
      'approved',
      'rejected',
      'needs_more_information'
    );
  end if;
end$$;

-- ── Extend existing withdrawal_requests ─────────────────────────────────────
alter table public.withdrawal_requests
  add column if not exists user_id uuid references public.profiles(id) on delete cascade,
  add column if not exists escrow_contract_id uuid references public.escrow_contracts(id) on delete set null,
  add column if not exists provider_fee numeric(14,2) not null default 0,
  add column if not exists net_amount numeric(14,2) not null default 0,
  add column if not exists withdrawal_method payout_method,
  add column if not exists provider text,
  add column if not exists provider_reference text,
  add column if not exists admin_review_status withdrawal_admin_review_status not null default 'pending_review',
  add column if not exists admin_notes text,
  add column if not exists submitted_at timestamptz,
  add column if not exists processed_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.withdrawal_requests
set
  user_id = coalesce(user_id, profile_id),
  withdrawal_method = coalesce(withdrawal_method, method),
  admin_notes = coalesce(admin_notes, admin_note),
  submitted_at = coalesce(submitted_at, requested_at, created_at),
  net_amount = case when net_amount = 0 then amount else net_amount end,
  escrow_contract_id = coalesce(
    escrow_contract_id,
    (
      select ec.id
      from public.escrow_contracts ec
      where ec.case_id = withdrawal_requests.case_id
      limit 1
    )
  )
where true;

alter table public.withdrawal_requests
  alter column user_id set not null,
  alter column withdrawal_method set default 'bank_transfer',
  alter column withdrawal_method set not null;

create index if not exists idx_withdrawal_requests_user_id on public.withdrawal_requests(user_id);
create index if not exists idx_withdrawal_requests_escrow_contract_id on public.withdrawal_requests(escrow_contract_id);
create index if not exists idx_withdrawal_requests_submitted on public.withdrawal_requests(submitted_at desc);
create index if not exists idx_withdrawal_requests_admin_review on public.withdrawal_requests(admin_review_status);

drop trigger if exists trg_withdrawal_requests_updated_at on public.withdrawal_requests;
create trigger trg_withdrawal_requests_updated_at
  before update on public.withdrawal_requests
  for each row execute function public.set_updated_at();

-- ── RLS: users see their own requests only; admins see all ──────────────────
alter table public.withdrawal_requests enable row level security;

drop policy if exists withdrawal_requests_select_access on public.withdrawal_requests;
drop policy if exists withdrawal_requests_select_owner_or_admin on public.withdrawal_requests;
create policy withdrawal_requests_select_owner_or_admin
  on public.withdrawal_requests for select
  to authenticated
  using (user_id = auth.uid() or profile_id = auth.uid() or public.is_admin());

drop policy if exists withdrawal_requests_insert_case_user on public.withdrawal_requests;
drop policy if exists withdrawal_requests_insert_owner on public.withdrawal_requests;
create policy withdrawal_requests_insert_owner
  on public.withdrawal_requests for insert
  to authenticated
  with check (
    (user_id = auth.uid() and profile_id = auth.uid())
    or public.is_admin()
  );

drop policy if exists withdrawal_requests_update_admin on public.withdrawal_requests;
create policy withdrawal_requests_update_admin
  on public.withdrawal_requests for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- No delete policy for normal roles.

-- ============================================================================
-- End of withdrawals.sql
-- ============================================================================
