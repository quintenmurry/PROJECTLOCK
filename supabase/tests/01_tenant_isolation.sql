-- Tenant-isolation and permission tests for Milestone 1.
-- Run with: psql -v ON_ERROR_STOP=1 -f 01_tenant_isolation.sql (after the shim + migrations).
-- Any failed assertion aborts the run with a non-zero exit.

\set fa1 '''a1000000-0000-0000-0000-000000000001'''
\set fa2 '''a2000000-0000-0000-0000-000000000002'''
\set fb1 '''b1000000-0000-0000-0000-000000000001'''
\set cc1 '''c1000000-0000-0000-0000-000000000001'''
\set cc2 '''c2000000-0000-0000-0000-000000000002'''
\set cd1 '''d1000000-0000-0000-0000-000000000001'''
\set adm '''e1000000-0000-0000-0000-000000000001'''
\set out '''f1000000-0000-0000-0000-000000000001'''

-- Fictional test users
insert into auth.users (id, email, raw_user_meta_data) values
  (:fa1, 'ana@harborline-forwarding.test', '{"full_name":"Ana Forwarder"}'),
  (:fa2, 'ben@harborline-forwarding.test', '{"full_name":"Ben Forwarder"}'),
  (:fb1, 'cara@bluewake-logistics.test', '{"full_name":"Cara Forwarder"}'),
  (:cc1, 'dan@redriver-drayage.test', '{"full_name":"Dan Carrier"}'),
  (:cc2, 'eli@redriver-drayage.test', '{"full_name":"Eli Driver"}'),
  (:cd1, 'fay@gulfgate-cartage.test', '{"full_name":"Fay Carrier"}'),
  (:adm, 'admin@projectlock.test', '{"full_name":"Platform Admin"}'),
  (:out, 'otto@outsider.test', '{"full_name":"Otto Outsider"}');
insert into public.platform_admins (user_id) values (:adm);

do $$ begin assert (select count(*) from public.profiles) = 8, 'profiles created by trigger'; end $$;

-- Helper to impersonate a user inside a transaction
create or replace function pg_temp.act_as(p_id uuid, p_email text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_id, 'email', p_email, 'role', 'authenticated')::text, true);
end $$;

-- ---------- Each owner creates a company via RPC ----------
begin; set local role authenticated; select pg_temp.act_as(:fa1, 'ana@harborline-forwarding.test');
select public.create_company('Harborline Forwarding (Demo)', 'forwarder'); commit;
begin; set local role authenticated; select pg_temp.act_as(:fb1, 'cara@bluewake-logistics.test');
select public.create_company('Bluewake Logistics (Demo)', 'forwarder'); commit;
begin; set local role authenticated; select pg_temp.act_as(:cc1, 'dan@redriver-drayage.test');
select public.create_company('Red River Drayage (Demo)', 'carrier'); commit;
begin; set local role authenticated; select pg_temp.act_as(:cd1, 'fay@gulfgate-cartage.test');
select public.create_company('Gulfgate Cartage (Demo)', 'carrier'); commit;

select id as co_a from public.companies where name like 'Harborline%' \gset
select id as co_b from public.companies where name like 'Bluewake%' \gset
select id as co_c from public.companies where name like 'Red River%' \gset
select id as co_d from public.companies where name like 'Gulfgate%' \gset

-- ---------- Invitations: Ana invites Ben; Dan invites Eli as driver ----------
begin; set local role authenticated; select pg_temp.act_as(:fa1, 'ana@harborline-forwarding.test');
select token as tok_ben from public.create_invitation(:'co_a', 'Ben@Harborline-Forwarding.test', 'member') \gset
commit;
begin; set local role authenticated; select pg_temp.act_as(:cc1, 'dan@redriver-drayage.test');
select token as tok_eli from public.create_invitation(:'co_c', 'eli@redriver-drayage.test', 'driver') \gset
commit;

-- Stored hash, not the token
select count(*) = 0 as raw_token_not_stored from public.company_invitations where token_hash = :'tok_ben' \gset
\if :raw_token_not_stored
\else
  \echo 'FAIL: raw token stored'
  select 1/0;
\endif

-- Wrong role for company kind is rejected
begin; set local role authenticated; select pg_temp.act_as(:cc1, 'dan@redriver-drayage.test');
do $$ begin
  begin
    perform public.create_invitation((select id from public.companies where name like 'Red River%'), 'x@y.test', 'member');
    raise exception 'FAIL: member role allowed on carrier';
  exception when sqlstate '22023' then null; end;
end $$;
commit;

-- Outsider (Otto) cannot accept Ben's invite (email mismatch)
begin; set local role authenticated; select pg_temp.act_as(:out, 'otto@outsider.test');
select set_config('t.tok', :'tok_ben', true);
do $$ begin
  begin
    perform public.accept_invitation(current_setting('t.tok'));
    raise exception 'FAIL: outsider accepted invite';
  exception when sqlstate '42501' then null; end;
end $$;
commit;

-- Ben and Eli accept
begin; set local role authenticated; select pg_temp.act_as(:fa2, 'ben@harborline-forwarding.test');
select public.accept_invitation(:'tok_ben'); commit;
begin; set local role authenticated; select pg_temp.act_as(:cc2, 'eli@redriver-drayage.test');
select public.accept_invitation(:'tok_eli'); commit;

-- Token can't be reused
begin; set local role authenticated; select pg_temp.act_as(:fa2, 'ben@harborline-forwarding.test');
select set_config('t.tok', :'tok_ben', true);
do $$ begin
  begin
    perform public.accept_invitation(current_setting('t.tok'));
    raise exception 'FAIL: invite reused';
  exception when sqlstate '22023' then null; end;
end $$;
commit;

-- ---------- Visibility checks ----------
-- Forwarder A owner sees only company A and A's members
begin; set local role authenticated; select pg_temp.act_as(:fa1, 'ana@harborline-forwarding.test');
do $$ begin
  assert (select count(*) from public.companies) = 1, 'A sees one company';
  assert (select name from public.companies) like 'Harborline%', 'A sees own company';
  assert (select count(*) from public.company_memberships) = 2, 'A sees 2 memberships';
  assert (select count(*) from public.profiles) = 2, 'A sees 2 profiles';
  assert (select count(*) from public.company_invitations) = 1, 'A owner sees own invitations';
  assert (select count(*) from public.audit_events) >= 3, 'A owner sees own audit';
  assert not exists (select 1 from public.audit_events where company_id <> (select id from public.companies)), 'A sees only own audit';
end $$;
commit;

-- Forwarder B cannot see A by id
begin; set local role authenticated; select pg_temp.act_as(:fb1, 'cara@bluewake-logistics.test');
select set_config('t.co_a', :'co_a', true);
do $$ begin
  assert (select count(*) from public.companies where id = current_setting('t.co_a')::uuid) = 0, 'B cannot read A';
  assert (select count(*) from public.company_memberships where company_id = current_setting('t.co_a')::uuid) = 0, 'B cannot read A members';
  assert (select count(*) from public.profiles) = 1, 'B sees only self';
  assert (select count(*) from public.company_invitations) = 0, 'B sees no invites';
  assert (select count(*) from public.audit_events where company_id = current_setting('t.co_a')::uuid) = 0, 'B no A audit';
end $$;
-- B cannot invite into A, change A roles, or edit A
do $$ begin
  begin perform public.create_invitation(current_setting('t.co_a')::uuid, 'evil@x.test', 'admin');
    raise exception 'FAIL: B invited into A'; exception when sqlstate '42501' then null; end;
  begin perform public.update_company(current_setting('t.co_a')::uuid, 'Hacked', null);
    raise exception 'FAIL: B renamed A'; exception when sqlstate '42501' then null; end;
  begin perform public.admin_list_companies();
    raise exception 'FAIL: B used admin fn'; exception when sqlstate '42501' then null; end;
end $$;
commit;

-- Carrier D cannot see carrier C
begin; set local role authenticated; select pg_temp.act_as(:cd1, 'fay@gulfgate-cartage.test');
select set_config('t.co_c', :'co_c', true);
do $$ begin
  assert (select count(*) from public.companies where id = current_setting('t.co_c')::uuid) = 0, 'D cannot read C';
  assert (select count(*) from public.company_memberships where company_id = current_setting('t.co_c')::uuid) = 0, 'D cannot read C members';
end $$;
commit;

-- Member (Ben) cannot see invitations or audit, cannot invite, cannot change roles
begin; set local role authenticated; select pg_temp.act_as(:fa2, 'ben@harborline-forwarding.test');
select set_config('t.co_a', :'co_a', true);
do $$ declare v_m uuid; begin
  assert (select count(*) from public.company_invitations) = 0, 'member sees no invitations';
  assert (select count(*) from public.audit_events) = 0, 'member sees no audit';
  select id into v_m from public.company_memberships where role = 'owner';
  begin perform public.set_member_role(v_m, 'member');
    raise exception 'FAIL: member changed owner'; exception when sqlstate '42501' then null; end;
  begin perform public.create_invitation(current_setting('t.co_a')::uuid, 'z@z.test', 'member');
    raise exception 'FAIL: member invited'; exception when sqlstate '42501' then null; end;
end $$;
commit;

-- Direct table writes are blocked even for owners (must go through RPCs)
begin; set local role authenticated; select pg_temp.act_as(:fa1, 'ana@harborline-forwarding.test');
do $$ begin
  begin insert into public.company_memberships (company_id, user_id, role)
          values ((select id from public.companies limit 1), 'f1000000-0000-0000-0000-000000000001', 'admin');
    raise exception 'FAIL: direct membership insert'; exception when insufficient_privilege then null; end;
  begin update public.companies set status = 'suspended';
    raise exception 'FAIL: direct company update'; exception when insufficient_privilege then null; end;
  begin insert into public.platform_admins values ('a1000000-0000-0000-0000-000000000001');
    raise exception 'FAIL: self-promote admin'; exception when insufficient_privilege then null; end;
  begin delete from public.audit_events;
    raise exception 'FAIL: audit delete'; exception when insufficient_privilege then null; end;
end $$;
-- Profile: can update own name, not someone else's
update public.profiles set full_name = 'Ana F.' where id = 'a1000000-0000-0000-0000-000000000001';
update public.profiles set full_name = 'Hacked' where id = 'a2000000-0000-0000-0000-000000000002';
commit;
do $$ begin
  assert (select full_name from public.profiles where id = 'a1000000-0000-0000-0000-000000000001') = 'Ana F.', 'own profile updated';
  assert (select full_name from public.profiles where id = 'a2000000-0000-0000-0000-000000000002') = 'Ben Forwarder', 'other profile untouched';
end $$;

-- Last owner cannot be demoted or disabled
begin; set local role authenticated; select pg_temp.act_as(:fa1, 'ana@harborline-forwarding.test');
do $$ declare v_m uuid; begin
  select id into v_m from public.company_memberships where role = 'owner';
  begin perform public.set_member_role(v_m, 'admin');
    raise exception 'FAIL: last owner demoted'; exception when sqlstate '22023' then null; end;
  begin perform public.set_member_status(v_m, 'disabled');
    raise exception 'FAIL: last owner disabled'; exception when sqlstate '22023' then null; end;
end $$;
-- Owner promotes Ben to admin; Ben (admin) cannot touch the owner
do $$ declare v_m uuid; begin
  select id into v_m from public.company_memberships where user_id = 'a2000000-0000-0000-0000-000000000002';
  perform public.set_member_role(v_m, 'admin');
end $$;
commit;
begin; set local role authenticated; select pg_temp.act_as(:fa2, 'ben@harborline-forwarding.test');
do $$ declare v_m uuid; begin
  assert (select count(*) from public.company_invitations) = 1, 'admin sees invitations';
  select id into v_m from public.company_memberships where role = 'owner';
  begin perform public.set_member_status(v_m, 'disabled');
    raise exception 'FAIL: admin disabled owner'; exception when sqlstate '42501' then null; end;
end $$;
commit;

-- Driver Eli: sees own company, not invitations/audit
begin; set local role authenticated; select pg_temp.act_as(:cc2, 'eli@redriver-drayage.test');
do $$ begin
  assert (select count(*) from public.companies) = 1, 'driver sees own company';
  assert (select count(*) from public.company_invitations) = 0, 'driver no invitations';
  assert (select count(*) from public.audit_events) = 0, 'driver no audit';
end $$;
commit;

-- Anonymous: nothing readable; invite lookup works only with the token
begin; set local role anon;
select set_config('t.tok', :'tok_ben', true);
do $$ begin
  begin perform count(*) from public.companies;
    raise exception 'FAIL: anon read companies'; exception when insufficient_privilege then null; end;
  assert (select state from public.get_invitation(current_setting('t.tok'))) = 'accepted', 'anon invite lookup';
  assert (select count(*) from public.get_invitation('not-a-real-token')) = 0, 'bad token returns nothing';
  begin perform public.create_company('x', 'carrier');
    raise exception 'FAIL: anon create company'; exception when insufficient_privilege then null; end;
end $$;
commit;

-- ---------- Platform admin: list + suspend ----------
begin; set local role authenticated; select pg_temp.act_as(:adm, 'admin@projectlock.test');
select set_config('t.co_a', :'co_a', true);
do $$ begin
  assert (select count(*) from public.admin_list_companies()) = 4, 'admin lists 4 companies';
  perform public.admin_set_company_status(current_setting('t.co_a')::uuid, 'suspended');
end $$;
commit;

-- Suspended company's members lose access immediately
begin; set local role authenticated; select pg_temp.act_as(:fa1, 'ana@harborline-forwarding.test');
do $$ begin
  assert (select count(*) from public.companies) = 0, 'suspended: company hidden';
  assert (select count(*) from public.my_companies()) = 1, 'suspended: still listed in my_companies';
  assert (select company_status from public.my_companies()) = 'suspended', 'suspended status shown';
  assert (select count(*) from public.profiles) = 1, 'suspended: teammates hidden';
  begin perform public.create_invitation((select company_id from public.my_companies()), 'q@q.test', 'member');
    raise exception 'FAIL: suspended company invited'; exception when sqlstate '42501' then null; end;
end $$;
commit;

-- Reactivate
begin; set local role authenticated; select pg_temp.act_as(:adm, 'admin@projectlock.test');
select public.admin_set_company_status(:'co_a', 'active'); commit;
begin; set local role authenticated; select pg_temp.act_as(:fa1, 'ana@harborline-forwarding.test');
do $$ begin assert (select count(*) from public.companies) = 1, 'reactivated'; end $$;
commit;

\echo 'ALL TENANT ISOLATION TESTS PASSED'
