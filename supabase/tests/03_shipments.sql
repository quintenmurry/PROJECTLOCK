-- Milestone 3 tests: shipments, driver access, documents, customer share links.
-- Runs after 01 and 02 (reuses their users and companies).

\set fa1 '''a1000000-0000-0000-0000-000000000001'''
\set cc1 '''c1000000-0000-0000-0000-000000000001'''
\set cc2 '''c2000000-0000-0000-0000-000000000002'''
\set cd1 '''d1000000-0000-0000-0000-000000000001'''

create or replace function pg_temp.act_as(p_id uuid, p_email text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_id, 'email', p_email, 'role', 'authenticated')::text, true);
end $$;

select id as co_c from public.companies where name like 'Red River%' \gset
select id as co_d from public.companies where name like 'Gulfgate%' \gset

-- Dan (carrier C owner) creates two shipments; the first is assigned to driver Eli
begin; set local role authenticated; select pg_temp.act_as(:cc1, 'dan@redriver-drayage.test');
select public.create_shipment(:'co_c',
  jsonb_build_object('customer_name', 'Harborline Forwarding', 'customer_reference', 'HLF-2611', 'booking_number', 'bk123',
    'bol_number', 'hlf2611047', 'pickup_location', 'Long Beach, Pier T', 'delivery_location', 'Ontario, CA 91761',
    'internal_notes', 'Rate $450 + chassis', 'driver_user_id', 'c2000000-0000-0000-0000-000000000002', 'truck_ref', '14'),
  '[{"container_number":"msdu 482019-3","size_type":"40'' HC","seal_number":"S1"},{"container_number":"TGHU1234567"}]'::jsonb) as ship1 \gset
select public.create_shipment(:'co_c', '{"customer_name":"Walk-in"}'::jsonb, '[]'::jsonb) as ship2 \gset
commit;

do $$ begin
  assert (select shipment_number from public.shipments order by shipment_number limit 1) = 1001, 'numbering starts at 1001';
  assert (select max(shipment_number) from public.shipments) = 1002, 'numbering increments';
  assert (select status from public.shipments where shipment_number = 1001) = 'dispatched', 'assigned shipment starts dispatched';
  assert (select container_number from public.shipment_containers order by position limit 1) = 'MSDU4820193', 'container normalized';
end $$;

-- Validation: bad container number, driver from another company
begin; set local role authenticated; select pg_temp.act_as(:cc1, 'dan@redriver-drayage.test');
select set_config('t.co_c', :'co_c', true);
do $$ begin
  begin perform public.create_shipment(current_setting('t.co_c')::uuid, '{}'::jsonb, '[{"container_number":"ABC123"}]'::jsonb);
    raise exception 'FAIL: bad container accepted'; exception when sqlstate '22023' then null; end;
  begin perform public.create_shipment(current_setting('t.co_c')::uuid, '{"driver_user_id":"d1000000-0000-0000-0000-000000000001"}'::jsonb, '[]'::jsonb);
    raise exception 'FAIL: foreign driver accepted'; exception when sqlstate '22023' then null; end;
end $$;
commit;

-- Another carrier (Fay) and a forwarder (Ana) see nothing and can change nothing
begin; set local role authenticated; select pg_temp.act_as(:cd1, 'fay@gulfgate-cartage.test');
select set_config('t.s1', :'ship1', true);
do $$ begin
  assert (select count(*) from public.shipments) = 0, 'other carrier sees no shipments';
  assert (select count(*) from public.shipment_containers) = 0, 'other carrier sees no containers';
  assert (select count(*) from public.shipment_events) = 0, 'other carrier sees no events';
  begin perform public.set_shipment_status(current_setting('t.s1')::uuid, 'completed');
    raise exception 'FAIL: other carrier changed status'; exception when insufficient_privilege then null; end;
  begin perform public.update_shipment(current_setting('t.s1')::uuid, '{}'::jsonb, null);
    raise exception 'FAIL: other carrier edited'; exception when insufficient_privilege then null; end;
  begin perform public.create_share_link(current_setting('t.s1')::uuid, 'x', null);
    raise exception 'FAIL: other carrier shared'; exception when insufficient_privilege then null; end;
  begin perform * from public.driver_shipment(current_setting('t.s1')::uuid);
    raise exception 'FAIL: other carrier read via driver rpc'; exception when insufficient_privilege then null; end;
  begin perform public.begin_document_upload(current_setting('t.s1')::uuid, 'pod', 'x.pdf', 'application/pdf', 10);
    raise exception 'FAIL: other carrier uploaded'; exception when insufficient_privilege then null; end;
end $$;
commit;
begin; set local role authenticated; select pg_temp.act_as(:fa1, 'ana@harborline-forwarding.test');
do $$ begin assert (select count(*) from public.shipments) = 0, 'forwarder sees no carrier shipments'; end $$;
commit;

-- Driver Eli: only his load, safe fields, forward-only milestones
begin; set local role authenticated; select pg_temp.act_as(:cc2, 'eli@redriver-drayage.test');
select set_config('t.s1', :'ship1', true); select set_config('t.s2', :'ship2', true);
do $$ declare v_doc uuid; begin
  assert (select count(*) from public.shipments) = 0, 'driver cannot read shipments table (internal notes)';
  assert (select count(*) from public.driver_shipments()) = 1, 'driver sees one load';
  assert (select array_length(containers, 1) from public.driver_shipments()) = 2, 'driver sees containers';
  begin perform * from public.driver_shipment(current_setting('t.s2')::uuid);
    raise exception 'FAIL: driver read unassigned load'; exception when insufficient_privilege then null; end;
  perform public.set_shipment_status(current_setting('t.s1')::uuid, 'picked_up');
  begin perform public.set_shipment_status(current_setting('t.s1')::uuid, 'dispatched');
    raise exception 'FAIL: driver moved backward'; exception when insufficient_privilege then null; end;
  begin perform public.set_shipment_status(current_setting('t.s1')::uuid, 'completed');
    raise exception 'FAIL: driver completed'; exception when insufficient_privilege then null; end;
  perform public.add_shipment_note(current_setting('t.s1')::uuid, 'Gate line 40 min', false);
  perform public.set_shipment_exception(current_setting('t.s1')::uuid, true, 'Chassis flat');
  begin perform public.set_shipment_exception(current_setting('t.s1')::uuid, false);
    raise exception 'FAIL: driver resolved exception'; exception when insufficient_privilege then null; end;
  begin perform public.begin_document_upload(current_setting('t.s1')::uuid, 'rate_confirmation', 'r.pdf', 'application/pdf', 10);
    raise exception 'FAIL: driver uploaded rate'; exception when insufficient_privilege then null; end;
  begin perform public.begin_document_upload(current_setting('t.s1')::uuid, 'pod', 'x.exe', 'application/x-msdownload', 10);
    raise exception 'FAIL: exe accepted'; exception when sqlstate '22023' then null; end;
  perform public.set_shipment_status(current_setting('t.s1')::uuid, 'delivered');
end $$;
select document_id as pod_doc, storage_path as pod_path from public.begin_document_upload(:'ship1', 'pod', 'pod.jpg', 'image/jpeg', 2048) \gset
-- finishing before the file exists fails
do $$ begin
  begin perform public.finish_document_upload(current_setting('t.pod', true)::uuid);
  exception when others then null; end;
end $$;
commit;

do $$ begin
  assert (select internal from public.shipment_events where kind = 'note') = true, 'driver notes are internal';
  assert (select source from public.shipment_events where kind = 'status' and to_status = 'picked_up') = 'driver', 'source recorded';
end $$;

-- Board: delivered with no completed POD counts as awaiting POD
begin; set local role authenticated; select pg_temp.act_as(:cc1, 'dan@redriver-drayage.test');
select set_config('t.co_c', :'co_c', true);
do $$ begin
  assert (select awaiting_pod_count from public.shipment_board_counts(current_setting('t.co_c')::uuid)) = 1, 'awaiting POD';
  assert (select exception_count from public.shipment_board_counts(current_setting('t.co_c')::uuid)) = 1, 'exception counted';
end $$;
commit;

-- Simulate the file landing in storage, then Eli finishes the upload
insert into storage.objects (bucket_id, name) values ('shipment-documents', :'pod_path');
begin; set local role authenticated; select pg_temp.act_as(:cc2, 'eli@redriver-drayage.test');
select public.finish_document_upload(:'pod_doc');
commit;

begin; set local role authenticated; select pg_temp.act_as(:cc1, 'dan@redriver-drayage.test');
select set_config('t.co_c', :'co_c', true); select set_config('t.s1', :'ship1', true);
do $$ begin
  assert (select awaiting_pod_count from public.shipment_board_counts(current_setting('t.co_c')::uuid)) = 0, 'POD clears flag';
  begin perform id, recipient_label, open_count from public.shipment_share_links;
  exception when insufficient_privilege then raise exception 'FAIL: dispatch cannot list links'; end;
end $$;
-- Dan uploads a rate confirmation: never shareable
select document_id as rate_doc, storage_path as rate_path from public.begin_document_upload(:'ship1', 'rate_confirmation', 'rate.pdf', 'application/pdf', 1000) \gset
commit;
insert into storage.objects (bucket_id, name) values ('shipment-documents', :'rate_path');
begin; set local role authenticated; select pg_temp.act_as(:cc1, 'dan@redriver-drayage.test');
select public.finish_document_upload(:'rate_doc');
select set_config('t.rate', :'rate_doc', true);
do $$ begin
  assert (select shared_with_customer from public.shipment_documents where id = current_setting('t.rate')::uuid) = false, 'rate not shared';
  begin perform public.set_document_shared(current_setting('t.rate')::uuid, true);
    raise exception 'FAIL: rate shared'; exception when sqlstate '22023' then null; end;
end $$;
select token as share_tok, link_id as share_link from public.create_share_link(:'ship1', 'Harborline Forwarding', 'ops@harborline-forwarding.test', 30) \gset
do $$ begin
  begin perform token_hash from public.shipment_share_links;
    raise exception 'FAIL: token hash readable'; exception when insufficient_privilege then null; end;
end $$;
commit;

-- Driver cannot see the rate confirmation
begin; set local role authenticated; select pg_temp.act_as(:cc2, 'eli@redriver-drayage.test');
select set_config('t.rate', :'rate_doc', true);
do $$ begin
  assert (select count(*) from public.shipment_documents where id = current_setting('t.rate')::uuid) = 0, 'driver cannot see rate doc';
  assert public.document_path_for_download(current_setting('t.rate')::uuid) is null, 'driver cannot download rate doc';
end $$;
commit;

-- Customer (anonymous) opens the link
begin; set local role anon;
select set_config('t.tok', :'share_tok', true);
do $$ declare j jsonb; begin
  j := public.get_shared_shipment(current_setting('t.tok'));
  assert j ->> 'state' = 'ok', 'link works';
  assert jsonb_array_length(j -> 'documents') = 1, 'only the POD is shared (rate hidden)';
  assert (j -> 'documents' -> 0 ->> 'type') = 'pod', 'shared doc is POD';
  assert not (j::text ilike '%Rate $450%'), 'internal notes never shared';
  assert not (j::text ilike '%Gate line 40%'), 'driver notes never shared';
  assert jsonb_array_length(j -> 'containers') = 2, 'containers shared';
  assert public.get_shared_shipment('deadbeef') is null, 'bad token';
  begin perform public.resolve_shared_document(current_setting('t.tok'), gen_random_uuid());
    raise exception 'FAIL: anon resolved document'; exception when insufficient_privilege then null; end;
  begin perform count(*) from public.shipments;
    raise exception 'FAIL: anon read shipments'; exception when insufficient_privilege then null; end;
end $$;
commit;

-- Download resolution (service role, as the edge function does)
begin; set local role service_role;
select set_config('t.tok', :'share_tok', true); select set_config('t.pod', :'pod_doc', true); select set_config('t.rate', :'rate_doc', true);
do $$ begin
  assert public.resolve_shared_document(current_setting('t.tok'), current_setting('t.pod')::uuid) like '%.jpg', 'POD resolves';
  assert public.resolve_shared_document(current_setting('t.tok'), current_setting('t.rate')::uuid) is null, 'rate never resolves';
end $$;
commit;

do $$ begin
  assert (select open_count from public.shipment_share_links) = 1, 'open counted';
  assert exists (select 1 from public.shipment_events where kind = 'document_downloaded'), 'download logged';
end $$;

-- Fay cannot revoke Dan's link; Dan can
begin; set local role authenticated; select pg_temp.act_as(:cd1, 'fay@gulfgate-cartage.test');
select set_config('t.link', :'share_link', true);
do $$ begin
  begin perform public.revoke_share_link(current_setting('t.link')::uuid);
    raise exception 'FAIL: other carrier revoked'; exception when insufficient_privilege then null; end;
end $$;
commit;
begin; set local role authenticated; select pg_temp.act_as(:cc1, 'dan@redriver-drayage.test');
select public.revoke_share_link(:'share_link');
commit;
begin; set local role anon;
select set_config('t.tok', :'share_tok', true);
do $$ begin assert public.get_shared_shipment(current_setting('t.tok')) ->> 'state' = 'revoked', 'revoked link'; end $$;
commit;
begin; set local role service_role;
select set_config('t.tok', :'share_tok', true); select set_config('t.pod', :'pod_doc', true);
do $$ begin assert public.resolve_shared_document(current_setting('t.tok'), current_setting('t.pod')::uuid) is null, 'revoked link cannot download'; end $$;
commit;

\echo 'ALL SHIPMENT TESTS PASSED'
