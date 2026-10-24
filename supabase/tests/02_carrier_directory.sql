-- Milestone 2 tests: carrier profiles, directory visibility, per-forwarder approvals, inquiries.
-- Runs after 01_tenant_isolation.sql (reuses its users and companies).

\set fa1 '''a1000000-0000-0000-0000-000000000001'''
\set fb1 '''b1000000-0000-0000-0000-000000000001'''
\set fb2 '''b2000000-0000-0000-0000-000000000002'''
\set cc1 '''c1000000-0000-0000-0000-000000000001'''
\set cc2 '''c2000000-0000-0000-0000-000000000002'''
\set cd1 '''d1000000-0000-0000-0000-000000000001'''
\set adm '''e1000000-0000-0000-0000-000000000001'''

create or replace function pg_temp.act_as(p_id uuid, p_email text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_id, 'email', p_email, 'role', 'authenticated')::text, true);
end $$;

select id as co_a from public.companies where name like 'Harborline%' \gset
select id as co_b from public.companies where name like 'Bluewake%' \gset
select id as co_c from public.companies where name like 'Red River%' \gset
select id as co_d from public.companies where name like 'Gulfgate%' \gset

-- Setup: a plain forwarder member in B (Gus)
insert into auth.users (id, email, raw_user_meta_data) values (:fb2, 'gus@bluewake-logistics.test', '{"full_name":"Gus Member"}');
insert into public.company_memberships (company_id, user_id, role) values (:'co_b', :fb2, 'member');

-- Carrier C (Dan) publishes a listed profile with coverage
begin; set local role authenticated; select pg_temp.act_as(:cc1, 'dan@redriver-drayage.test');
select public.save_carrier_profile(:'co_c', 'Port drayage out of LA/LB.', 'https://redriver.test', 'Mon–Sat 5am–9pm',
  'RRDY', '1234567', '765432', 'dispatch@redriver-drayage.test', '555-0100', 'Fictional Mutual', '2027-06-30', true);
select public.save_carrier_coverage(:'co_c',
  array[(select id from public.ports where code = 'USLAX'), (select id from public.ports where code = 'USLGB')]::smallint[],
  jsonb_build_array(jsonb_build_object('port_id', (select id from public.ports where code = 'USLGB'), 'name', 'Pier T')),
  '[{"city":"Ontario","state":"CA"},{"city":"Fontana","state":"ca"}]'::jsonb,
  '[{"category":"container","value":"40'' high cube"},{"category":"service","value":"Hazmat"}]'::jsonb);
commit;

-- Carrier D (Fay) has an unlisted profile
begin; set local role authenticated; select pg_temp.act_as(:cd1, 'fay@gulfgate-cartage.test');
select public.save_carrier_profile(:'co_d', 'Houston drayage.', null, '24/7', null, null, null,
  'ops@gulfgate-cartage.test', '555-0200', null, null, false);
commit;

-- Wrong people can't edit carrier profiles
begin; set local role authenticated;
select set_config('t.co_c', :'co_c', true);
select pg_temp.act_as(:cc2, 'eli@redriver-drayage.test'); -- driver
do $$ begin
  begin perform public.save_carrier_profile(current_setting('t.co_c')::uuid, 'x', null, '', null, null, null, null, null, null, null, true);
    raise exception 'FAIL: driver edited profile'; exception when insufficient_privilege then null; end;
end $$;
select pg_temp.act_as('d1000000-0000-0000-0000-000000000001', 'fay@gulfgate-cartage.test'); -- other carrier
do $$ begin
  begin perform public.save_carrier_coverage(current_setting('t.co_c')::uuid, '{}', '[]', '[]', '[]');
    raise exception 'FAIL: other carrier edited coverage'; exception when insufficient_privilege then null; end;
  assert (select count(*) from public.carrier_profiles where company_id = current_setting('t.co_c')::uuid) = 0, 'D cannot read C private profile';
  begin perform public.search_carriers(current_setting('t.co_c')::uuid);
    raise exception 'FAIL: carrier used directory as forwarder'; exception when insufficient_privilege then null; end;
end $$;
commit;

-- Forwarder A: directory shows C (listed), not D (unlisted); no contact details yet
begin; set local role authenticated; select pg_temp.act_as(:fa1, 'ana@harborline-forwarding.test');
select set_config('t.co_a', :'co_a', true); select set_config('t.co_c', :'co_c', true); select set_config('t.co_d', :'co_d', true);
do $$ declare r record; begin
  assert (select count(*) from public.search_carriers(current_setting('t.co_a')::uuid)) = 1, 'A sees one listed carrier';
  select * into r from public.search_carriers(current_setting('t.co_a')::uuid);
  assert r.name like 'Red River%', 'listed carrier is C';
  assert r.dispatch_email is null and r.dispatch_phone is null, 'no contact before approval';
  assert (select count(*) from public.get_carrier_for_forwarder(current_setting('t.co_a')::uuid, current_setting('t.co_d')::uuid)) = 0, 'unlisted D hidden';
  assert (select count(*) from public.carrier_ports where company_id = current_setting('t.co_d')::uuid) = 0, 'D coverage hidden';
  assert (select count(*) from public.carrier_ports where company_id = current_setting('t.co_c')::uuid) = 2, 'C ports visible';
  assert (select count(*) from public.carrier_profiles) = 0, 'forwarder cannot read profile table directly';
  -- filters
  assert (select count(*) from public.search_carriers(current_setting('t.co_a')::uuid, p_state => 'CA', p_city => 'font')) = 1, 'city filter';
  assert (select count(*) from public.search_carriers(current_setting('t.co_a')::uuid, p_state => 'TX')) = 0, 'state filter';
  assert (select count(*) from public.search_carriers(current_setting('t.co_a')::uuid, p_terminal => 'pier')) = 1, 'terminal filter';
  assert (select count(*) from public.search_carriers(current_setting('t.co_a')::uuid, p_capabilities => array['Hazmat', 'Reefer'])) = 0, 'all capabilities required';
  assert (select count(*) from public.search_carriers(current_setting('t.co_a')::uuid, p_approved_only => true)) = 0, 'none approved yet';
  begin perform public.set_carrier_relationship(current_setting('t.co_a')::uuid, current_setting('t.co_d')::uuid, 'approved');
    raise exception 'FAIL: approved unlisted carrier'; exception when sqlstate 'P0002' then null; end;
  -- Approve C with an internal note
  perform public.set_carrier_relationship(current_setting('t.co_a')::uuid, current_setting('t.co_c')::uuid, 'approved', 'Good on LGB turns');
  select * into r from public.search_carriers(current_setting('t.co_a')::uuid, p_approved_only => true);
  assert r.dispatch_email = 'dispatch@redriver-drayage.test', 'contact visible after approval';
  assert (select internal_note from public.get_carrier_for_forwarder(current_setting('t.co_a')::uuid, current_setting('t.co_c')::uuid)) = 'Good on LGB turns', 'note visible to forwarder';
end $$;
commit;

-- Forwarder B: C is NOT approved for B, and B can't see A's relationship
begin; set local role authenticated; select pg_temp.act_as(:fb1, 'cara@bluewake-logistics.test');
select set_config('t.co_b', :'co_b', true);
do $$ declare r record; begin
  select * into r from public.search_carriers(current_setting('t.co_b')::uuid);
  assert r.relationship_status is null, 'C not approved for B';
  assert r.dispatch_email is null, 'B gets no contact';
  assert (select count(*) from public.forwarder_carrier_relationships) = 0, 'B sees no relationships';
end $$;
commit;

-- Gus (B member): can suggest (pending) but not approve
begin; set local role authenticated; select pg_temp.act_as(:fb2, 'gus@bluewake-logistics.test');
select set_config('t.co_b', :'co_b', true); select set_config('t.co_c', :'co_c', true); select set_config('t.co_a', :'co_a', true);
do $$ begin
  perform public.set_carrier_relationship(current_setting('t.co_b')::uuid, current_setting('t.co_c')::uuid, 'pending');
  begin perform public.set_carrier_relationship(current_setting('t.co_b')::uuid, current_setting('t.co_c')::uuid, 'approved');
    raise exception 'FAIL: member approved carrier'; exception when insufficient_privilege then null; end;
  begin perform public.set_carrier_relationship(current_setting('t.co_b')::uuid, current_setting('t.co_c')::uuid, null);
    raise exception 'FAIL: member removed carrier'; exception when insufficient_privilege then null; end;
  begin perform public.set_carrier_relationship(current_setting('t.co_a')::uuid, current_setting('t.co_c')::uuid, 'pending');
    raise exception 'FAIL: B member wrote to A list'; exception when insufficient_privilege then null; end;
end $$;
commit;

-- Carrier C sees A as a customer (approved) but not B's pending suggestion, and never notes
begin; set local role authenticated; select pg_temp.act_as(:cc1, 'dan@redriver-drayage.test');
select set_config('t.co_c', :'co_c', true);
do $$ begin
  assert (select count(*) from public.my_customers(current_setting('t.co_c')::uuid)) = 1, 'C has one customer';
  assert (select name from public.my_customers(current_setting('t.co_c')::uuid)) like 'Harborline%', 'customer is A';
  assert (select count(*) from public.forwarder_carrier_relationships) = 1, 'C sees only approved rows';
  begin perform internal_note from public.forwarder_carrier_relationships;
    raise exception 'FAIL: carrier read internal note'; exception when insufficient_privilege then null; end;
end $$;
commit;

-- Sales inquiries: anon can submit, nobody but admins can read
begin; set local role anon;
select public.submit_sales_inquiry('Pat Prospect', 'pat@prospect.test', 'Prospect Freight', 'forwarder', null, '50–200', 'Forwarder', 'Interested.');
do $$ begin
  begin perform count(*) from public.sales_inquiries;
    raise exception 'FAIL: anon read inquiries'; exception when insufficient_privilege then null; end;
end $$;
commit;
begin; set local role authenticated; select pg_temp.act_as(:fa1, 'ana@harborline-forwarding.test');
do $$ begin assert (select count(*) from public.sales_inquiries) = 0, 'non-admin sees no inquiries'; end $$;
commit;
begin; set local role authenticated; select pg_temp.act_as(:adm, 'admin@projectlock.test');
select set_config('t.co_c', :'co_c', true);
do $$ begin
  assert (select count(*) from public.sales_inquiries) = 1, 'admin sees inquiry';
  perform public.admin_set_qualification(current_setting('t.co_c')::uuid, 'verified');
  assert (select qualification_status from public.admin_list_carriers() where company_id = current_setting('t.co_c')::uuid) = 'verified', 'verified';
end $$;
commit;

-- Changing insurance sends a verified carrier back to review
begin; set local role authenticated; select pg_temp.act_as(:cc1, 'dan@redriver-drayage.test');
select public.save_carrier_profile(:'co_c', 'Port drayage out of LA/LB.', 'https://redriver.test', 'Mon–Sat 5am–9pm',
  'RRDY', '1234567', '765432', 'dispatch@redriver-drayage.test', '555-0100', 'Fictional Mutual', '2028-06-30', true);
do $$ begin assert (select qualification_status from public.carrier_profiles) = 'in_review', 'back to review'; end $$;
commit;

-- Non-admins can't verify
begin; set local role authenticated; select pg_temp.act_as(:cc1, 'dan@redriver-drayage.test');
select set_config('t.co_c', :'co_c', true);
do $$ begin
  begin perform public.admin_set_qualification(current_setting('t.co_c')::uuid, 'verified');
    raise exception 'FAIL: carrier self-verified'; exception when insufficient_privilege then null; end;
end $$;
commit;

\echo 'ALL CARRIER DIRECTORY TESTS PASSED'
