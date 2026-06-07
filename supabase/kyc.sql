-- ============================================================================
-- Digital Asset Investigations — Full KYC Verification Flow
-- kyc.sql — profile verification fields, submissions, audit logs, private docs
-- ----------------------------------------------------------------------------
-- Run AFTER schema.sql, rls-policies.sql, storage.sql, recovery.sql, and
-- recovery-operations.sql.
--
-- This file is idempotent and keeps compatibility with the earlier
-- recovery_kyc_reviews table. It does not move money.
-- ============================================================================

create extension if not exists pgcrypto;

-- ── ENUM TYPES ───────────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_type where typname = 'kyc_status') then
    create type kyc_status as enum (
      'not_started',
      'in_review',
      'pending_review',
      'verified',
      'rejected',
      'declined',
      'resubmission_required'
    );
  else
    alter type kyc_status add value if not exists 'pending_review';
    alter type kyc_status add value if not exists 'declined';
    alter type kyc_status add value if not exists 'resubmission_required';
  end if;

  if not exists (select 1 from pg_type where typname = 'kyc_id_type') then
    create type kyc_id_type as enum (
      'passport',
      'drivers_license',
      'national_id'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'kyc_proof_type') then
    create type kyc_proof_type as enum (
      'utility_bill',
      'bank_statement',
      'lease_agreement',
      'tax_document'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'kyc_audit_action') then
    create type kyc_audit_action as enum (
      'submitted',
      'approved',
      'declined',
      'resubmission_requested',
      'document_viewed',
      'status_synced'
    );
  end if;
end$$;

-- ── PROFILE VERIFICATION FIELDS ─────────────────────────────────────────────
alter table public.profiles
  add column if not exists kyc_status kyc_status not null default 'not_started',
  add column if not exists is_verified boolean not null default false;

create index if not exists idx_profiles_kyc_status on public.profiles(kyc_status);
create index if not exists idx_profiles_is_verified on public.profiles(is_verified);

-- ── TABLE: kyc_submissions ──────────────────────────────────────────────────
create table if not exists public.kyc_submissions (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references public.profiles(id) on delete cascade,
  full_legal_name        text not null,
  date_of_birth          date not null,
  nationality            text not null,
  residential_address    text not null,
  phone                  text not null,
  email                  text not null,
  id_type                kyc_id_type not null,
  id_number              text not null,
  issuing_country        text not null,
  id_expiry_date         date not null,
  id_front_url           text not null,
  id_back_url            text,
  selfie_url             text not null,
  proof_type             kyc_proof_type not null default 'utility_bill',
  proof_of_address_url   text not null,
  status                 kyc_status not null default 'not_started',
  admin_notes            text,
  reviewed_by            uuid references public.profiles(id) on delete set null,
  reviewed_at            timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists idx_kyc_submissions_user on public.kyc_submissions(user_id);
create index if not exists idx_kyc_submissions_status on public.kyc_submissions(status);
create index if not exists idx_kyc_submissions_created on public.kyc_submissions(created_at desc);

drop trigger if exists trg_kyc_submissions_updated_at on public.kyc_submissions;
create trigger trg_kyc_submissions_updated_at
  before update on public.kyc_submissions
  for each row execute function public.set_updated_at();

-- ── TABLE: kyc_audit_logs ───────────────────────────────────────────────────
create table if not exists public.kyc_audit_logs (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  submission_id  uuid references public.kyc_submissions(id) on delete set null,
  action         kyc_audit_action not null,
  actor_id       uuid references public.profiles(id) on delete set null,
  actor_role     user_role not null,
  notes          text,
  created_at     timestamptz not null default now()
);

create index if not exists idx_kyc_audit_logs_user on public.kyc_audit_logs(user_id);
create index if not exists idx_kyc_audit_logs_submission on public.kyc_audit_logs(submission_id);
create index if not exists idx_kyc_audit_logs_created on public.kyc_audit_logs(created_at desc);

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.kyc_submissions enable row level security;
alter table public.kyc_audit_logs enable row level security;

drop policy if exists kyc_submissions_select_owner_or_admin on public.kyc_submissions;
create policy kyc_submissions_select_owner_or_admin
  on public.kyc_submissions for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists kyc_submissions_insert_owner on public.kyc_submissions;
drop policy if exists kyc_submissions_insert_admin on public.kyc_submissions;
create policy kyc_submissions_insert_admin
  on public.kyc_submissions for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists kyc_submissions_update_owner_resubmit_or_admin on public.kyc_submissions;
drop policy if exists kyc_submissions_update_admin on public.kyc_submissions;
create policy kyc_submissions_update_admin
  on public.kyc_submissions for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists kyc_submissions_delete_admin on public.kyc_submissions;
create policy kyc_submissions_delete_admin
  on public.kyc_submissions for delete
  to authenticated
  using (public.is_admin());

drop policy if exists kyc_audit_logs_select_owner_or_admin on public.kyc_audit_logs;
create policy kyc_audit_logs_select_owner_or_admin
  on public.kyc_audit_logs for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists kyc_audit_logs_insert_owner_or_admin on public.kyc_audit_logs;
drop policy if exists kyc_audit_logs_insert_admin on public.kyc_audit_logs;

-- No update/delete policies on kyc_audit_logs: append-only for normal roles.

-- ── PRIVATE STORAGE BUCKET: kyc-documents ───────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'kyc-documents',
  'kyc-documents',
  false,
  10485760, -- 10 * 1024 * 1024
  array['image/png', 'image/jpeg', 'application/pdf']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.kyc_document_owner_id(object_name text)
returns uuid
language plpgsql
immutable
as $$
declare
  first_segment text;
begin
  first_segment := (storage.foldername(object_name))[1];
  if first_segment is null then
    return null;
  end if;
  return first_segment::uuid;
exception
  when others then
    return null;
end;
$$;

grant execute on function public.kyc_document_owner_id(text) to authenticated, service_role;

drop policy if exists kyc_documents_select_owner_or_admin on storage.objects;
create policy kyc_documents_select_owner_or_admin
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'kyc-documents'
    and (public.kyc_document_owner_id(name) = auth.uid() or public.is_admin())
  );

drop policy if exists kyc_documents_insert_owner_or_admin on storage.objects;
drop policy if exists kyc_documents_insert_admin on storage.objects;
create policy kyc_documents_insert_admin
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'kyc-documents'
    and public.is_admin()
  );

drop policy if exists kyc_documents_update_owner_or_admin on storage.objects;
drop policy if exists kyc_documents_update_admin on storage.objects;
create policy kyc_documents_update_admin
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'kyc-documents'
    and public.is_admin()
  )
  with check (
    bucket_id = 'kyc-documents'
    and public.is_admin()
  );

drop policy if exists kyc_documents_delete_admin on storage.objects;
create policy kyc_documents_delete_admin
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'kyc-documents' and public.is_admin());

-- ============================================================================
-- End of kyc.sql
-- ============================================================================
