-- ============================================================================
-- Digital Asset Investigations — Secure Escrow & Investigation Management
-- storage.sql — private "evidence" bucket + access policies
-- ----------------------------------------------------------------------------
-- Run AFTER schema.sql and rls-policies.sql (it relies on the helper functions
-- public.is_admin() and public.has_case_access(uuid) defined there).
--
-- Bucket layout (matches lib/actions/files.ts and lib/mock-data.ts):
--   bucket: "evidence" (PRIVATE — never public)
--   object path: "<case_id>/<file_name>"
--   => the FIRST path segment is the case id, so access is gated by
--      has_case_access(<that case id>).
--
-- A user may read/write objects only under a case-id prefix they can access;
-- admins can access all. The SERVICE ROLE bypasses these policies.
--
-- Safe to re-run.
-- ============================================================================

-- ── Create the private bucket ────────────────────────────────────────────────
-- file_size_limit mirrors MAX_FILE_SIZE in lib/constants.ts (15 MB). Adjust the
-- allowed mime list there and here together if you change accepted types.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'evidence',
  'evidence',
  false,
  15728640, -- 15 * 1024 * 1024
  array[
    'text/csv',
    'application/vnd.ms-excel',
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/heic',
    'text/plain',
    'application/json',
    'application/zip'
  ]
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ── Helper: extract the case id (first folder) from an object name ────────────
-- storage.foldername(name) returns the path segments as a text[]; element 1 is
-- the case-id prefix. We cast it to uuid for the access check. Wrapped so a
-- malformed (non-uuid) prefix simply yields NULL rather than erroring inside a
-- policy.
create or replace function public.evidence_case_id(object_name text)
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
    return null; -- non-uuid prefix => no access
end;
$$;

grant execute on function public.evidence_case_id(text) to authenticated, service_role;

-- ── Policies on storage.objects scoped to the "evidence" bucket ───────────────
-- RLS is already enabled on storage.objects by Supabase. We add four policies
-- (select / insert / update / delete), each requiring case access to the case
-- id encoded in the object's first path segment.

drop policy if exists evidence_select_access on storage.objects;
create policy evidence_select_access
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'evidence'
    and public.has_case_access(public.evidence_case_id(name))
  );

drop policy if exists evidence_insert_access on storage.objects;
create policy evidence_insert_access
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'evidence'
    and public.has_case_access(public.evidence_case_id(name))
  );

drop policy if exists evidence_update_access on storage.objects;
create policy evidence_update_access
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'evidence'
    and public.has_case_access(public.evidence_case_id(name))
  )
  with check (
    bucket_id = 'evidence'
    and public.has_case_access(public.evidence_case_id(name))
  );

drop policy if exists evidence_delete_access on storage.objects;
create policy evidence_delete_access
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'evidence'
    and (
      public.is_admin()
      or owner = auth.uid()
    )
    and public.has_case_access(public.evidence_case_id(name))
  );

-- ============================================================================
-- End of storage.sql
-- ============================================================================
