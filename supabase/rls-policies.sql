-- ============================================================================
-- AEGIS — Secure Escrow & Investigation Management
-- rls-policies.sql — Row Level Security helpers + policies
-- ----------------------------------------------------------------------------
-- Run AFTER schema.sql.
--
-- Security model (per SPEC):
--   * RLS is enabled on EVERY table.
--   * Users see only their own cases; admins see all.
--   * Case access = admin OR case creator OR assigned_admin OR a party
--     (case_parties row) on that case.
--   * audit_logs: insert by any authenticated user; select by case access or
--     admin; NEVER update/delete (no such policies exist -> denied).
--   * approvals: a party may upsert ONLY their own party_role row on a case
--     they can access.
--   * profiles: self select/update; admins may do anything.
--
-- NOTE: the SERVICE ROLE key bypasses RLS entirely. Privileged server paths
-- (webhook confirmation, guaranteed audit writes) use createAdminClient() and
-- are intentionally not constrained by these policies.
--
-- Safe to re-run: every policy is dropped before being (re)created.
-- ============================================================================

-- ============================================================================
-- HELPER FUNCTIONS
-- ----------------------------------------------------------------------------
-- SECURITY DEFINER + stable so they can read profiles/case_parties from within
-- policy expressions without recursive RLS evaluation. search_path is pinned.
-- ============================================================================

-- is_admin(uid): true when the given user's profile role = 'admin'.
create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = uid
      and p.role = 'admin'
  );
$$;

-- has_case_access(uid, cid): true when uid is an admin, the case creator, the
-- assigned admin, or present in case_parties for that case.
create or replace function public.has_case_access(uid uuid, cid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin(uid)
    or exists (
      select 1
      from public.cases c
      where c.id = cid
        and (c.created_by = uid or c.assigned_admin = uid)
    )
    or exists (
      select 1
      from public.case_parties cp
      where cp.case_id = cid
        and cp.profile_id = uid
    );
$$;

-- Convenience wrappers that default to the current authenticated user. Used so
-- policy expressions read cleanly.
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select public.is_admin(auth.uid());
$$;

create or replace function public.has_case_access(cid uuid)
returns boolean
language sql
stable
as $$
  select public.has_case_access(auth.uid(), cid);
$$;

-- Lock down EXECUTE so only the expected roles can call the helpers directly.
revoke all on function public.is_admin(uuid)            from public;
revoke all on function public.has_case_access(uuid,uuid) from public;
revoke all on function public.is_admin()                from public;
revoke all on function public.has_case_access(uuid)     from public;
grant execute on function public.is_admin(uuid)            to authenticated, service_role;
grant execute on function public.has_case_access(uuid,uuid) to authenticated, service_role;
grant execute on function public.is_admin()                to authenticated, service_role;
grant execute on function public.has_case_access(uuid)     to authenticated, service_role;

-- ============================================================================
-- ENABLE RLS ON EVERY TABLE
-- ============================================================================
alter table public.profiles            enable row level security;
alter table public.cases               enable row level security;
alter table public.case_parties        enable row level security;
alter table public.escrow_contracts    enable row level security;
alter table public.escrow_transactions enable row level security;
alter table public.uploaded_files      enable row level security;
alter table public.chat_messages       enable row level security;
alter table public.approvals           enable row level security;
alter table public.disputes            enable row level security;
alter table public.audit_logs          enable row level security;

-- ============================================================================
-- POLICIES: profiles
-- ----------------------------------------------------------------------------
-- Self select/update; admins full access. Inserts are normally performed by the
-- handle_new_user() trigger (SECURITY DEFINER), but we also allow a user to
-- insert their own row defensively.
-- ============================================================================
drop policy if exists profiles_select_self_or_admin on public.profiles;
create policy profiles_select_self_or_admin
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid() or public.is_admin());

drop policy if exists profiles_update_self_or_admin on public.profiles;
create policy profiles_update_self_or_admin
  on public.profiles for update
  to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

drop policy if exists profiles_delete_admin on public.profiles;
create policy profiles_delete_admin
  on public.profiles for delete
  to authenticated
  using (public.is_admin());

-- ============================================================================
-- POLICIES: cases
-- ----------------------------------------------------------------------------
-- Select/update gated by has_case_access. Insert: any authenticated user may
-- create a case they own (created_by = self), or an admin on anyone's behalf.
-- Delete: admin only.
-- ============================================================================
drop policy if exists cases_select_access on public.cases;
create policy cases_select_access
  on public.cases for select
  to authenticated
  using (public.has_case_access(id));

drop policy if exists cases_insert_owner_or_admin on public.cases;
create policy cases_insert_owner_or_admin
  on public.cases for insert
  to authenticated
  with check (created_by = auth.uid() or public.is_admin());

drop policy if exists cases_update_access on public.cases;
create policy cases_update_access
  on public.cases for update
  to authenticated
  using (public.has_case_access(id))
  with check (public.has_case_access(id));

drop policy if exists cases_delete_admin on public.cases;
create policy cases_delete_admin
  on public.cases for delete
  to authenticated
  using (public.is_admin());

-- ============================================================================
-- POLICIES: case_parties
-- ----------------------------------------------------------------------------
-- A user may see/insert/update/delete party rows on a case they can access.
-- (The case creator/admin manages parties; a party can see co-parties.)
-- ============================================================================
drop policy if exists case_parties_select_access on public.case_parties;
create policy case_parties_select_access
  on public.case_parties for select
  to authenticated
  using (public.has_case_access(case_id));

drop policy if exists case_parties_insert_access on public.case_parties;
create policy case_parties_insert_access
  on public.case_parties for insert
  to authenticated
  with check (public.has_case_access(case_id));

drop policy if exists case_parties_update_access on public.case_parties;
create policy case_parties_update_access
  on public.case_parties for update
  to authenticated
  using (public.has_case_access(case_id))
  with check (public.has_case_access(case_id));

drop policy if exists case_parties_delete_access on public.case_parties;
create policy case_parties_delete_access
  on public.case_parties for delete
  to authenticated
  using (public.has_case_access(case_id));

-- ============================================================================
-- POLICIES: escrow_contracts
-- ----------------------------------------------------------------------------
-- Read by case access. Inserts/updates gated by case access as well; admins
-- (covered by has_case_access) drive escrow status changes from server actions.
-- No client-side balance math is possible — these policies only gate row access.
-- ============================================================================
drop policy if exists escrow_contracts_select_access on public.escrow_contracts;
create policy escrow_contracts_select_access
  on public.escrow_contracts for select
  to authenticated
  using (public.has_case_access(case_id));

drop policy if exists escrow_contracts_insert_access on public.escrow_contracts;
create policy escrow_contracts_insert_access
  on public.escrow_contracts for insert
  to authenticated
  with check (public.has_case_access(case_id));

drop policy if exists escrow_contracts_update_access on public.escrow_contracts;
create policy escrow_contracts_update_access
  on public.escrow_contracts for update
  to authenticated
  using (public.has_case_access(case_id))
  with check (public.has_case_access(case_id));

-- ============================================================================
-- POLICIES: escrow_transactions  (append-only ledger)
-- ----------------------------------------------------------------------------
-- Read by case access. Insert by case access (server actions / route handlers
-- write provider-confirmed rows; the service role bypasses RLS for webhooks).
-- No update/delete policies -> the ledger is immutable to normal roles.
-- ============================================================================
drop policy if exists escrow_txns_select_access on public.escrow_transactions;
create policy escrow_txns_select_access
  on public.escrow_transactions for select
  to authenticated
  using (public.has_case_access(case_id));

drop policy if exists escrow_txns_insert_access on public.escrow_transactions;
create policy escrow_txns_insert_access
  on public.escrow_transactions for insert
  to authenticated
  with check (public.has_case_access(case_id));

-- ============================================================================
-- POLICIES: uploaded_files
-- ----------------------------------------------------------------------------
-- Read by case access. Insert requires case access AND uploaded_by = self.
-- Uploader (or admin) may delete their own evidence rows.
-- ============================================================================
drop policy if exists uploaded_files_select_access on public.uploaded_files;
create policy uploaded_files_select_access
  on public.uploaded_files for select
  to authenticated
  using (public.has_case_access(case_id));

drop policy if exists uploaded_files_insert_access on public.uploaded_files;
create policy uploaded_files_insert_access
  on public.uploaded_files for insert
  to authenticated
  with check (public.has_case_access(case_id) and uploaded_by = auth.uid());

drop policy if exists uploaded_files_delete_owner_or_admin on public.uploaded_files;
create policy uploaded_files_delete_owner_or_admin
  on public.uploaded_files for delete
  to authenticated
  using (uploaded_by = auth.uid() or public.is_admin());

-- ============================================================================
-- POLICIES: chat_messages
-- ----------------------------------------------------------------------------
-- Read by case access. Insert requires case access AND sender_id = self.
-- Update limited to case participants (used to flip read=true on received
-- messages); deletes restricted to admins.
-- ============================================================================
drop policy if exists chat_messages_select_access on public.chat_messages;
create policy chat_messages_select_access
  on public.chat_messages for select
  to authenticated
  using (public.has_case_access(case_id));

drop policy if exists chat_messages_insert_self on public.chat_messages;
create policy chat_messages_insert_self
  on public.chat_messages for insert
  to authenticated
  with check (public.has_case_access(case_id) and sender_id = auth.uid());

drop policy if exists chat_messages_update_access on public.chat_messages;
create policy chat_messages_update_access
  on public.chat_messages for update
  to authenticated
  using (public.has_case_access(case_id))
  with check (public.has_case_access(case_id));

drop policy if exists chat_messages_delete_admin on public.chat_messages;
create policy chat_messages_delete_admin
  on public.chat_messages for delete
  to authenticated
  using (public.is_admin());

-- ============================================================================
-- POLICIES: approvals
-- ----------------------------------------------------------------------------
-- Read by case access. A party may upsert ONLY their own party_role row:
--   * INSERT requires case access and approved_by = self.
--   * UPDATE requires case access and that the existing row was approved_by self
--     (or the row is being claimed — approved_by is null — by a participant),
--     and the resulting row keeps approved_by = self.
-- Admins (via has_case_access/is_admin) retain full access for dispute handling.
-- ============================================================================
drop policy if exists approvals_select_access on public.approvals;
create policy approvals_select_access
  on public.approvals for select
  to authenticated
  using (public.has_case_access(case_id));

drop policy if exists approvals_insert_own on public.approvals;
create policy approvals_insert_own
  on public.approvals for insert
  to authenticated
  with check (
    public.has_case_access(case_id)
    and (approved_by = auth.uid() or public.is_admin())
  );

drop policy if exists approvals_update_own on public.approvals;
create policy approvals_update_own
  on public.approvals for update
  to authenticated
  using (
    public.has_case_access(case_id)
    and (approved_by = auth.uid() or approved_by is null or public.is_admin())
  )
  with check (
    public.has_case_access(case_id)
    and (approved_by = auth.uid() or public.is_admin())
  );

-- ============================================================================
-- POLICIES: disputes
-- ----------------------------------------------------------------------------
-- Read by case access. A participant may open a dispute (opened_by = self).
-- Updates (resolution) gated by case access — server actions enforce admin-only
-- resolution and require a reason note. Deletes: admin only.
-- ============================================================================
drop policy if exists disputes_select_access on public.disputes;
create policy disputes_select_access
  on public.disputes for select
  to authenticated
  using (public.has_case_access(case_id));

drop policy if exists disputes_insert_opener on public.disputes;
create policy disputes_insert_opener
  on public.disputes for insert
  to authenticated
  with check (public.has_case_access(case_id) and opened_by = auth.uid());

drop policy if exists disputes_update_access on public.disputes;
create policy disputes_update_access
  on public.disputes for update
  to authenticated
  using (public.has_case_access(case_id))
  with check (public.has_case_access(case_id));

drop policy if exists disputes_delete_admin on public.disputes;
create policy disputes_delete_admin
  on public.disputes for delete
  to authenticated
  using (public.is_admin());

-- ============================================================================
-- POLICIES: audit_logs  (append-only)
-- ----------------------------------------------------------------------------
-- INSERT: any authenticated user (actions log themselves).
-- SELECT: case access OR admin; rows with a null case_id are visible to admins.
-- NO update/delete policies exist -> those operations are denied for all
-- non-service roles. The append-only guarantee holds at the RLS layer.
-- ============================================================================
drop policy if exists audit_logs_insert_authenticated on public.audit_logs;
create policy audit_logs_insert_authenticated
  on public.audit_logs for insert
  to authenticated
  with check (true);

drop policy if exists audit_logs_select_access on public.audit_logs;
create policy audit_logs_select_access
  on public.audit_logs for select
  to authenticated
  using (
    public.is_admin()
    or (case_id is not null and public.has_case_access(case_id))
  );

-- (Intentionally NO audit_logs UPDATE or DELETE policy -> append-only.)

-- ============================================================================
-- End of rls-policies.sql
-- ============================================================================
