-- ============================================================================
-- Digital Asset Investigations — realtime-messages.sql
-- Enables Supabase Realtime for the per-case Secure Case Channel
-- (public.chat_messages) so client↔admin replies appear live on BOTH the user
-- case page and the admin case page without a manual refresh.
-- ----------------------------------------------------------------------------
-- Run AFTER schema.sql + rls-policies.sql. Idempotent (safe to re-run).
--
-- Security: RLS already governs chat_messages (SELECT via has_case_access,
-- INSERT requires sender_id = self + case access). Supabase Realtime honours
-- those policies, so a subscriber only receives messages for cases they can
-- access — adding the table to the publication does NOT widen visibility.
-- ============================================================================

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'chat_messages'
    ) then
      alter publication supabase_realtime add table public.chat_messages;
    end if;
  end if;
end$$;

-- Deliver the full new row on INSERT to subscribed clients.
alter table public.chat_messages replica identity full;

-- ============================================================================
-- End of realtime-messages.sql
-- ============================================================================
