-- Dispatch sheets: carrier sends a trucker the load and hand-picked documents.
\set cc1 '''c1000000-0000-0000-0000-000000000001'''
\set cc2 '''c2000000-0000-0000-0000-000000000002'''
\set cd1 '''d1000000-0000-0000-0000-000000000001'''

create or replace function pg_temp.act_as(p_id uuid, p_email text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_id, 'email', p_email, 'role', 'authenticated')::text, true);
end $$;

select id as ship1 from public.shipments where shipment_number = 1001 \gset
select id as ship2 from public.shipments where shipment_number = 1002 \gset
select id as rate_doc from public.shipment_documents where doc_type = 'rate_confirmation' \gset
select id as pod_doc from public.shipment_documents where doc_type = 'pod' \gset

-- Dan dispatches load 1001 to an outside owner-operator with only the rate confirmation
begin; set local role authenticated; select pg_temp.act_as(:cc1, 'dan@redriver-drayage.test');
select token as disp_tok from public.send_dispatch(:'ship1', null, 'Joe Owner-Op', 'joe@owneroperator.test', '555-0300',
  array[:'rate_doc']::uuid[], 'Pier T, gate 4', 14) \gset
-- Dispatch load 1002 (status new) to company driver Eli with no documents
select public.send_dispatch(:'ship2', 'c2000000-0000-0000-0000-000000000002', '', null, null, '{}', null, 14);
select set_config('t.s1', :'ship1', true);
do $$ begin
  begin perform public.send_dispatch(current_setting('t.s1')::uuid, null, 'X', null, null, array[gen_random_uuid()], null, 7);
    raise exception 'FAIL: foreign document accepted'; exception when sqlstate '22023' then null; end;
  begin perform public.send_dispatch(current_setting('t.s1')::uuid, null, '', null, null, '{}', null, 7);
    raise exception 'FAIL: nameless dispatch'; exception when sqlstate '22023' then null; end;
end $$;
commit;

do $$ begin
  assert (select status from public.shipments where shipment_number = 1002) = 'dispatched', 'new load moved to dispatched';
  assert (select driver_user_id from public.shipments where shipment_number = 1002) = 'c2000000-0000-0000-0000-000000000002', 'driver assigned';
  assert (select recipient_label from public.shipment_share_links where kind = 'dispatch' and driver_user_id is not null) = 'Eli Driver', 'driver name filled in';
  assert (select status from public.shipments where shipment_number = 1001) = 'delivered', 'later statuses untouched';
  assert exists (select 1 from public.shipment_events where kind = 'dispatch_sent'), 'dispatch logged';
end $$;

-- Another carrier cannot dispatch
begin; set local role authenticated; select pg_temp.act_as(:cd1, 'fay@gulfgate-cartage.test');
select set_config('t.s1', :'ship1', true);
do $$ begin
  begin perform public.send_dispatch(current_setting('t.s1')::uuid, null, 'X', null, null, '{}', null, 7);
    raise exception 'FAIL: other carrier dispatched'; exception when insufficient_privilege then null; end;
end $$;
commit;

-- The trucker opens the sheet: only the selected document, instructions included, no customer ref or timeline
begin; set local role anon;
select set_config('t.tok', :'disp_tok', true);
do $$ declare j jsonb; begin
  j := public.get_shared_shipment(current_setting('t.tok'));
  assert j ->> 'kind' = 'dispatch', 'dispatch kind';
  assert jsonb_array_length(j -> 'documents') = 1, 'only selected doc';
  assert j -> 'documents' -> 0 ->> 'type' = 'rate_confirmation', 'carrier chose the rate conf';
  assert j ->> 'message' = 'Pier T, gate 4', 'message shown';
  assert (j -> 'shipment' ->> 'customer_reference') is null, 'customer ref hidden from trucker';
  assert jsonb_array_length(j -> 'events') = 0, 'no timeline on dispatch sheet';
  assert not (j::text ilike '%Rate $450%'), 'internal notes never shown';
end $$;
commit;
begin; set local role service_role;
select set_config('t.tok', :'disp_tok', true); select set_config('t.rate', :'rate_doc', true); select set_config('t.pod', :'pod_doc', true);
do $$ begin
  assert public.resolve_shared_document(current_setting('t.tok'), current_setting('t.rate')::uuid) is not null, 'selected doc downloads';
  assert public.resolve_shared_document(current_setting('t.tok'), current_setting('t.pod')::uuid) is null, 'unselected doc blocked';
end $$;
commit;

\echo 'ALL DISPATCH TESTS PASSED'
