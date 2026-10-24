-- Dispatch sheets: send a trucker (company driver or outside owner-operator) a secure link with the
-- load details and the documents the carrier picks (DO by default). Built on shipment_share_links.

alter table public.shipment_share_links
  add column kind text not null default 'customer' check (kind in ('customer', 'dispatch')),
  add column document_ids uuid[],
  add column driver_user_id uuid references auth.users (id) on delete set null,
  add column recipient_phone text check (recipient_phone is null or char_length(recipient_phone) <= 40),
  add column message text check (message is null or char_length(message) <= 1000);

grant select (kind, document_ids, driver_user_id, recipient_phone, message) on public.shipment_share_links to authenticated;

alter table public.shipment_events drop constraint shipment_events_kind_check;
alter table public.shipment_events add constraint shipment_events_kind_check check (kind in (
  'created', 'status', 'note', 'document', 'assignment', 'exception', 'exception_resolved', 'shared',
  'link_opened', 'document_downloaded', 'link_revoked', 'updated', 'dispatch_sent'));

create or replace function public.send_dispatch(
  p_shipment uuid, p_driver uuid, p_name text, p_email text, p_phone text,
  p_document_ids uuid[], p_message text, p_days int default 14
) returns table (link_id uuid, token text, expires_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare
  v_company uuid;
  v_status public.shipment_status;
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
  v_id uuid;
  v_exp timestamptz := now() + make_interval(days => least(greatest(coalesce(p_days, 14), 1), 90));
  v_name text := btrim(coalesce(p_name, ''));
  v_order text[] := array['new', 'awaiting_release', 'ready', 'dispatched'];
begin
  if not public.can_dispatch_shipment(p_shipment) then raise exception 'Not allowed' using errcode = '42501'; end if;
  select carrier_company_id, status into v_company, v_status from public.shipments where id = p_shipment for update;
  perform public.validate_driver(v_company, p_driver);
  if p_driver is not null and v_name = '' then
    select coalesce(nullif(full_name, ''), email) into v_name from public.profiles where id = p_driver;
  end if;
  if v_name = '' then raise exception 'Who are you dispatching?' using errcode = '22023'; end if;
  if coalesce(cardinality(p_document_ids), 0) > 30 then raise exception 'Too many documents' using errcode = '22023'; end if;
  if exists (
    select 1 from unnest(coalesce(p_document_ids, '{}')) want
     where not exists (select 1 from public.shipment_documents d
                        where d.id = want and d.shipment_id = p_shipment and d.upload_complete and d.superseded_at is null)
  ) then
    raise exception 'One of the selected documents is no longer on this shipment. Reload and try again.' using errcode = '22023';
  end if;

  insert into public.shipment_share_links (shipment_id, token_hash, recipient_label, recipient_email, recipient_phone,
    expires_at, created_by, kind, document_ids, driver_user_id, message)
  values (p_shipment, public.hash_token(v_token), v_name, nullif(lower(btrim(coalesce(p_email, ''))), ''),
    nullif(btrim(coalesce(p_phone, '')), ''), v_exp, (select auth.uid()), 'dispatch',
    coalesce(p_document_ids, '{}'), p_driver, nullif(btrim(coalesce(p_message, '')), ''))
  returning id into v_id;

  -- Assign the company driver, and move the load to dispatched if it wasn't there yet.
  update public.shipments set
    driver_user_id = coalesce(p_driver, driver_user_id),
    status = case when array_position(v_order, v_status::text) is not null and v_status <> 'dispatched' then 'dispatched' else status end
  where id = p_shipment;

  perform public.log_shipment_event(p_shipment, 'dispatch_sent', 'Dispatched to ' || v_name, false, 'dispatch', null, null,
    jsonb_build_object('link_id', v_id, 'documents', coalesce(cardinality(p_document_ids), 0)));
  if array_position(v_order, v_status::text) is not null and v_status <> 'dispatched' then
    perform public.log_shipment_event(p_shipment, 'status', null, false, 'dispatch', v_status, 'dispatched');
  end if;
  return query select v_id, v_token, v_exp;
end;
$$;

-- Shared view, now aware of dispatch sheets (which include instructions and the hand-picked documents).
create or replace function public.get_shared_shipment(p_token text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  l public.shipment_share_links;
  s public.shipments;
  v_dispatch boolean;
  v_result jsonb;
begin
  if p_token !~ '^[a-f0-9]{64}$' then return null; end if;
  select * into l from public.shipment_share_links where token_hash = public.hash_token(p_token);
  if l.id is null then return null; end if;
  if l.revoked_at is not null then return jsonb_build_object('state', 'revoked'); end if;
  if l.expires_at < now() then return jsonb_build_object('state', 'expired'); end if;
  select * into s from public.shipments where id = l.shipment_id;
  if (select status from public.companies where id = s.carrier_company_id) <> 'active' then
    return jsonb_build_object('state', 'unavailable');
  end if;
  v_dispatch := l.kind = 'dispatch';

  if l.last_opened_at is null or l.last_opened_at < now() - interval '30 minutes' then
    insert into public.shipment_events (shipment_id, kind, body, source, metadata)
    values (s.id, 'link_opened', l.recipient_label || case when v_dispatch then ' opened the dispatch sheet' else ' opened the shared link' end,
      'share_link', jsonb_build_object('link_id', l.id));
  end if;
  update public.shipment_share_links set open_count = open_count + 1, last_opened_at = now(),
    first_opened_at = coalesce(first_opened_at, now()) where id = l.id;

  select jsonb_build_object(
    'state', 'ok',
    'kind', l.kind,
    'recipient', l.recipient_label,
    'message', case when v_dispatch then l.message end,
    'expires_at', l.expires_at,
    'carrier', (select jsonb_build_object('name', c.name, 'phone', p.dispatch_phone, 'email', p.dispatch_email)
                  from public.companies c left join public.carrier_profiles p on p.company_id = c.id
                 where c.id = s.carrier_company_id),
    'shipment', jsonb_build_object(
      'number', s.shipment_number, 'status', s.status, 'move_type', s.move_type,
      'customer_reference', case when v_dispatch then null else s.customer_reference end,
      'booking_number', s.booking_number, 'bol_number', s.bol_number,
      'pickup_location', s.pickup_location, 'delivery_location', s.delivery_location,
      'empty_return_location', s.empty_return_location,
      'pickup_at', s.pickup_at, 'delivery_at', s.delivery_at, 'empty_return_at', s.empty_return_at,
      'last_free_day', case when v_dispatch then s.last_free_day end,
      'special_instructions', case when v_dispatch then s.special_instructions end,
      'truck_ref', case when v_dispatch then s.truck_ref end,
      'chassis_ref', case when v_dispatch then s.chassis_ref end,
      'exception_open', s.exception_open, 'exception_note', case when s.exception_open then s.exception_note end,
      'updated_at', s.last_activity_at),
    'containers', coalesce((select jsonb_agg(jsonb_build_object('number', c.container_number, 'size_type', c.size_type, 'seal', c.seal_number) order by c.position)
                    from public.shipment_containers c where c.shipment_id = s.id), '[]'::jsonb),
    'events', case when v_dispatch then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object('kind', e.kind, 'to_status', e.to_status, 'body',
                        case when e.kind in ('status', 'exception', 'exception_resolved') then e.body end,
                        'source', e.source, 'at', e.occurred_at) order by e.occurred_at desc)
                    from public.shipment_events e
                   where e.shipment_id = s.id and not e.internal and e.kind in ('created', 'status', 'exception', 'exception_resolved')), '[]'::jsonb) end,
    'documents', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'type', d.doc_type, 'name', d.file_name,
                        'mime', d.mime_type, 'size', d.size_bytes, 'at', d.created_at) order by d.created_at desc)
                    from public.shipment_documents d
                   where d.shipment_id = s.id and d.upload_complete and d.superseded_at is null
                     and case when v_dispatch then d.id = any (coalesce(l.document_ids, '{}'))
                              else d.shared_with_customer end), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

create or replace function public.resolve_shared_document(p_token text, p_document uuid)
returns text language plpgsql security definer set search_path = ''
as $$
declare l public.shipment_share_links; d public.shipment_documents;
begin
  if p_token !~ '^[a-f0-9]{64}$' then return null; end if;
  select * into l from public.shipment_share_links where token_hash = public.hash_token(p_token);
  if l.id is null or l.revoked_at is not null or l.expires_at < now() then return null; end if;
  select * into d from public.shipment_documents
   where id = p_document and shipment_id = l.shipment_id and upload_complete and superseded_at is null
     and case when l.kind = 'dispatch' then id = any (coalesce(l.document_ids, '{}')) else shared_with_customer end;
  if d.id is null then return null; end if;
  insert into public.shipment_events (shipment_id, kind, body, source, metadata)
  values (l.shipment_id, 'document_downloaded',
    l.recipient_label || ' downloaded ' || case d.doc_type when 'pod' then 'the POD' when 'delivery_order' then 'the DO' else d.file_name end,
    'share_link', jsonb_build_object('link_id', l.id, 'document_id', d.id, 'doc_type', d.doc_type));
  return d.storage_path;
end;
$$;

-- Customer links created before this migration keep kind = 'customer'. Make sure the existing
-- create_share_link keeps producing customer links (default handles it).

revoke execute on function public.send_dispatch(uuid, uuid, text, text, text, uuid[], text, int) from public, anon;
grant execute on function public.send_dispatch(uuid, uuid, text, text, text, uuid[], text, int) to authenticated;
revoke execute on function public.get_shared_shipment(text) from public;
grant execute on function public.get_shared_shipment(text) to anon, authenticated;
revoke execute on function public.resolve_shared_document(text, uuid) from public, anon, authenticated;
grant execute on function public.resolve_shared_document(text, uuid) to service_role;
