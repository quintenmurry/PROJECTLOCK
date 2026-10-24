-- Milestone 3: carrier-owned, self-contained shipments.
-- Every shipment carries its own containers, documents, activity timeline and customer share links.

create type public.shipment_status as enum (
  'new', 'awaiting_release', 'ready', 'dispatched', 'picked_up', 'delivered', 'empty_returned', 'completed', 'canceled'
);
create type public.move_type as enum ('import', 'export', 'empty', 'other');
create type public.document_type as enum (
  'delivery_order', 'bol', 'gate_receipt', 'eir', 'pod', 'damage_photo', 'rate_confirmation', 'invoice', 'other'
);
create type public.event_source as enum ('dispatch', 'driver', 'share_link', 'system');

-- Per-company counters for human-friendly shipment numbers (#1001, #1002, ...)
create table public.company_counters (
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  value bigint not null,
  primary key (company_id, name)
);

create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  carrier_company_id uuid not null references public.companies (id) on delete cascade,
  shipment_number bigint not null,
  status public.shipment_status not null default 'new',
  move_type public.move_type not null default 'import',
  -- customer (free text now; linked forwarder company later)
  customer_name text not null default '' check (char_length(customer_name) <= 160),
  customer_reference text check (customer_reference is null or char_length(customer_reference) <= 80),
  forwarder_company_id uuid references public.companies (id) on delete set null,
  -- references
  booking_number text check (booking_number is null or char_length(booking_number) <= 60),
  bol_number text check (bol_number is null or char_length(bol_number) <= 60),
  -- route
  pickup_location text not null default '' check (char_length(pickup_location) <= 200),
  delivery_location text not null default '' check (char_length(delivery_location) <= 300),
  empty_return_location text check (empty_return_location is null or char_length(empty_return_location) <= 200),
  pickup_at timestamptz,
  delivery_at timestamptz,
  empty_return_at timestamptz,
  last_free_day date,
  -- instructions and notes
  special_instructions text not null default '' check (char_length(special_instructions) <= 4000),
  internal_notes text not null default '' check (char_length(internal_notes) <= 4000),
  -- assignment
  driver_user_id uuid references auth.users (id) on delete set null,
  truck_ref text check (truck_ref is null or char_length(truck_ref) <= 40),
  chassis_ref text check (chassis_ref is null or char_length(chassis_ref) <= 40),
  -- exceptions
  exception_open boolean not null default false,
  exception_note text check (exception_note is null or char_length(exception_note) <= 1000),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (carrier_company_id, shipment_number)
);
create index shipments_board_idx on public.shipments (carrier_company_id, status, last_activity_at desc);
create index shipments_driver_idx on public.shipments (driver_user_id, status) where driver_user_id is not null;
create index shipments_booking_idx on public.shipments (carrier_company_id, booking_number);
create index shipments_bol_idx on public.shipments (carrier_company_id, bol_number);
create trigger shipments_touch before update on public.shipments
  for each row execute function public.touch_updated_at();

create table public.shipment_containers (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.shipments (id) on delete cascade,
  container_number text not null check (container_number ~ '^[A-Z]{4}[0-9]{6,7}$'),
  size_type text check (size_type is null or char_length(size_type) <= 40),
  seal_number text check (seal_number is null or char_length(seal_number) <= 40),
  weight_lbs integer check (weight_lbs is null or weight_lbs between 0 and 200000),
  position smallint not null default 0,
  unique (shipment_id, container_number)
);
create index shipment_containers_number_idx on public.shipment_containers (container_number);

create table public.shipment_documents (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.shipments (id) on delete cascade,
  doc_type public.document_type not null,
  storage_path text not null unique,
  file_name text not null check (char_length(file_name) between 1 and 200),
  mime_type text not null check (char_length(mime_type) <= 100),
  size_bytes bigint not null check (size_bytes between 1 and 26214400),
  shared_with_customer boolean not null default true,
  uploaded_by uuid references auth.users (id) on delete set null,
  uploaded_via public.event_source not null default 'dispatch',
  replaces_document_id uuid references public.shipment_documents (id) on delete set null,
  upload_complete boolean not null default false,
  superseded_at timestamptz,
  created_at timestamptz not null default now(),
  -- Rates and invoices are never shared with customers.
  check (not (shared_with_customer and doc_type in ('rate_confirmation', 'invoice')))
);
create index shipment_documents_shipment_idx on public.shipment_documents (shipment_id, created_at desc);

create table public.shipment_events (
  id bigint generated always as identity primary key,
  shipment_id uuid not null references public.shipments (id) on delete cascade,
  kind text not null check (kind in ('created', 'status', 'note', 'document', 'assignment', 'exception', 'exception_resolved', 'shared', 'link_opened', 'document_downloaded', 'link_revoked', 'updated')),
  from_status public.shipment_status,
  to_status public.shipment_status,
  body text check (body is null or char_length(body) <= 2000),
  internal boolean not null default false,
  actor_id uuid references auth.users (id) on delete set null,
  source public.event_source not null default 'dispatch',
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);
create index shipment_events_shipment_idx on public.shipment_events (shipment_id, occurred_at desc);

create table public.shipment_share_links (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.shipments (id) on delete cascade,
  token_hash text not null unique,
  recipient_label text not null check (char_length(btrim(recipient_label)) between 1 and 120),
  recipient_email text check (recipient_email is null or recipient_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  open_count integer not null default 0,
  first_opened_at timestamptz,
  last_opened_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index shipment_share_links_shipment_idx on public.shipment_share_links (shipment_id);

-- ---------------------------------------------------------------------------
-- Access helpers
-- ---------------------------------------------------------------------------
create or replace function public.shipment_role(p_shipment uuid)
returns text language sql stable security definer set search_path = ''
as $$
  -- 'dispatch' for carrier owner/admin/dispatcher, 'driver' for the assigned driver, else null
  select case
    when public.has_role(s.carrier_company_id, array['owner', 'admin', 'dispatcher']::public.member_role[]) then 'dispatch'
    when s.driver_user_id = (select auth.uid())
         and public.has_role(s.carrier_company_id, array['driver']::public.member_role[]) then 'driver'
  end
  from public.shipments s where s.id = p_shipment;
$$;

create or replace function public.can_dispatch_shipment(p_shipment uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select coalesce(public.shipment_role(p_shipment) = 'dispatch', false); $$;

create or replace function public.can_view_shipment(p_shipment uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select public.shipment_role(p_shipment) is not null; $$;

create or replace function public.touch_shipment_activity(p_shipment uuid)
returns void language sql security definer set search_path = ''
as $$ update public.shipments set last_activity_at = now() where id = p_shipment; $$;

create or replace function public.log_shipment_event(
  p_shipment uuid, p_kind text, p_body text default null, p_internal boolean default false,
  p_source public.event_source default 'dispatch', p_from public.shipment_status default null,
  p_to public.shipment_status default null, p_metadata jsonb default '{}'::jsonb
) returns void language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.shipment_events (shipment_id, kind, body, internal, actor_id, source, from_status, to_status, metadata)
  values (p_shipment, p_kind, p_body, p_internal, (select auth.uid()), p_source, p_from, p_to, coalesce(p_metadata, '{}'::jsonb));
  perform public.touch_shipment_activity(p_shipment);
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.company_counters enable row level security;
alter table public.shipments enable row level security;
alter table public.shipment_containers enable row level security;
alter table public.shipment_documents enable row level security;
alter table public.shipment_events enable row level security;
alter table public.shipment_share_links enable row level security;

revoke all on public.company_counters, public.shipments, public.shipment_containers, public.shipment_documents,
  public.shipment_events, public.shipment_share_links from anon, authenticated;

-- Dispatch reads everything through RLS. Drivers read through RPCs (they must not see notes or rates).
grant select on public.shipments, public.shipment_containers, public.shipment_documents,
  public.shipment_events, public.shipment_share_links to authenticated;

create policy shipments_select on public.shipments for select to authenticated
  using (public.has_role(carrier_company_id, array['owner', 'admin', 'dispatcher']::public.member_role[]));
create policy containers_select on public.shipment_containers for select to authenticated
  using (public.can_view_shipment(shipment_id));
create policy documents_select on public.shipment_documents for select to authenticated
  using (
    (upload_complete or uploaded_by = (select auth.uid())) and (
    public.can_dispatch_shipment(shipment_id)
    or (public.shipment_role(shipment_id) = 'driver' and doc_type not in ('rate_confirmation', 'invoice')))
  );
create policy events_select on public.shipment_events for select to authenticated
  using (public.can_dispatch_shipment(shipment_id));
create policy share_links_select on public.shipment_share_links for select to authenticated
  using (public.can_dispatch_shipment(shipment_id));
-- token_hash is never readable by clients
revoke select on public.shipment_share_links from authenticated;
grant select (id, shipment_id, recipient_label, recipient_email, expires_at, revoked_at, open_count,
  first_opened_at, last_opened_at, created_by, created_at) on public.shipment_share_links to authenticated;

-- ---------------------------------------------------------------------------
-- Validation helpers
-- ---------------------------------------------------------------------------
create or replace function public.require_dispatch(p_company uuid)
returns void language plpgsql stable security definer set search_path = ''
as $$
begin
  if public.company_kind_of(p_company) is distinct from 'carrier'
     or not public.has_role(p_company, array['owner', 'admin', 'dispatcher']::public.member_role[]) then
    raise exception 'Only carrier owners, administrators and dispatchers can do that' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.validate_driver(p_company uuid, p_driver uuid)
returns void language plpgsql stable security definer set search_path = ''
as $$
begin
  if p_driver is not null and not exists (
    select 1 from public.company_memberships
     where company_id = p_company and user_id = p_driver and role = 'driver' and status = 'active'
  ) then
    raise exception 'That driver is not an active driver at your company' using errcode = '22023';
  end if;
end;
$$;

-- Replace a shipment's containers from a JSON array: [{"container_number":"MSDU4820193","size_type":"40' HC","seal_number":"..."}]
create or replace function public.replace_shipment_containers(p_shipment uuid, p_containers jsonb)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if coalesce(jsonb_array_length(p_containers), 0) > 50 then
    raise exception 'A shipment can have up to 50 containers' using errcode = '22023';
  end if;
  delete from public.shipment_containers where shipment_id = p_shipment;
  insert into public.shipment_containers (shipment_id, container_number, size_type, seal_number, weight_lbs, position)
  select p_shipment,
         upper(regexp_replace(c.value ->> 'container_number', '[^A-Za-z0-9]', '', 'g')),
         nullif(btrim(c.value ->> 'size_type'), ''),
         nullif(btrim(c.value ->> 'seal_number'), ''),
         nullif(c.value ->> 'weight_lbs', '')::integer,
         c.ordinality - 1
    from jsonb_array_elements(coalesce(p_containers, '[]')) with ordinality c
   where btrim(coalesce(c.value ->> 'container_number', '')) <> '';
exception when check_violation then
  raise exception 'Container numbers are 4 letters followed by 6 or 7 digits, like MSDU4820193' using errcode = '22023';
when unique_violation then
  raise exception 'The same container number is listed twice' using errcode = '22023';
end;
$$;

-- ---------------------------------------------------------------------------
-- RPCs: dispatch
-- ---------------------------------------------------------------------------
-- p jsonb keys: move_type, customer_name, customer_reference, booking_number, bol_number, pickup_location,
-- delivery_location, empty_return_location, pickup_at, delivery_at, empty_return_at, last_free_day,
-- special_instructions, internal_notes, driver_user_id, truck_ref, chassis_ref, status
create or replace function public.create_shipment(p_company uuid, p jsonb, p_containers jsonb)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
  v_num bigint;
  v_driver uuid := nullif(p ->> 'driver_user_id', '')::uuid;
begin
  perform public.require_dispatch(p_company);
  perform public.validate_driver(p_company, v_driver);

  insert into public.company_counters as cc (company_id, name, value) values (p_company, 'shipment', 1001)
  on conflict (company_id, name) do update set value = cc.value + 1
  returning value into v_num;

  insert into public.shipments (carrier_company_id, shipment_number, status, move_type, customer_name, customer_reference,
    booking_number, bol_number, pickup_location, delivery_location, empty_return_location, pickup_at, delivery_at,
    empty_return_at, last_free_day, special_instructions, internal_notes, driver_user_id, truck_ref, chassis_ref, created_by)
  values (p_company, v_num,
    coalesce(nullif(p ->> 'status', '')::public.shipment_status, case when v_driver is not null then 'dispatched'::public.shipment_status else 'new'::public.shipment_status end),
    coalesce(nullif(p ->> 'move_type', '')::public.move_type, 'import'),
    coalesce(btrim(p ->> 'customer_name'), ''), nullif(btrim(p ->> 'customer_reference'), ''),
    nullif(upper(btrim(p ->> 'booking_number')), ''), nullif(upper(btrim(p ->> 'bol_number')), ''),
    coalesce(btrim(p ->> 'pickup_location'), ''), coalesce(btrim(p ->> 'delivery_location'), ''),
    nullif(btrim(p ->> 'empty_return_location'), ''),
    nullif(p ->> 'pickup_at', '')::timestamptz, nullif(p ->> 'delivery_at', '')::timestamptz,
    nullif(p ->> 'empty_return_at', '')::timestamptz, nullif(p ->> 'last_free_day', '')::date,
    coalesce(btrim(p ->> 'special_instructions'), ''), coalesce(btrim(p ->> 'internal_notes'), ''),
    v_driver, nullif(btrim(p ->> 'truck_ref'), ''), nullif(btrim(p ->> 'chassis_ref'), ''), (select auth.uid()))
  returning id into v_id;

  perform public.replace_shipment_containers(v_id, p_containers);
  perform public.log_shipment_event(v_id, 'created', null, false, 'dispatch');
  return v_id;
end;
$$;

create or replace function public.update_shipment(p_shipment uuid, p jsonb, p_containers jsonb)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_company uuid;
  v_driver uuid := nullif(p ->> 'driver_user_id', '')::uuid;
  v_old_driver uuid;
begin
  if not public.can_dispatch_shipment(p_shipment) then raise exception 'Not allowed' using errcode = '42501'; end if;
  select carrier_company_id, driver_user_id into v_company, v_old_driver from public.shipments where id = p_shipment;
  perform public.validate_driver(v_company, v_driver);

  update public.shipments set
    move_type = coalesce(nullif(p ->> 'move_type', '')::public.move_type, move_type),
    customer_name = coalesce(btrim(p ->> 'customer_name'), ''),
    customer_reference = nullif(btrim(p ->> 'customer_reference'), ''),
    booking_number = nullif(upper(btrim(p ->> 'booking_number')), ''),
    bol_number = nullif(upper(btrim(p ->> 'bol_number')), ''),
    pickup_location = coalesce(btrim(p ->> 'pickup_location'), ''),
    delivery_location = coalesce(btrim(p ->> 'delivery_location'), ''),
    empty_return_location = nullif(btrim(p ->> 'empty_return_location'), ''),
    pickup_at = nullif(p ->> 'pickup_at', '')::timestamptz,
    delivery_at = nullif(p ->> 'delivery_at', '')::timestamptz,
    empty_return_at = nullif(p ->> 'empty_return_at', '')::timestamptz,
    last_free_day = nullif(p ->> 'last_free_day', '')::date,
    special_instructions = coalesce(btrim(p ->> 'special_instructions'), ''),
    internal_notes = coalesce(btrim(p ->> 'internal_notes'), ''),
    driver_user_id = v_driver,
    truck_ref = nullif(btrim(p ->> 'truck_ref'), ''),
    chassis_ref = nullif(btrim(p ->> 'chassis_ref'), '')
  where id = p_shipment;

  if p_containers is not null then perform public.replace_shipment_containers(p_shipment, p_containers); end if;

  if v_driver is distinct from v_old_driver then
    perform public.log_shipment_event(p_shipment, 'assignment',
      case when v_driver is null then 'Driver unassigned'
           else 'Assigned to ' || coalesce((select nullif(full_name, '') from public.profiles where id = v_driver), 'a driver') end,
      false, 'dispatch');
  else
    perform public.log_shipment_event(p_shipment, 'updated', 'Shipment details updated', true, 'dispatch');
  end if;
end;
$$;

-- Status changes. Dispatch can set any status (corrections included). Drivers can only record the
-- road milestones on shipments assigned to them, moving forward.
create or replace function public.set_shipment_status(p_shipment uuid, p_status public.shipment_status, p_note text default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_role text := public.shipment_role(p_shipment);
  v_from public.shipment_status;
  v_order text[] := array['new', 'awaiting_release', 'ready', 'dispatched', 'picked_up', 'delivered', 'empty_returned', 'completed'];
begin
  if v_role is null then raise exception 'Not allowed' using errcode = '42501'; end if;
  select status into v_from from public.shipments where id = p_shipment for update;
  if v_from = p_status then return; end if;
  if v_role = 'driver' then
    if p_status not in ('picked_up', 'delivered', 'empty_returned')
       or array_position(v_order, p_status::text) <= array_position(v_order, v_from::text)
       or v_from in ('completed', 'canceled') then
      raise exception 'Drivers can only mark picked up, delivered or empty returned, in order' using errcode = '42501';
    end if;
  end if;

  update public.shipments set status = p_status,
    completed_at = case when p_status = 'completed' then now() when v_from = 'completed' then null else completed_at end
  where id = p_shipment;
  perform public.log_shipment_event(p_shipment, 'status', nullif(btrim(coalesce(p_note, '')), ''), false,
    case when v_role = 'driver' then 'driver'::public.event_source else 'dispatch'::public.event_source end, v_from, p_status);
end;
$$;

create or replace function public.add_shipment_note(p_shipment uuid, p_body text, p_internal boolean default true)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_role text := public.shipment_role(p_shipment);
begin
  if v_role is null then raise exception 'Not allowed' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_body, ''))) = 0 then raise exception 'Write a note first' using errcode = '22023'; end if;
  perform public.log_shipment_event(p_shipment, 'note', btrim(p_body),
    -- drivers' notes are visible to the customer timeline only if dispatch shares them later; keep internal
    case when v_role = 'driver' then true else coalesce(p_internal, true) end,
    case when v_role = 'driver' then 'driver'::public.event_source else 'dispatch'::public.event_source end);
end;
$$;

create or replace function public.set_shipment_exception(p_shipment uuid, p_open boolean, p_note text default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_role text := public.shipment_role(p_shipment);
begin
  if v_role is null then raise exception 'Not allowed' using errcode = '42501'; end if;
  if not p_open and v_role <> 'dispatch' then raise exception 'Only dispatch can resolve an exception' using errcode = '42501'; end if;
  if p_open and char_length(btrim(coalesce(p_note, ''))) = 0 then raise exception 'Describe the problem' using errcode = '22023'; end if;
  update public.shipments set exception_open = p_open,
    exception_note = case when p_open then btrim(p_note) else exception_note end
  where id = p_shipment;
  perform public.log_shipment_event(p_shipment, case when p_open then 'exception' else 'exception_resolved' end,
    nullif(btrim(coalesce(p_note, '')), ''), false,
    case when v_role = 'driver' then 'driver'::public.event_source else 'dispatch'::public.event_source end);
end;
$$;

-- Dispatch board summary for a carrier.
create or replace function public.shipment_board_counts(p_company uuid)
returns table (new_count bigint, today_count bigint, in_progress_count bigint, awaiting_pod_count bigint,
               exception_count bigint, completed_30d_count bigint)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform public.require_dispatch(p_company);
  return query
  select
    count(*) filter (where s.status in ('new', 'awaiting_release', 'ready')),
    count(*) filter (where s.status not in ('completed', 'canceled')
                     and ((s.pickup_at at time zone 'America/Chicago')::date = (now() at time zone 'America/Chicago')::date
                       or (s.delivery_at at time zone 'America/Chicago')::date = (now() at time zone 'America/Chicago')::date)),
    count(*) filter (where s.status in ('dispatched', 'picked_up')),
    count(*) filter (where s.status in ('delivered', 'empty_returned', 'completed')
                     and not exists (select 1 from public.shipment_documents d
                                      where d.shipment_id = s.id and d.doc_type = 'pod' and d.upload_complete and d.superseded_at is null)),
    count(*) filter (where s.exception_open and s.status not in ('completed', 'canceled')),
    count(*) filter (where s.status = 'completed' and s.completed_at > now() - interval '30 days')
  from public.shipments s where s.carrier_company_id = p_company;
end;
$$;

-- Active drivers at a carrier (for the assignment picker).
create or replace function public.company_drivers(p_company uuid)
returns table (user_id uuid, full_name text, email text)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform public.require_dispatch(p_company);
  return query
    select p.id, p.full_name, p.email from public.company_memberships m join public.profiles p on p.id = m.user_id
     where m.company_id = p_company and m.role = 'driver' and m.status = 'active' order by p.full_name, p.email;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPCs: drivers (safe columns only: no internal notes, no rates)
-- ---------------------------------------------------------------------------
create or replace function public.driver_shipments(p_include_done boolean default false)
returns table (id uuid, shipment_number bigint, carrier_name text, status public.shipment_status, move_type public.move_type,
               pickup_location text, delivery_location text, empty_return_location text,
               pickup_at timestamptz, delivery_at timestamptz, empty_return_at timestamptz,
               containers text[], truck_ref text, exception_open boolean)
language sql stable security definer set search_path = ''
as $$
  select s.id, s.shipment_number, c.name, s.status, s.move_type, s.pickup_location, s.delivery_location,
         s.empty_return_location, s.pickup_at, s.delivery_at, s.empty_return_at,
         array(select sc.container_number from public.shipment_containers sc where sc.shipment_id = s.id order by sc.position),
         s.truck_ref, s.exception_open
    from public.shipments s join public.companies c on c.id = s.carrier_company_id
   where s.driver_user_id = (select auth.uid())
     and public.has_role(s.carrier_company_id, array['driver']::public.member_role[])
     and (p_include_done or s.status not in ('completed', 'canceled'))
   order by coalesce(s.pickup_at, s.delivery_at, s.created_at);
$$;

create or replace function public.driver_shipment(p_shipment uuid)
returns table (id uuid, shipment_number bigint, carrier_name text, status public.shipment_status, move_type public.move_type,
               booking_number text, bol_number text,
               pickup_location text, delivery_location text, empty_return_location text,
               pickup_at timestamptz, delivery_at timestamptz, empty_return_at timestamptz,
               special_instructions text, truck_ref text, chassis_ref text, exception_open boolean, exception_note text)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if public.shipment_role(p_shipment) is null then raise exception 'Not allowed' using errcode = '42501'; end if;
  return query
  select s.id, s.shipment_number, c.name, s.status, s.move_type, s.booking_number, s.bol_number,
         s.pickup_location, s.delivery_location, s.empty_return_location, s.pickup_at, s.delivery_at, s.empty_return_at,
         s.special_instructions, s.truck_ref, s.chassis_ref, s.exception_open, s.exception_note
    from public.shipments s join public.companies c on c.id = s.carrier_company_id where s.id = p_shipment;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPCs: documents (file bytes live in Storage; these rows are the index)
-- ---------------------------------------------------------------------------
-- Step 1: reserve a document row and get the storage path to upload to.
create or replace function public.begin_document_upload(
  p_shipment uuid, p_doc_type public.document_type, p_file_name text, p_mime text, p_size bigint,
  p_replaces uuid default null
) returns table (document_id uuid, storage_path text)
language plpgsql security definer set search_path = ''
as $$
declare
  v_role text := public.shipment_role(p_shipment);
  v_id uuid := gen_random_uuid();
  v_ext text := lower(coalesce(substring(p_file_name from '\.([A-Za-z0-9]{1,8})$'), 'bin'));
  v_path text;
begin
  if v_role is null then raise exception 'Not allowed' using errcode = '42501'; end if;
  if v_role = 'driver' and p_doc_type in ('rate_confirmation', 'invoice', 'delivery_order', 'bol') then
    raise exception 'Drivers can upload gate receipts, EIRs, PODs, photos and other paperwork' using errcode = '42501';
  end if;
  if p_mime not in ('application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp') then
    raise exception 'Upload a PDF or a photo (JPG, PNG, HEIC)' using errcode = '22023';
  end if;
  if p_size > 26214400 then raise exception 'Files can be up to 25 MB' using errcode = '22023'; end if;
  if p_replaces is not null and not exists (select 1 from public.shipment_documents where id = p_replaces and shipment_id = p_shipment) then
    raise exception 'Document to replace not found' using errcode = 'P0002';
  end if;
  v_path := p_shipment::text || '/' || v_id::text || '.' || v_ext;
  -- The row is created only after the file is confirmed (finish_document_upload). Remember the plan in a pending row.
  insert into public.shipment_documents (id, shipment_id, doc_type, storage_path, file_name, mime_type, size_bytes,
    shared_with_customer, uploaded_by, uploaded_via, replaces_document_id, superseded_at)
  values (v_id, p_shipment, p_doc_type, v_path, left(btrim(p_file_name), 200), p_mime, greatest(p_size, 1),
    p_doc_type not in ('rate_confirmation', 'invoice'), (select auth.uid()),
    case when v_role = 'driver' then 'driver'::public.event_source else 'dispatch'::public.event_source end,
    p_replaces, null);
  return query select v_id, v_path;
end;
$$;

-- Step 2: after the file is in Storage, make the document live (and supersede the one it replaces).
create or replace function public.finish_document_upload(p_document uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare d public.shipment_documents;
begin
  select * into d from public.shipment_documents where id = p_document for update;
  if d.id is null or d.uploaded_by is distinct from (select auth.uid()) or public.shipment_role(d.shipment_id) is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'shipment-documents' and o.name = d.storage_path) then
    raise exception 'The file did not finish uploading. Try again.' using errcode = 'P0002';
  end if;
  if d.upload_complete then return; end if;
  update public.shipment_documents set upload_complete = true where id = d.id;
  if d.replaces_document_id is not null then
    update public.shipment_documents set superseded_at = now() where id = d.replaces_document_id;
  end if;
  perform public.log_shipment_event(d.shipment_id, 'document',
    (case d.doc_type
      when 'pod' then 'POD' when 'delivery_order' then 'Delivery order' when 'bol' then 'Bill of lading'
      when 'gate_receipt' then 'Gate receipt' when 'eir' then 'EIR' when 'damage_photo' then 'Damage photo'
      when 'rate_confirmation' then 'Rate confirmation' when 'invoice' then 'Invoice' else 'Document' end)
      || case when d.replaces_document_id is not null then ' replaced' else ' uploaded' end,
    d.doc_type in ('rate_confirmation', 'invoice'), d.uploaded_via, null, null,
    jsonb_build_object('document_id', d.id, 'doc_type', d.doc_type, 'file_name', d.file_name));
end;
$$;

create or replace function public.set_document_shared(p_document uuid, p_shared boolean)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_shipment uuid; v_type public.document_type;
begin
  select shipment_id, doc_type into v_shipment, v_type from public.shipment_documents where id = p_document;
  if v_shipment is null or not public.can_dispatch_shipment(v_shipment) then raise exception 'Not allowed' using errcode = '42501'; end if;
  if p_shared and v_type in ('rate_confirmation', 'invoice') then
    raise exception 'Rates and invoices are never shared with customers' using errcode = '22023';
  end if;
  update public.shipment_documents set shared_with_customer = p_shared where id = p_document;
end;
$$;

-- Returns the storage path if the caller may download this document (used to sign a URL).
create or replace function public.document_path_for_download(p_document uuid)
returns text language plpgsql stable security definer set search_path = ''
as $$
declare d public.shipment_documents; v_role text;
begin
  select * into d from public.shipment_documents where id = p_document and upload_complete;
  if d.id is null then return null; end if;
  v_role := public.shipment_role(d.shipment_id);
  if v_role = 'dispatch' or (v_role = 'driver' and d.doc_type not in ('rate_confirmation', 'invoice')) then
    return d.storage_path;
  end if;
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPCs: customer share links
-- ---------------------------------------------------------------------------
create or replace function public.create_share_link(p_shipment uuid, p_label text, p_email text, p_days int default 30)
returns table (link_id uuid, token text, expires_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
  v_id uuid;
  v_exp timestamptz := now() + make_interval(days => least(greatest(coalesce(p_days, 30), 1), 365));
begin
  if not public.can_dispatch_shipment(p_shipment) then raise exception 'Not allowed' using errcode = '42501'; end if;
  if (select count(*) from public.shipment_share_links where shipment_id = p_shipment and revoked_at is null) >= 20 then
    raise exception 'This shipment already has 20 active links. Turn one off first.' using errcode = '54000';
  end if;
  insert into public.shipment_share_links (shipment_id, token_hash, recipient_label, recipient_email, expires_at, created_by)
  values (p_shipment, public.hash_token(v_token), btrim(p_label), nullif(lower(btrim(coalesce(p_email, ''))), ''), v_exp, (select auth.uid()))
  returning id into v_id;
  perform public.log_shipment_event(p_shipment, 'shared', 'Shared with ' || btrim(p_label), false, 'dispatch', null, null,
    jsonb_build_object('link_id', v_id));
  return query select v_id, v_token, v_exp;
end;
$$;

create or replace function public.revoke_share_link(p_link uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_shipment uuid; v_label text;
begin
  select shipment_id, recipient_label into v_shipment, v_label from public.shipment_share_links where id = p_link;
  if v_shipment is null or not public.can_dispatch_shipment(v_shipment) then raise exception 'Not allowed' using errcode = '42501'; end if;
  update public.shipment_share_links set revoked_at = now() where id = p_link and revoked_at is null;
  perform public.log_shipment_event(v_shipment, 'link_revoked', 'Turned off the link for ' || v_label, false, 'dispatch');
end;
$$;

-- Public: what a customer sees through a share link. Records the visit.
create or replace function public.get_shared_shipment(p_token text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  l public.shipment_share_links;
  s public.shipments;
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

  -- Record the visit; log an event at most once per 30 minutes per link.
  if l.last_opened_at is null or l.last_opened_at < now() - interval '30 minutes' then
    insert into public.shipment_events (shipment_id, kind, body, source, metadata)
    values (s.id, 'link_opened', l.recipient_label || ' opened the shared link', 'share_link', jsonb_build_object('link_id', l.id));
  end if;
  update public.shipment_share_links set open_count = open_count + 1, last_opened_at = now(),
    first_opened_at = coalesce(first_opened_at, now()) where id = l.id;

  select jsonb_build_object(
    'state', 'ok',
    'recipient', l.recipient_label,
    'expires_at', l.expires_at,
    'carrier', (select jsonb_build_object('name', c.name,
                  'phone', p.dispatch_phone, 'email', p.dispatch_email)
                  from public.companies c left join public.carrier_profiles p on p.company_id = c.id
                 where c.id = s.carrier_company_id),
    'shipment', jsonb_build_object(
      'number', s.shipment_number, 'status', s.status, 'move_type', s.move_type,
      'customer_reference', s.customer_reference, 'booking_number', s.booking_number, 'bol_number', s.bol_number,
      'pickup_location', s.pickup_location, 'delivery_location', s.delivery_location,
      'empty_return_location', s.empty_return_location,
      'pickup_at', s.pickup_at, 'delivery_at', s.delivery_at, 'empty_return_at', s.empty_return_at,
      'exception_open', s.exception_open, 'exception_note', case when s.exception_open then s.exception_note end,
      'updated_at', s.last_activity_at),
    'containers', coalesce((select jsonb_agg(jsonb_build_object('number', c.container_number, 'size_type', c.size_type, 'seal', c.seal_number) order by c.position)
                    from public.shipment_containers c where c.shipment_id = s.id), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(jsonb_build_object('kind', e.kind, 'to_status', e.to_status, 'body',
                        case when e.kind in ('status', 'exception', 'exception_resolved') then e.body end,
                        'source', e.source, 'at', e.occurred_at) order by e.occurred_at desc)
                    from public.shipment_events e
                   where e.shipment_id = s.id and not e.internal and e.kind in ('created', 'status', 'exception', 'exception_resolved')), '[]'::jsonb),
    'documents', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'type', d.doc_type, 'name', d.file_name,
                        'mime', d.mime_type, 'size', d.size_bytes, 'at', d.created_at) order by d.created_at desc)
                    from public.shipment_documents d
                   where d.shipment_id = s.id and d.shared_with_customer and d.upload_complete and d.superseded_at is null), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

-- Server-only (service role): resolve a shared document for download and record it.
create or replace function public.resolve_shared_document(p_token text, p_document uuid)
returns text language plpgsql security definer set search_path = ''
as $$
declare l public.shipment_share_links; d public.shipment_documents;
begin
  if p_token !~ '^[a-f0-9]{64}$' then return null; end if;
  select * into l from public.shipment_share_links where token_hash = public.hash_token(p_token);
  if l.id is null or l.revoked_at is not null or l.expires_at < now() then return null; end if;
  select * into d from public.shipment_documents
   where id = p_document and shipment_id = l.shipment_id and shared_with_customer and upload_complete and superseded_at is null;
  if d.id is null then return null; end if;
  insert into public.shipment_events (shipment_id, kind, body, source, metadata)
  values (l.shipment_id, 'document_downloaded',
    l.recipient_label || ' downloaded ' || case d.doc_type when 'pod' then 'the POD' else d.file_name end,
    'share_link', jsonb_build_object('link_id', l.id, 'document_id', d.id, 'doc_type', d.doc_type));
  return d.storage_path;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function
  public.is_platform_admin(), public.is_member(uuid), public.has_role(uuid, public.member_role[]),
  public.shares_company_with(uuid), public.my_companies(),
  public.create_company(text, public.company_kind, text), public.update_company(uuid, text, text),
  public.create_invitation(uuid, text, public.member_role), public.revoke_invitation(uuid),
  public.accept_invitation(text), public.set_member_role(uuid, public.member_role),
  public.set_member_status(uuid, public.membership_status),
  public.admin_list_companies(), public.admin_set_company_status(uuid, public.company_status),
  public.is_forwarder_user(), public.is_listed_carrier(uuid), public.can_view_carrier(uuid),
  public.save_carrier_profile(uuid, text, text, text, text, text, text, text, text, text, date, boolean),
  public.save_carrier_coverage(uuid, smallint[], jsonb, jsonb, jsonb),
  public.search_carriers(uuid, text, smallint, text, text, text, text[], boolean, int, int),
  public.get_carrier_for_forwarder(uuid, uuid),
  public.set_carrier_relationship(uuid, uuid, public.relationship_status, text),
  public.set_carrier_note(uuid, uuid, text),
  public.my_customers(uuid),
  public.admin_list_carriers(), public.admin_set_qualification(uuid, public.qualification_status, text),
  public.admin_set_inquiry_status(uuid, text),
  -- M3
  public.shipment_role(uuid), public.can_dispatch_shipment(uuid), public.can_view_shipment(uuid),
  public.create_shipment(uuid, jsonb, jsonb), public.update_shipment(uuid, jsonb, jsonb),
  public.set_shipment_status(uuid, public.shipment_status, text), public.add_shipment_note(uuid, text, boolean),
  public.set_shipment_exception(uuid, boolean, text), public.shipment_board_counts(uuid), public.company_drivers(uuid),
  public.driver_shipments(boolean), public.driver_shipment(uuid),
  public.begin_document_upload(uuid, public.document_type, text, text, bigint, uuid),
  public.finish_document_upload(uuid), public.set_document_shared(uuid, boolean),
  public.document_path_for_download(uuid),
  public.create_share_link(uuid, text, text, int), public.revoke_share_link(uuid)
to authenticated;

grant execute on function public.get_invitation(text) to anon, authenticated;
grant execute on function public.submit_sales_inquiry(text, text, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.get_shared_shipment(text) to anon, authenticated;
-- resolve_shared_document is for the service role only (download edge function).
grant execute on function public.resolve_shared_document(text, uuid) to service_role;
