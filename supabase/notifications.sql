-- ============================================================================
-- Digital Asset Investigations — notifications.sql
-- Real-time user notifications + Web Push subscriptions + account suspension.
-- ----------------------------------------------------------------------------
-- Run AFTER schema.sql + rls-policies.sql (it depends on public.is_admin()).
-- Idempotent: safe to re-run.
--
-- Adds:
--   * profiles.account_status      ('active' | 'suspended') — admin suspend
--   * profiles.email_notifications boolean                  — per-user email opt-out
--   * notifications                — one row per user-facing event (Realtime-enabled)
--   * push_subscriptions           — Web Push endpoints per user
--   * RLS so users see/manage ONLY their own rows
--   * public.notifications added to the supabase_realtime publication
-- ============================================================================

create extension if not exists pgcrypto;

-- ── Enums ───────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_type where typname = 'account_status') then
    create type account_status as enum ('active', 'suspended');
  end if;

  if not exists (select 1 from pg_type where typname = 'notification_type') then
    create type notification_type as enum (
      'kyc_verified',
      'kyc_declined',
      'kyc_resubmission',
      'recovered_funds',
      'withdrawal_conditions',
      'withdrawal_approved',
      'withdrawal_denied',
      'withdrawal_paid',
      'escrow_released',
      'escrow_update',
      'dispute_opened',
      'dispute_resolved',
      'evidence_requested',
      'case_status',
      'account_suspended',
      'account_reactivated',
      'general'
    );
  end if;
end$$;

-- ── profiles: account status + email preference ─────────────────────────────
alter table public.profiles
  add column if not exists account_status account_status not null default 'active';

alter table public.profiles
  add column if not exists email_notifications boolean not null default true;

-- ── notifications ───────────────────────────────────────────────────────────
create table if not exists public.notifications (
  id           uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id     uuid references public.profiles(id) on delete set null,
  type         notification_type not null default 'general',
  title        text not null,
  body         text not null,
  case_id      uuid references public.cases(id) on delete set null,
  link         text,
  metadata     jsonb not null default '{}'::jsonb,
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists idx_notifications_recipient
  on public.notifications(recipient_id, created_at desc);
create index if not exists idx_notifications_unread
  on public.notifications(recipient_id) where read_at is null;

-- ── push_subscriptions (Web Push endpoints) ─────────────────────────────────
create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_push_subscriptions_profile
  on public.push_subscriptions(profile_id);

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.notifications      enable row level security;
alter table public.push_subscriptions enable row level security;

-- notifications: a user reads ONLY their own (admins read all). Rows are created
-- by privileged server paths (the service-role client bypasses RLS); we also let
-- admins insert. Users may UPDATE only their own rows (to set read_at).
drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own
  on public.notifications for select
  to authenticated
  using (recipient_id = auth.uid() or public.is_admin());

drop policy if exists notifications_insert_admin on public.notifications;
create policy notifications_insert_admin
  on public.notifications for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own
  on public.notifications for update
  to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

drop policy if exists notifications_delete_own_or_admin on public.notifications;
create policy notifications_delete_own_or_admin
  on public.notifications for delete
  to authenticated
  using (recipient_id = auth.uid() or public.is_admin());

-- push_subscriptions: each user manages ONLY their own endpoints.
drop policy if exists push_subs_select_own on public.push_subscriptions;
create policy push_subs_select_own
  on public.push_subscriptions for select
  to authenticated
  using (profile_id = auth.uid() or public.is_admin());

drop policy if exists push_subs_insert_own on public.push_subscriptions;
create policy push_subs_insert_own
  on public.push_subscriptions for insert
  to authenticated
  with check (profile_id = auth.uid());

drop policy if exists push_subs_update_own on public.push_subscriptions;
create policy push_subs_update_own
  on public.push_subscriptions for update
  to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

drop policy if exists push_subs_delete_own on public.push_subscriptions;
create policy push_subs_delete_own
  on public.push_subscriptions for delete
  to authenticated
  using (profile_id = auth.uid() or public.is_admin());

-- ── Realtime ────────────────────────────────────────────────────────────────
-- Supabase auto-creates the `supabase_realtime` publication. Add notifications
-- to it (guarded so re-runs do not error).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'notifications'
    ) then
      alter publication supabase_realtime add table public.notifications;
    end if;
  end if;
end$$;

-- Deliver the full new row on INSERT events to subscribed clients.
alter table public.notifications replica identity full;

-- ============================================================================
-- End of notifications.sql
-- ============================================================================
