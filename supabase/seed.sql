-- ============================================================================
-- AEGIS — Secure Escrow & Investigation Management
-- seed.sql — OPTIONAL demo data mirroring lib/mock-data.ts
-- ----------------------------------------------------------------------------
-- This seed reproduces the deterministic dataset used by DEMO mode so a fresh
-- Supabase project shows the same cases, escrow states, files, messages,
-- approvals, disputes, and audit logs as the mock UI.
--
-- IMPORTANT — read before running:
--   * profiles.id references auth.users(id). You MUST create the five demo auth
--     users FIRST (see STEP 0 below) so the UUIDs line up. Without them, the
--     insert into public.profiles will violate the foreign key.
--   * Run this AFTER schema.sql, rls-policies.sql, and storage.sql.
--   * Run it as the SERVICE ROLE (e.g. the Supabase SQL Editor, which bypasses
--     RLS). Normal users cannot insert other users' rows.
--   * This file only writes table rows. It does NOT upload evidence binaries;
--     uploaded_files.storage_path points at objects you may upload separately
--     to the private "evidence" bucket if you want working downloads.
--   * Re-runnable: every insert uses ON CONFLICT (id) DO NOTHING.
--
-- The entire body is wrapped in a guard that NO-OPS unless all five demo auth
-- users exist, so accidentally running it on an empty project does nothing
-- harmful (it just raises a NOTICE).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- STEP 0 (do this MANUALLY, once): create the demo auth users.
-- ----------------------------------------------------------------------------
-- Option A — Supabase Dashboard: Authentication > Users > "Add user" for each
--   email below. After creating each, copy its UUID and (if it differs from the
--   fixed UUID here) update the matching row, OR use Option B which forces the
--   UUIDs to match the mock data.
--
-- Option B — SQL (service role). Uncomment and run ONCE to create users with the
--   exact UUIDs the mock data expects. Passwords are demo-only; change them.
--   (Requires the pgcrypto extension, enabled by schema.sql.)
--
-- insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
--   email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
-- values
--   ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
--    'authenticated', 'authenticated', 'client@aegis.demo',
--    crypt('Demo!Passw0rd', gen_salt('bf')), now(), now(), now(),
--    '{"provider":"email","providers":["email"]}'::jsonb,
--    '{"full_name":"Jordan Avery","company":"Northwind Capital","phone":"+1 415 555 0142"}'::jsonb),
--   ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000',
--    'authenticated', 'authenticated', 'counterparty@aegis.demo',
--    crypt('Demo!Passw0rd', gen_salt('bf')), now(), now(), now(),
--    '{"provider":"email","providers":["email"]}'::jsonb,
--    '{"full_name":"Morgan Pierce","company":"Halcyon Recovery LLC","phone":"+1 312 555 0188"}'::jsonb),
--   ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000',
--    'authenticated', 'authenticated', 'admin@aegis.demo',
--    crypt('Demo!Passw0rd', gen_salt('bf')), now(), now(), now(),
--    '{"provider":"email","providers":["email"]}'::jsonb,
--    '{"full_name":"Riley Chen","company":"AEGIS Trust Operations","phone":"+1 206 555 0117"}'::jsonb),
--   ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000',
--    'authenticated', 'authenticated', 'taylor@meridian.demo',
--    crypt('Demo!Passw0rd', gen_salt('bf')), now(), now(), now(),
--    '{"provider":"email","providers":["email"]}'::jsonb,
--    '{"full_name":"Taylor Brooks","company":"Meridian Holdings","phone":"+1 646 555 0173"}'::jsonb),
--   ('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000',
--    'authenticated', 'authenticated', 'casey@summit.demo',
--    crypt('Demo!Passw0rd', gen_salt('bf')), now(), now(), now(),
--    '{"provider":"email","providers":["email"]}'::jsonb,
--    '{"full_name":"Casey Nguyen","company":"Summit Forensics","phone":"+1 503 555 0150"}'::jsonb)
-- on conflict (id) do nothing;
--
-- NOTE: the handle_new_user() trigger will auto-create matching public.profiles
-- rows when the auth.users rows above are inserted (role defaults to 'client').
-- STEP 1 below then upserts the richer profile fields and promotes the admin.

-- ============================================================================
-- GUARDED SEED BODY
-- ----------------------------------------------------------------------------
-- Runs only if all five demo auth users exist. Otherwise raises a NOTICE and
-- does nothing (so the file is safe to run on a fresh/empty project).
-- ============================================================================
do $$
declare
  required_users uuid[] := array[
    '00000000-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000002'::uuid,
    '00000000-0000-0000-0000-000000000003'::uuid,
    '00000000-0000-0000-0000-000000000004'::uuid,
    '00000000-0000-0000-0000-000000000005'::uuid
  ];
  present_count int;
begin
  select count(*) into present_count
  from auth.users
  where id = any(required_users);

  if present_count < 5 then
    raise notice 'AEGIS seed skipped: expected 5 demo auth users, found %. Create them first (see STEP 0).', present_count;
    return;
  end if;

  -- ── profiles (upsert rich fields; promote admin) ──────────────────────────
  insert into public.profiles (id, email, full_name, role, company, phone, avatar_url, created_at, updated_at) values
    ('00000000-0000-0000-0000-000000000001','client@aegis.demo','Jordan Avery','client','Northwind Capital','+1 415 555 0142',null,'2026-01-04T09:00:00.000Z','2026-01-04T09:00:00.000Z'),
    ('00000000-0000-0000-0000-000000000002','counterparty@aegis.demo','Morgan Pierce','counterparty','Halcyon Recovery LLC','+1 312 555 0188',null,'2026-01-05T11:30:00.000Z','2026-01-05T11:30:00.000Z'),
    ('00000000-0000-0000-0000-000000000003','admin@aegis.demo','Riley Chen','admin','AEGIS Trust Operations','+1 206 555 0117',null,'2025-12-20T08:00:00.000Z','2025-12-20T08:00:00.000Z'),
    ('00000000-0000-0000-0000-000000000004','taylor@meridian.demo','Taylor Brooks','client','Meridian Holdings','+1 646 555 0173',null,'2026-01-09T14:10:00.000Z','2026-01-09T14:10:00.000Z'),
    ('00000000-0000-0000-0000-000000000005','casey@summit.demo','Casey Nguyen','counterparty','Summit Forensics','+1 503 555 0150',null,'2026-01-12T10:45:00.000Z','2026-01-12T10:45:00.000Z')
  on conflict (id) do update
    set email      = excluded.email,
        full_name  = excluded.full_name,
        role       = excluded.role,
        company    = excluded.company,
        phone      = excluded.phone;

  -- ── cases ─────────────────────────────────────────────────────────────────
  insert into public.cases (id, case_number, title, description, category, status, created_by, assigned_admin, contract_terms, contract_signed_by_a, contract_signed_by_b, created_at, updated_at) values
    ('11111111-1111-1111-1111-111111111101','AEG-2026-0001','Cross-border asset recovery — wire trace','Engagement to trace and recover funds from a disputed cross-border wire transfer. Counterparty to deliver forensic accounting and supporting receipts before release.','Asset Recovery','active','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003','Counterparty delivers a full wire trace report and itemized receipts. Funds release upon mutual approval. Platform and provider fees deducted from total.',true,false,'2026-01-06T09:15:00.000Z','2026-02-01T16:20:00.000Z'),
    ('11111111-1111-1111-1111-111111111102','AEG-2026-0002','Vendor milestone escrow — platform integration','Escrow covering a fixed-scope software integration milestone. Deposit confirmed and securely escrowed pending delivery sign-off by both parties.','Services Escrow','active','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000003','Milestone 1 (API integration) accepted by both parties triggers release eligibility. No partial releases.',true,true,'2026-01-11T13:40:00.000Z','2026-02-10T12:05:00.000Z'),
    ('11111111-1111-1111-1111-111111111103','AEG-2026-0003','Disputed deliverable — forensic image set','Counterparty submitted a forensic image set the client claims is incomplete. Dispute opened; escrow is under audit while the admin reviews evidence.','Digital Forensics','under_dispute','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003','Complete forensic image set with chain-of-custody log required. Disputes resolved by admin review of submitted evidence.',true,true,'2026-01-14T08:25:00.000Z','2026-02-18T09:50:00.000Z'),
    ('11111111-1111-1111-1111-111111111104','AEG-2026-0004','Settlement payout — both parties approved','Negotiated settlement fully approved by both parties. Escrow is ready for release; a release request is being prepared through the licensed partner.','Settlement','active','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000003','Upon dual approval, net settlement releases to the counterparty. Fees deducted from gross settlement amount.',true,true,'2026-01-18T15:00:00.000Z','2026-02-22T11:30:00.000Z'),
    ('11111111-1111-1111-1111-111111111105','AEG-2026-0005','Completed engagement — funds released','Investigation completed, deliverables accepted, and funds released by the licensed escrow partner. Retained for audit and record-keeping.','Investigation','closed','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003','Final report delivered and accepted. Release completed via provider confirmation. Case closed.',true,true,'2025-12-22T10:00:00.000Z','2026-01-28T17:45:00.000Z'),
    ('11111111-1111-1111-1111-111111111106','AEG-2026-0006','Verification hold — release frozen','Funds confirmed escrowed, but the admin froze release pending additional identity verification of the receiving counterparty. No funds can move while frozen.','Services Escrow','suspended','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000003','Release contingent on completed counterparty verification. Admin may freeze release pending compliance checks.',true,true,'2026-01-20T09:30:00.000Z','2026-02-25T14:15:00.000Z')
  on conflict (id) do nothing;

  -- ── case_parties ──────────────────────────────────────────────────────────
  insert into public.case_parties (id, case_id, profile_id, invited_email, party_role, accepted, created_at) values
    ('22222222-0001-0000-0000-000000000001','11111111-1111-1111-1111-111111111101','00000000-0000-0000-0000-000000000001','client@aegis.demo','party_a',true,'2026-01-06T09:16:00.000Z'),
    ('22222222-0001-0000-0000-000000000002','11111111-1111-1111-1111-111111111101','00000000-0000-0000-0000-000000000002','counterparty@aegis.demo','party_b',true,'2026-01-06T10:02:00.000Z'),
    ('22222222-0002-0000-0000-000000000001','11111111-1111-1111-1111-111111111102','00000000-0000-0000-0000-000000000004','taylor@meridian.demo','party_a',true,'2026-01-11T13:41:00.000Z'),
    ('22222222-0002-0000-0000-000000000002','11111111-1111-1111-1111-111111111102','00000000-0000-0000-0000-000000000005','casey@summit.demo','party_b',true,'2026-01-11T14:20:00.000Z'),
    ('22222222-0003-0000-0000-000000000001','11111111-1111-1111-1111-111111111103','00000000-0000-0000-0000-000000000001','client@aegis.demo','party_a',true,'2026-01-14T08:26:00.000Z'),
    ('22222222-0003-0000-0000-000000000002','11111111-1111-1111-1111-111111111103','00000000-0000-0000-0000-000000000005','casey@summit.demo','party_b',true,'2026-01-14T09:10:00.000Z'),
    ('22222222-0004-0000-0000-000000000001','11111111-1111-1111-1111-111111111104','00000000-0000-0000-0000-000000000004','taylor@meridian.demo','party_a',true,'2026-01-18T15:01:00.000Z'),
    ('22222222-0004-0000-0000-000000000002','11111111-1111-1111-1111-111111111104','00000000-0000-0000-0000-000000000002','counterparty@aegis.demo','party_b',true,'2026-01-18T15:45:00.000Z'),
    ('22222222-0005-0000-0000-000000000001','11111111-1111-1111-1111-111111111105','00000000-0000-0000-0000-000000000001','client@aegis.demo','party_a',true,'2025-12-22T10:01:00.000Z'),
    ('22222222-0005-0000-0000-000000000002','11111111-1111-1111-1111-111111111105','00000000-0000-0000-0000-000000000002','counterparty@aegis.demo','party_b',true,'2025-12-22T10:30:00.000Z'),
    ('22222222-0006-0000-0000-000000000001','11111111-1111-1111-1111-111111111106','00000000-0000-0000-0000-000000000004','taylor@meridian.demo','party_a',true,'2026-01-20T09:31:00.000Z'),
    ('22222222-0006-0000-0000-000000000002','11111111-1111-1111-1111-111111111106','00000000-0000-0000-0000-000000000005','casey@summit.demo','party_b',false,'2026-01-20T09:35:00.000Z')
  on conflict (id) do nothing;

  -- ── escrow_contracts ──────────────────────────────────────────────────────
  insert into public.escrow_contracts (id, case_id, currency, total_amount, platform_fee, provider_fee, net_release_amount, escrow_status, deposit_status, release_status, provider_reference, release_eligibility_reason, created_at, updated_at) values
    ('33333333-0001-0000-0000-000000000001','11111111-1111-1111-1111-111111111101','USD',48000.00,1440.00,720.00,45840.00,'pending_deposit','awaiting','not_started','ESC_DEMO0001',null,'2026-01-06T09:20:00.000Z','2026-02-01T16:20:00.000Z'),
    ('33333333-0002-0000-0000-000000000001','11111111-1111-1111-1111-111111111102','USD',92000.00,2760.00,1380.00,87860.00,'securely_escrowed','received','not_started','ESC_DEMO0002',null,'2026-01-11T13:50:00.000Z','2026-02-10T12:05:00.000Z'),
    ('33333333-0003-0000-0000-000000000001','11111111-1111-1111-1111-111111111103','USD',36500.00,1095.00,547.50,34857.50,'under_dispute_audit','received','not_started','ESC_DEMO0003',null,'2026-01-14T08:30:00.000Z','2026-02-18T09:50:00.000Z'),
    ('33333333-0004-0000-0000-000000000001','11111111-1111-1111-1111-111111111104','USD',125000.00,3750.00,1875.00,119375.00,'ready_for_release','received','eligible','ESC_DEMO0004','Both Party A and Party B approved the settlement on 2026-02-22.','2026-01-18T15:10:00.000Z','2026-02-22T11:30:00.000Z'),
    ('33333333-0005-0000-0000-000000000001','11111111-1111-1111-1111-111111111105','USD',58000.00,1740.00,870.00,55390.00,'released','received','completed','ESC_DEMO0005','Both parties approved on 2026-01-25; provider confirmed release on 2026-01-28.','2025-12-22T10:10:00.000Z','2026-01-28T17:45:00.000Z'),
    ('33333333-0006-0000-0000-000000000001','11111111-1111-1111-1111-111111111106','USD',73000.00,2190.00,1095.00,69715.00,'release_frozen','received','not_started','ESC_DEMO0006',null,'2026-01-20T09:40:00.000Z','2026-02-25T14:15:00.000Z')
  on conflict (id) do nothing;

  -- ── escrow_transactions (append-only ledger) ──────────────────────────────
  insert into public.escrow_transactions (id, escrow_contract_id, case_id, type, amount, currency, provider_reference, provider_status, status, initiated_by, notes, created_at) values
    ('44444444-0002-0000-0000-000000000001','33333333-0002-0000-0000-000000000001','11111111-1111-1111-1111-111111111102','deposit',92000.00,'USD','PAY_DEMO0002A','succeeded','confirmed','00000000-0000-0000-0000-000000000004','Deposit confirmed by licensed escrow partner webhook.','2026-01-13T10:12:00.000Z'),
    ('44444444-0003-0000-0000-000000000001','33333333-0003-0000-0000-000000000001','11111111-1111-1111-1111-111111111103','deposit',36500.00,'USD','PAY_DEMO0003A','succeeded','confirmed','00000000-0000-0000-0000-000000000001','Deposit confirmed. Funds held pending deliverable acceptance.','2026-01-16T09:05:00.000Z'),
    ('44444444-0004-0000-0000-000000000001','33333333-0004-0000-0000-000000000001','11111111-1111-1111-1111-111111111104','deposit',125000.00,'USD','PAY_DEMO0004A','succeeded','confirmed','00000000-0000-0000-0000-000000000004','Settlement deposit confirmed by provider.','2026-01-21T11:40:00.000Z'),
    ('44444444-0005-0000-0000-000000000001','33333333-0005-0000-0000-000000000001','11111111-1111-1111-1111-111111111105','deposit',58000.00,'USD','PAY_DEMO0005A','succeeded','confirmed','00000000-0000-0000-0000-000000000001','Deposit confirmed by provider.','2025-12-23T09:30:00.000Z'),
    ('44444444-0005-0000-0000-000000000002','33333333-0005-0000-0000-000000000001','11111111-1111-1111-1111-111111111105','fee',2610.00,'USD','FEE_DEMO0005A','applied','confirmed','00000000-0000-0000-0000-000000000003','Platform + provider fees recorded against the contract.','2026-01-25T16:00:00.000Z'),
    ('44444444-0005-0000-0000-000000000003','33333333-0005-0000-0000-000000000001','11111111-1111-1111-1111-111111111105','release',55390.00,'USD','REL_DEMO0005A','confirmed','confirmed','00000000-0000-0000-0000-000000000003','Release confirmed by licensed escrow partner after dual approval. Net amount paid to Party B.','2026-01-28T17:40:00.000Z'),
    ('44444444-0006-0000-0000-000000000001','33333333-0006-0000-0000-000000000001','11111111-1111-1111-1111-111111111106','deposit',73000.00,'USD','PAY_DEMO0006A','succeeded','confirmed','00000000-0000-0000-0000-000000000004','Deposit confirmed. Release later frozen pending verification.','2026-01-22T13:20:00.000Z')
  on conflict (id) do nothing;

  -- ── uploaded_files ────────────────────────────────────────────────────────
  -- NOTE: storage_path points at objects in the private "evidence" bucket; the
  -- binaries are NOT uploaded by this seed. file_url is left null.
  insert into public.uploaded_files (id, case_id, uploaded_by, file_name, file_type, storage_path, file_url, size_bytes, notes, created_at) values
    ('55555555-0001-0000-0000-000000000001','11111111-1111-1111-1111-111111111101','00000000-0000-0000-0000-000000000001','wire-instructions.pdf','pdf_receipt','11111111-1111-1111-1111-111111111101/wire-instructions.pdf',null,284512,'Original wire instructions provided to the bank.','2026-01-07T10:05:00.000Z'),
    ('55555555-0002-0000-0000-000000000001','11111111-1111-1111-1111-111111111102','00000000-0000-0000-0000-000000000005','integration-acceptance.csv','csv','11111111-1111-1111-1111-111111111102/integration-acceptance.csv',null,10240,'Test results matrix for milestone 1 acceptance.','2026-02-08T15:22:00.000Z'),
    ('55555555-0003-0000-0000-000000000001','11111111-1111-1111-1111-111111111103','00000000-0000-0000-0000-000000000005','forensic-image-manifest.txt','text','11111111-1111-1111-1111-111111111103/forensic-image-manifest.txt',null,4096,'Manifest of delivered images (client disputes completeness).','2026-02-12T08:40:00.000Z'),
    ('55555555-0003-0000-0000-000000000002','11111111-1111-1111-1111-111111111103','00000000-0000-0000-0000-000000000001','client-rebuttal-receipt.png','image_receipt','11111111-1111-1111-1111-111111111103/client-rebuttal-receipt.png',null,512000,'Screenshot evidencing missing deliverables.','2026-02-16T11:15:00.000Z'),
    ('55555555-0004-0000-0000-000000000001','11111111-1111-1111-1111-111111111104','00000000-0000-0000-0000-000000000004','settlement-agreement.pdf','pdf_receipt','11111111-1111-1111-1111-111111111104/settlement-agreement.pdf',null,612345,'Signed settlement agreement.','2026-02-20T09:00:00.000Z'),
    ('55555555-0005-0000-0000-000000000001','11111111-1111-1111-1111-111111111105','00000000-0000-0000-0000-000000000002','final-report.pdf','pdf_receipt','11111111-1111-1111-1111-111111111105/final-report.pdf',null,980210,'Accepted final investigation report.','2026-01-24T14:30:00.000Z'),
    ('55555555-0005-0000-0000-000000000002','11111111-1111-1111-1111-111111111105','00000000-0000-0000-0000-000000000001','onchain-tx-hash.txt','tx_hash','11111111-1111-1111-1111-111111111105/onchain-tx-hash.txt',null,96,'Reference blockchain transaction hash for the traced funds.','2026-01-24T15:00:00.000Z'),
    ('55555555-0006-0000-0000-000000000001','11111111-1111-1111-1111-111111111106','00000000-0000-0000-0000-000000000004','chat-export.log','chat_log','11111111-1111-1111-1111-111111111106/chat-export.log',null,20480,'Exported negotiation chat log for the record.','2026-02-23T10:10:00.000Z')
  on conflict (id) do nothing;

  -- ── chat_messages ─────────────────────────────────────────────────────────
  insert into public.chat_messages (id, case_id, sender_id, body, read, created_at) values
    ('66666666-0001-0000-0000-000000000001','11111111-1111-1111-1111-111111111101','00000000-0000-0000-0000-000000000001','Hi Morgan — I''ve uploaded the original wire instructions. Can you confirm the trace timeline?',true,'2026-01-07T10:10:00.000Z'),
    ('66666666-0001-0000-0000-000000000002','11111111-1111-1111-1111-111111111101','00000000-0000-0000-0000-000000000002','Received, thank you. We''ll begin the trace once the deposit is confirmed by the escrow partner.',true,'2026-01-07T11:02:00.000Z'),
    ('66666666-0001-0000-0000-000000000003','11111111-1111-1111-1111-111111111101','00000000-0000-0000-0000-000000000001','Understood. I''ll fund the escrow today.',false,'2026-02-01T16:18:00.000Z'),
    ('66666666-0003-0000-0000-000000000001','11111111-1111-1111-1111-111111111103','00000000-0000-0000-0000-000000000001','The delivered image set is missing the chain-of-custody log and three drives. I can''t approve release.',true,'2026-02-13T09:00:00.000Z'),
    ('66666666-0003-0000-0000-000000000002','11111111-1111-1111-1111-111111111103','00000000-0000-0000-0000-000000000005','We delivered everything in scope. Requesting admin review of the manifest.',true,'2026-02-13T10:30:00.000Z'),
    ('66666666-0004-0000-0000-000000000001','11111111-1111-1111-1111-111111111104','00000000-0000-0000-0000-000000000004','Settlement looks good on our end. Approving now.',true,'2026-02-22T10:55:00.000Z'),
    ('66666666-0004-0000-0000-000000000002','11111111-1111-1111-1111-111111111104','00000000-0000-0000-0000-000000000002','Approved as well. Ready for the release request through the partner.',false,'2026-02-22T11:20:00.000Z')
  on conflict (id) do nothing;

  -- ── approvals (unique per case + party_role) ──────────────────────────────
  insert into public.approvals (id, case_id, escrow_contract_id, party_role, approved_by, approved, note, created_at) values
    ('77777777-0001-0000-0000-00000000000a','11111111-1111-1111-1111-111111111101','33333333-0001-0000-0000-000000000001','party_a','00000000-0000-0000-0000-000000000001',true,'Approve once deliverables are received.','2026-01-08T09:00:00.000Z'),
    ('77777777-0001-0000-0000-00000000000b','11111111-1111-1111-1111-111111111101','33333333-0001-0000-0000-000000000001','party_b',null,false,null,'2026-01-08T09:05:00.000Z'),
    ('77777777-0002-0000-0000-00000000000a','11111111-1111-1111-1111-111111111102','33333333-0002-0000-0000-000000000001','party_a',null,false,null,'2026-02-09T09:00:00.000Z'),
    ('77777777-0002-0000-0000-00000000000b','11111111-1111-1111-1111-111111111102','33333333-0002-0000-0000-000000000001','party_b',null,false,null,'2026-02-09T09:05:00.000Z'),
    ('77777777-0004-0000-0000-00000000000a','11111111-1111-1111-1111-111111111104','33333333-0004-0000-0000-000000000001','party_a','00000000-0000-0000-0000-000000000004',true,'Settlement accepted.','2026-02-22T10:55:00.000Z'),
    ('77777777-0004-0000-0000-00000000000b','11111111-1111-1111-1111-111111111104','33333333-0004-0000-0000-000000000001','party_b','00000000-0000-0000-0000-000000000002',true,'Approved for release.','2026-02-22T11:20:00.000Z'),
    ('77777777-0005-0000-0000-00000000000a','11111111-1111-1111-1111-111111111105','33333333-0005-0000-0000-000000000001','party_a','00000000-0000-0000-0000-000000000001',true,'Final report accepted.','2026-01-25T15:30:00.000Z'),
    ('77777777-0005-0000-0000-00000000000b','11111111-1111-1111-1111-111111111105','33333333-0005-0000-0000-000000000001','party_b','00000000-0000-0000-0000-000000000002',true,'Confirmed deliverables accepted.','2026-01-25T15:45:00.000Z'),
    ('77777777-0006-0000-0000-00000000000a','11111111-1111-1111-1111-111111111106','33333333-0006-0000-0000-000000000001','party_a','00000000-0000-0000-0000-000000000004',true,'Ready to release pending verification.','2026-02-24T09:00:00.000Z'),
    ('77777777-0006-0000-0000-00000000000b','11111111-1111-1111-1111-111111111106','33333333-0006-0000-0000-000000000001','party_b',null,false,null,'2026-02-24T09:05:00.000Z')
  on conflict (id) do nothing;

  -- ── disputes ──────────────────────────────────────────────────────────────
  insert into public.disputes (id, case_id, opened_by, reason, status, resolution_note, resolved_by, resolved_at, created_at) values
    ('88888888-0003-0000-0000-000000000001','11111111-1111-1111-1111-111111111103','00000000-0000-0000-0000-000000000001','Delivered forensic image set is incomplete — missing chain-of-custody log and three drive images.','under_review',null,null,null,'2026-02-13T09:15:00.000Z'),
    ('88888888-0005-0000-0000-000000000001','11111111-1111-1111-1111-111111111105','00000000-0000-0000-0000-000000000001','Initial concern over report formatting (resolved amicably; release proceeded).','resolved_release','Counterparty re-delivered a corrected final report; client accepted. Release approved.','00000000-0000-0000-0000-000000000003','2026-01-25T15:20:00.000Z','2026-01-23T11:00:00.000Z')
  on conflict (id) do nothing;

  -- ── audit_logs (append-only) ──────────────────────────────────────────────
  insert into public.audit_logs (id, case_id, actor_id, action, entity_type, entity_id, metadata, reason, created_at) values
    ('99999999-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111101','00000000-0000-0000-0000-000000000001','case.created','case','11111111-1111-1111-1111-111111111101','{"case_number":"AEG-2026-0001"}'::jsonb,null,'2026-01-06T09:15:00.000Z'),
    ('99999999-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111102','00000000-0000-0000-0000-000000000003','escrow.deposit_confirmed','escrow_contract','33333333-0002-0000-0000-000000000001','{"provider_reference":"PAY_DEMO0002A","amount":92000}'::jsonb,'Provider webhook confirmed deposit.','2026-01-13T10:12:00.000Z'),
    ('99999999-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111102','00000000-0000-0000-0000-000000000003','escrow.status_changed','escrow_contract','33333333-0002-0000-0000-000000000001','{"from":"pending_deposit","to":"securely_escrowed"}'::jsonb,'Deposit cleared; funds securely escrowed.','2026-01-13T10:15:00.000Z'),
    ('99999999-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111103','00000000-0000-0000-0000-000000000001','dispute.opened','dispute','88888888-0003-0000-0000-000000000001','{}'::jsonb,'Incomplete deliverables — missing chain-of-custody log and drive images.','2026-02-13T09:15:00.000Z'),
    ('99999999-0000-0000-0000-000000000005','11111111-1111-1111-1111-111111111103','00000000-0000-0000-0000-000000000003','escrow.status_changed','escrow_contract','33333333-0003-0000-0000-000000000001','{"from":"securely_escrowed","to":"under_dispute_audit"}'::jsonb,'Dispute opened; escrow placed under audit.','2026-02-13T09:20:00.000Z'),
    ('99999999-0000-0000-0000-000000000006','11111111-1111-1111-1111-111111111104','00000000-0000-0000-0000-000000000004','approval.submitted','approval','77777777-0004-0000-0000-00000000000a','{"party_role":"party_a","approved":true}'::jsonb,null,'2026-02-22T10:55:00.000Z'),
    ('99999999-0000-0000-0000-000000000007','11111111-1111-1111-1111-111111111104','00000000-0000-0000-0000-000000000002','approval.submitted','approval','77777777-0004-0000-0000-00000000000b','{"party_role":"party_b","approved":true}'::jsonb,null,'2026-02-22T11:20:00.000Z'),
    ('99999999-0000-0000-0000-000000000008','11111111-1111-1111-1111-111111111104','00000000-0000-0000-0000-000000000003','escrow.release_eligible','escrow_contract','33333333-0004-0000-0000-000000000001','{"release_status":"eligible","escrow_status":"ready_for_release"}'::jsonb,'Both parties approved; eligible for release.','2026-02-22T11:22:00.000Z'),
    ('99999999-0000-0000-0000-000000000009','11111111-1111-1111-1111-111111111105','00000000-0000-0000-0000-000000000003','escrow.release_requested','escrow_transaction','44444444-0005-0000-0000-000000000003','{"provider_reference":"REL_DEMO0005A"}'::jsonb,'Release requested through licensed escrow partner.','2026-01-28T17:35:00.000Z'),
    ('99999999-0000-0000-0000-000000000010','11111111-1111-1111-1111-111111111105',null,'escrow.released','escrow_transaction','44444444-0005-0000-0000-000000000003','{"provider_reference":"REL_DEMO0005A","provider_status":"confirmed"}'::jsonb,'Provider webhook confirmed release.','2026-01-28T17:40:00.000Z'),
    ('99999999-0000-0000-0000-000000000011','11111111-1111-1111-1111-111111111106','00000000-0000-0000-0000-000000000003','escrow.release_frozen','escrow_contract','33333333-0006-0000-0000-000000000001','{"from":"securely_escrowed","to":"release_frozen"}'::jsonb,'Release frozen pending completed identity verification of the receiving counterparty.','2026-02-25T14:15:00.000Z')
  on conflict (id) do nothing;

  raise notice 'AEGIS seed complete: profiles, cases, parties, escrow, transactions, files, messages, approvals, disputes, audit logs inserted (existing rows skipped).';
end$$;

-- ============================================================================
-- End of seed.sql
-- ============================================================================
