-- Milestone 2: carrier profiles, carrier directory, per-forwarder approvals, sales inquiries.

create type public.qualification_status as enum ('unverified', 'in_review', 'verified');
create type public.capability_category as enum ('container', 'equipment', 'service');
create type public.relationship_status as enum ('pending', 'approved', 'suspended');

-- ---------------------------------------------------------------------------
-- Reference data: ports
-- ---------------------------------------------------------------------------
create table public.ports (
  id smallint generated always as identity primary key,
  code text not null unique,
  name text not null,
  city text not null,
  state text not null
);

insert into public.ports (code, name, city, state) values
  ('USLAX', 'Port of Los Angeles', 'Los Angeles', 'CA'),
  ('USLGB', 'Port of Long Beach', 'Long Beach', 'CA'),
  ('USOAK', 'Port of Oakland', 'Oakland', 'CA'),
  ('USSEA', 'Port of Seattle', 'Seattle', 'WA'),
  ('USTIW', 'Port of Tacoma', 'Tacoma', 'WA'),
  ('USHOU', 'Port Houston', 'Houston', 'TX'),
  ('USNYC', 'Port of New York and New Jersey', 'Newark', 'NJ'),
  ('USSAV', 'Port of Savannah', 'Savannah', 'GA'),
  ('USCHS', 'Port of Charleston', 'Charleston', 'SC'),
  ('USORF', 'Port of Virginia', 'Norfolk', 'VA'),
  ('USBAL', 'Port of Baltimore', 'Baltimore', 'MD'),
  ('USMIA', 'PortMiami', 'Miami', 'FL'),
  ('USJAX', 'JAXPORT', 'Jacksonville', 'FL'),
  ('USPEF', 'Port Everglades', 'Fort Lauderdale', 'FL'),
  ('USMOB', 'Port of Mobile', 'Mobile', 'AL'),
  ('USMSY', 'Port of New Orleans', 'New Orleans', 'LA'),
  ('USBOS', 'Port of Boston', 'Boston', 'MA'),
  ('USPHL', 'Port of Philadelphia', 'Philadelphia', 'PA'),
  ('USWIL', 'Port of Wilmington', 'Wilmington', 'NC'),
  ('USCHI', 'Chicago rail ramps', 'Chicago', 'IL'),
  ('USDAL', 'Dallas–Fort Worth rail ramps', 'Dallas', 'TX'),
  ('USMEM', 'Memphis rail ramps', 'Memphis', 'TN'),
  ('USKCK', 'Kansas City rail ramps', 'Kansas City', 'MO');

-- ---------------------------------------------------------------------------
-- Carrier profile (one per carrier company)
-- ---------------------------------------------------------------------------
create table public.carrier_profiles (
  company_id uuid primary key references public.companies (id) on delete cascade,
  description text not null default '' check (char_length(description) <= 2000),
  website text check (website is null or char_length(website) <= 300),
  operating_hours text not null default '' check (char_length(operating_hours) <= 200),
  scac text check (scac is null or scac ~ '^[A-Z]{2,4}$'),
  usdot_number text check (usdot_number is null or usdot_number ~ '^[0-9]{1,10}$'),
  mc_number text check (mc_number is null or mc_number ~ '^[0-9]{1,10}$'),
  -- Private: visible to the carrier and to forwarders that approved it
  dispatch_email text check (dispatch_email is null or dispatch_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  dispatch_phone text check (dispatch_phone is null or char_length(dispatch_phone) <= 40),
  insurance_provider text check (insurance_provider is null or char_length(insurance_provider) <= 200),
  insurance_expires_on date,
  -- Directory listing is opt-in
  listed boolean not null default false,
  qualification_status public.qualification_status not null default 'unverified',
  qualification_note text check (qualification_note is null or char_length(qualification_note) <= 500),
  updated_at timestamptz not null default now()
);

create trigger carrier_profiles_touch before update on public.carrier_profiles
  for each row execute function public.touch_updated_at();

create table public.carrier_ports (
  company_id uuid not null references public.companies (id) on delete cascade,
  port_id smallint not null references public.ports (id),
  primary key (company_id, port_id)
);
create index carrier_ports_port_idx on public.carrier_ports (port_id);

create table public.carrier_terminals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  port_id smallint not null references public.ports (id),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  unique (company_id, port_id, name)
);
create index carrier_terminals_company_idx on public.carrier_terminals (company_id);

create table public.carrier_service_areas (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  city text not null check (char_length(btrim(city)) between 2 and 80),
  state text not null check (state ~ '^[A-Z]{2}$'),
  unique (company_id, city, state)
);
create index carrier_service_areas_state_idx on public.carrier_service_areas (state);

create table public.carrier_capabilities (
  company_id uuid not null references public.companies (id) on delete cascade,
  category public.capability_category not null,
  value text not null check (char_length(value) between 2 and 60),
  primary key (company_id, category, value)
);
create index carrier_capabilities_value_idx on public.carrier_capabilities (category, value);

-- ---------------------------------------------------------------------------
-- Forwarder ↔ carrier relationships (approval lists are per forwarder)
-- ---------------------------------------------------------------------------
create table public.forwarder_carrier_relationships (
  id uuid primary key default gen_random_uuid(),
  forwarder_company_id uuid not null references public.companies (id) on delete cascade,
  carrier_company_id uuid not null references public.companies (id) on delete cascade,
  status public.relationship_status not null,
  internal_note text check (internal_note is null or char_length(internal_note) <= 1000),
  requested_by uuid references auth.users (id) on delete set null,
  approved_by uuid references auth.users (id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (forwarder_company_id, carrier_company_id)
);
create index fcr_carrier_idx on public.forwarder_carrier_relationships (carrier_company_id, status);
create trigger fcr_touch before update on public.forwarder_carrier_relationships
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Sales inquiries ("talk to a specialist")
-- ---------------------------------------------------------------------------
create table public.sales_inquiries (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(btrim(full_name)) between 2 and 120),
  email text not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 254),
  company_name text not null check (char_length(btrim(company_name)) between 2 and 160),
  company_type text not null check (company_type in ('forwarder', 'carrier', 'other')),
  phone text check (phone is null or char_length(phone) <= 40),
  monthly_moves text check (monthly_moves is null or char_length(monthly_moves) <= 40),
  plan_interest text check (plan_interest is null or char_length(plan_interest) <= 60),
  message text not null default '' check (char_length(message) <= 4000),
  status text not null default 'new' check (status in ('new', 'contacted', 'closed')),
  created_at timestamptz not null default now()
);
create index sales_inquiries_created_idx on public.sales_inquiries (created_at desc);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.company_kind_of(p_company uuid)
returns public.company_kind language sql stable security definer set search_path = ''
as $$ select kind from public.companies where id = p_company; $$;

-- True if the caller is an active member of any active forwarder company.
create or replace function public.is_forwarder_user()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.company_memberships m join public.companies c on c.id = m.company_id
     where m.user_id = (select auth.uid()) and m.status = 'active'
       and c.status = 'active' and c.kind = 'forwarder'
  );
$$;

-- A carrier is visible in the directory if it is active, listed, and has a profile.
create or replace function public.is_listed_carrier(p_company uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.carrier_profiles p join public.companies c on c.id = p.company_id
     where p.company_id = p_company and p.listed and c.status = 'active' and c.kind = 'carrier'
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.ports enable row level security;
alter table public.carrier_profiles enable row level security;
alter table public.carrier_ports enable row level security;
alter table public.carrier_terminals enable row level security;
alter table public.carrier_service_areas enable row level security;
alter table public.carrier_capabilities enable row level security;
alter table public.forwarder_carrier_relationships enable row level security;
alter table public.sales_inquiries enable row level security;

revoke all on public.ports, public.carrier_profiles, public.carrier_ports, public.carrier_terminals,
  public.carrier_service_areas, public.carrier_capabilities, public.forwarder_carrier_relationships,
  public.sales_inquiries from anon, authenticated;

grant select on public.ports to authenticated;
grant select on public.carrier_ports, public.carrier_terminals, public.carrier_service_areas,
  public.carrier_capabilities, public.forwarder_carrier_relationships to authenticated;
-- carrier_profiles has private columns: carriers read it directly; forwarders use RPCs.
grant select on public.carrier_profiles to authenticated;
grant select on public.sales_inquiries to authenticated;

create policy ports_select on public.ports for select to authenticated using (true);

create policy carrier_profiles_select on public.carrier_profiles for select to authenticated
  using (public.is_member(company_id) or public.is_platform_admin());

-- Public parts of a carrier profile: the carrier itself, forwarders (listed carriers or
-- carriers they already have a relationship with), platform admins.
create or replace function public.can_view_carrier(p_company uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.is_member(p_company)
      or public.is_platform_admin()
      or (public.is_forwarder_user() and public.is_listed_carrier(p_company))
      or exists (
        select 1 from public.forwarder_carrier_relationships r
         where r.carrier_company_id = p_company and public.is_member(r.forwarder_company_id)
      );
$$;

create policy carrier_ports_select on public.carrier_ports for select to authenticated
  using (public.can_view_carrier(company_id));
create policy carrier_terminals_select on public.carrier_terminals for select to authenticated
  using (public.can_view_carrier(company_id));
create policy carrier_areas_select on public.carrier_service_areas for select to authenticated
  using (public.can_view_carrier(company_id));
create policy carrier_caps_select on public.carrier_capabilities for select to authenticated
  using (public.can_view_carrier(company_id));

-- Relationships: the forwarder sees all its rows (incl. internal note via RPC only, see below);
-- the carrier sees only approved relationships, and never the note (column privilege).
revoke select on public.forwarder_carrier_relationships from authenticated;
grant select (id, forwarder_company_id, carrier_company_id, status, approved_at, created_at, updated_at)
  on public.forwarder_carrier_relationships to authenticated;
create policy fcr_select on public.forwarder_carrier_relationships for select to authenticated
  using (
    public.is_member(forwarder_company_id)
    or (public.is_member(carrier_company_id) and status = 'approved')
  );

create policy sales_inquiries_select on public.sales_inquiries for select to authenticated
  using (public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- RPCs: carrier side
-- ---------------------------------------------------------------------------
create or replace function public.require_carrier_manager(p_company uuid)
returns void language plpgsql stable security definer set search_path = ''
as $$
begin
  if public.company_kind_of(p_company) is distinct from 'carrier'
     or not public.has_role(p_company, array['owner', 'admin']::public.member_role[]) then
    raise exception 'Only carrier owners and administrators can change the carrier profile' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.save_carrier_profile(
  p_company uuid, p_description text, p_website text, p_operating_hours text,
  p_scac text, p_usdot text, p_mc text, p_dispatch_email text, p_dispatch_phone text,
  p_insurance_provider text, p_insurance_expires_on date, p_listed boolean
) returns void language plpgsql security definer set search_path = ''
as $$
begin
  perform public.require_carrier_manager(p_company);
  insert into public.carrier_profiles as cp (company_id, description, website, operating_hours, scac,
    usdot_number, mc_number, dispatch_email, dispatch_phone, insurance_provider, insurance_expires_on, listed)
  values (p_company, coalesce(btrim(p_description), ''), nullif(btrim(p_website), ''),
    coalesce(btrim(p_operating_hours), ''), nullif(upper(btrim(p_scac)), ''), nullif(btrim(p_usdot), ''),
    nullif(btrim(p_mc), ''), nullif(lower(btrim(p_dispatch_email)), ''), nullif(btrim(p_dispatch_phone), ''),
    nullif(btrim(p_insurance_provider), ''), p_insurance_expires_on, coalesce(p_listed, false))
  on conflict (company_id) do update set
    description = excluded.description, website = excluded.website,
    operating_hours = excluded.operating_hours, scac = excluded.scac,
    usdot_number = excluded.usdot_number, mc_number = excluded.mc_number,
    dispatch_email = excluded.dispatch_email, dispatch_phone = excluded.dispatch_phone,
    insurance_provider = excluded.insurance_provider,
    -- Changing insurance or identifiers sends a verified carrier back to review.
    qualification_status = case
      when cp.qualification_status = 'verified' and (
        cp.insurance_expires_on is distinct from excluded.insurance_expires_on
        or cp.usdot_number is distinct from excluded.usdot_number
        or cp.mc_number is distinct from excluded.mc_number)
      then 'in_review'::public.qualification_status
      else cp.qualification_status end,
    insurance_expires_on = excluded.insurance_expires_on,
    listed = excluded.listed;
  perform public.write_audit(p_company, 'carrier_profile.updated', 'company', p_company::text,
    jsonb_build_object('listed', coalesce(p_listed, false)));
end;
$$;

-- Replace the carrier's ports, terminals, service areas and capabilities in one call.
-- p_terminals: [{"port_id":1,"name":"Pier 400"}], p_areas: [{"city":"Ontario","state":"CA"}],
-- p_capabilities: [{"category":"container","value":"40' high cube"}]
create or replace function public.save_carrier_coverage(
  p_company uuid, p_port_ids smallint[], p_terminals jsonb, p_areas jsonb, p_capabilities jsonb
) returns void language plpgsql security definer set search_path = ''
as $$
begin
  perform public.require_carrier_manager(p_company);
  if coalesce(array_length(p_port_ids, 1), 0) > 40
     or coalesce(jsonb_array_length(p_terminals), 0) > 100
     or coalesce(jsonb_array_length(p_areas), 0) > 100
     or coalesce(jsonb_array_length(p_capabilities), 0) > 60 then
    raise exception 'Too many entries' using errcode = '22023';
  end if;

  delete from public.carrier_ports where company_id = p_company;
  insert into public.carrier_ports (company_id, port_id)
    select distinct p_company, unnest(coalesce(p_port_ids, '{}'));

  delete from public.carrier_terminals where company_id = p_company;
  insert into public.carrier_terminals (company_id, port_id, name)
    select distinct p_company, (t ->> 'port_id')::smallint, btrim(t ->> 'name')
      from jsonb_array_elements(coalesce(p_terminals, '[]')) t
     where btrim(coalesce(t ->> 'name', '')) <> '';

  delete from public.carrier_service_areas where company_id = p_company;
  insert into public.carrier_service_areas (company_id, city, state)
    select distinct p_company, btrim(a ->> 'city'), upper(btrim(a ->> 'state'))
      from jsonb_array_elements(coalesce(p_areas, '[]')) a
     where btrim(coalesce(a ->> 'city', '')) <> '';

  delete from public.carrier_capabilities where company_id = p_company;
  insert into public.carrier_capabilities (company_id, category, value)
    select distinct p_company, (c ->> 'category')::public.capability_category, btrim(c ->> 'value')
      from jsonb_array_elements(coalesce(p_capabilities, '[]')) c;

  perform public.write_audit(p_company, 'carrier_coverage.updated', 'company', p_company::text,
    jsonb_build_object('ports', coalesce(array_length(p_port_ids, 1), 0)));
end;
$$;

-- ---------------------------------------------------------------------------
-- RPCs: forwarder side
-- ---------------------------------------------------------------------------
create or replace function public.require_forwarder_member(p_forwarder uuid)
returns void language plpgsql stable security definer set search_path = ''
as $$
begin
  if public.company_kind_of(p_forwarder) is distinct from 'forwarder'
     or not public.is_member(p_forwarder) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
end;
$$;

-- Directory search. Returns public profile fields for listed carriers, plus this forwarder's
-- relationship status. Contact details are returned only when this forwarder approved the carrier.
create or replace function public.search_carriers(
  p_forwarder uuid,
  p_query text default null,
  p_port_id smallint default null,
  p_terminal text default null,
  p_state text default null,
  p_city text default null,
  p_capabilities text[] default null,
  p_approved_only boolean default false,
  p_limit int default 50,
  p_offset int default 0
) returns table (
  company_id uuid, name text, description text, operating_hours text,
  qualification_status public.qualification_status, updated_at timestamptz,
  ports text[], terminals text[], areas text[], capabilities text[],
  relationship_status public.relationship_status,
  dispatch_email text, dispatch_phone text, insurance_expires_on date,
  total_count bigint
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform public.require_forwarder_member(p_forwarder);
  return query
  with base as (
    select c.id, c.name, p.description, p.operating_hours, p.qualification_status, p.updated_at,
           r.status as rel_status, p.dispatch_email, p.dispatch_phone, p.insurance_expires_on
      from public.companies c
      join public.carrier_profiles p on p.company_id = c.id
      left join public.forwarder_carrier_relationships r
        on r.carrier_company_id = c.id and r.forwarder_company_id = p_forwarder
     where c.kind = 'carrier' and c.status = 'active'
       and (p.listed or r.id is not null)
       and (not p_approved_only or r.status = 'approved')
       and (p_query is null or btrim(p_query) = ''
            or c.name ilike '%' || btrim(p_query) || '%'
            or p.description ilike '%' || btrim(p_query) || '%')
       and (p_port_id is null or exists (select 1 from public.carrier_ports cp
             where cp.company_id = c.id and cp.port_id = p_port_id))
       and (p_terminal is null or btrim(p_terminal) = '' or exists (select 1 from public.carrier_terminals t
             where t.company_id = c.id and t.name ilike '%' || btrim(p_terminal) || '%'))
       and (p_state is null or btrim(p_state) = '' or exists (select 1 from public.carrier_service_areas a
             where a.company_id = c.id and a.state = upper(btrim(p_state))
               and (p_city is null or btrim(p_city) = '' or a.city ilike btrim(p_city) || '%')))
       and (p_capabilities is null or cardinality(p_capabilities) = 0 or not exists (
             select 1 from unnest(p_capabilities) want
              where not exists (select 1 from public.carrier_capabilities cc
                                 where cc.company_id = c.id and cc.value = want)))
  )
  select b.id, b.name, b.description, b.operating_hours, b.qualification_status, b.updated_at,
    array(select po.code || ' · ' || po.name from public.carrier_ports cp join public.ports po on po.id = cp.port_id
           where cp.company_id = b.id order by po.name),
    array(select t.name from public.carrier_terminals t where t.company_id = b.id order by t.name),
    array(select a.city || ', ' || a.state from public.carrier_service_areas a where a.company_id = b.id order by a.state, a.city),
    array(select cc.value from public.carrier_capabilities cc where cc.company_id = b.id order by cc.category, cc.value),
    b.rel_status,
    case when b.rel_status = 'approved' then b.dispatch_email end,
    case when b.rel_status = 'approved' then b.dispatch_phone end,
    case when b.rel_status = 'approved' then b.insurance_expires_on end,
    count(*) over ()
  from base b
  order by (b.rel_status = 'approved') desc nulls last, (b.qualification_status = 'verified') desc, b.name
  limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0);
end;
$$;

-- Full carrier detail for a forwarder (same visibility rules as search).
create or replace function public.get_carrier_for_forwarder(p_forwarder uuid, p_carrier uuid)
returns table (
  company_id uuid, name text, legal_name text, description text, website text, operating_hours text,
  scac text, usdot_number text, mc_number text,
  qualification_status public.qualification_status, updated_at timestamptz,
  relationship_id uuid, relationship_status public.relationship_status, internal_note text,
  approved_at timestamptz, dispatch_email text, dispatch_phone text,
  insurance_provider text, insurance_expires_on date
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform public.require_forwarder_member(p_forwarder);
  return query
  select c.id, c.name, c.legal_name, p.description, p.website, p.operating_hours,
         p.scac, p.usdot_number, p.mc_number, p.qualification_status, p.updated_at,
         r.id, r.status, r.internal_note, r.approved_at,
         case when r.status = 'approved' then p.dispatch_email end,
         case when r.status = 'approved' then p.dispatch_phone end,
         case when r.status = 'approved' then p.insurance_provider end,
         case when r.status = 'approved' then p.insurance_expires_on end
    from public.companies c
    join public.carrier_profiles p on p.company_id = c.id
    left join public.forwarder_carrier_relationships r
      on r.carrier_company_id = c.id and r.forwarder_company_id = p_forwarder
   where c.id = p_carrier and c.kind = 'carrier' and c.status = 'active'
     and (p.listed or r.id is not null);
end;
$$;

-- Forwarder sets its own relationship with a carrier.
--  * any forwarder member may add a carrier as 'pending' (a suggestion for review)
--  * only owners/admins may approve or suspend
--  * p_status null removes the carrier from the list
create or replace function public.set_carrier_relationship(
  p_forwarder uuid, p_carrier uuid, p_status public.relationship_status, p_note text default null
) returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_manager boolean;
  v_existing public.forwarder_carrier_relationships;
begin
  perform public.require_forwarder_member(p_forwarder);
  v_manager := public.has_role(p_forwarder, array['owner', 'admin']::public.member_role[]);
  if public.company_kind_of(p_carrier) is distinct from 'carrier' then
    raise exception 'Carrier not found' using errcode = 'P0002';
  end if;

  select * into v_existing from public.forwarder_carrier_relationships
   where forwarder_company_id = p_forwarder and carrier_company_id = p_carrier for update;

  if v_existing.id is null and not public.is_listed_carrier(p_carrier) then
    raise exception 'Carrier not found' using errcode = 'P0002';
  end if;
  if (p_status is distinct from 'pending' or (v_existing.id is not null and v_existing.status <> 'pending'))
     and not v_manager then
    raise exception 'Only owners and administrators can approve, suspend or remove carriers' using errcode = '42501';
  end if;

  if p_status is null then
    delete from public.forwarder_carrier_relationships where id = v_existing.id;
    perform public.write_audit(p_forwarder, 'carrier.removed', 'company', p_carrier::text);
    return;
  end if;

  insert into public.forwarder_carrier_relationships as r
    (forwarder_company_id, carrier_company_id, status, internal_note, requested_by, approved_by, approved_at)
  values (p_forwarder, p_carrier, p_status, nullif(btrim(coalesce(p_note, '')), ''), v_uid,
          case when p_status = 'approved' then v_uid end,
          case when p_status = 'approved' then now() end)
  on conflict (forwarder_company_id, carrier_company_id) do update set
    status = excluded.status,
    internal_note = coalesce(excluded.internal_note, r.internal_note),
    approved_by = case when excluded.status = 'approved' and r.status <> 'approved' then v_uid else r.approved_by end,
    approved_at = case when excluded.status = 'approved' and r.status <> 'approved' then now() else r.approved_at end;

  perform public.write_audit(p_forwarder, 'carrier.' || p_status::text, 'company', p_carrier::text,
    jsonb_build_object('carrier', (select name from public.companies where id = p_carrier)));
end;
$$;

create or replace function public.set_carrier_note(p_forwarder uuid, p_carrier uuid, p_note text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.has_role(p_forwarder, array['owner', 'admin']::public.member_role[]) then
    raise exception 'Only owners and administrators can edit carrier notes' using errcode = '42501';
  end if;
  update public.forwarder_carrier_relationships
     set internal_note = nullif(btrim(coalesce(p_note, '')), '')
   where forwarder_company_id = p_forwarder and carrier_company_id = p_carrier;
  if not found then raise exception 'Add the carrier to your list first' using errcode = 'P0002'; end if;
end;
$$;

-- Carrier side: forwarders that approved this carrier (names only).
create or replace function public.my_customers(p_carrier uuid)
returns table (forwarder_company_id uuid, name text, approved_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_member(p_carrier) then raise exception 'Not allowed' using errcode = '42501'; end if;
  return query
    select c.id, c.name, r.approved_at
      from public.forwarder_carrier_relationships r
      join public.companies c on c.id = r.forwarder_company_id
     where r.carrier_company_id = p_carrier and r.status = 'approved' and c.status = 'active'
     order by c.name;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPCs: platform admin
-- ---------------------------------------------------------------------------
create or replace function public.admin_list_carriers()
returns table (company_id uuid, name text, listed boolean, qualification_status public.qualification_status,
               usdot_number text, mc_number text, insurance_expires_on date, updated_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_platform_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  return query
    select c.id, c.name, coalesce(p.listed, false), coalesce(p.qualification_status, 'unverified'),
           p.usdot_number, p.mc_number, p.insurance_expires_on, coalesce(p.updated_at, c.created_at)
      from public.companies c left join public.carrier_profiles p on p.company_id = c.id
     where c.kind = 'carrier'
     order by c.name;
end;
$$;

create or replace function public.admin_set_qualification(p_carrier uuid, p_status public.qualification_status, p_note text default null)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_platform_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  insert into public.carrier_profiles (company_id, qualification_status, qualification_note)
  values (p_carrier, p_status, nullif(btrim(coalesce(p_note, '')), ''))
  on conflict (company_id) do update set qualification_status = excluded.qualification_status,
    qualification_note = coalesce(excluded.qualification_note, public.carrier_profiles.qualification_note);
  perform public.write_audit(p_carrier, 'carrier.qualification_' || p_status::text, 'company', p_carrier::text);
end;
$$;

create or replace function public.admin_set_inquiry_status(p_inquiry uuid, p_status text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_platform_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  update public.sales_inquiries set status = p_status where id = p_inquiry;
end;
$$;

-- ---------------------------------------------------------------------------
-- Public: talk to a specialist
-- ---------------------------------------------------------------------------
create or replace function public.submit_sales_inquiry(
  p_full_name text, p_email text, p_company_name text, p_company_type text,
  p_phone text, p_monthly_moves text, p_plan_interest text, p_message text
) returns void language plpgsql security definer set search_path = ''
as $$
declare v_email text := lower(btrim(p_email));
begin
  -- Basic abuse limits: per email, and overall per minute.
  if (select count(*) from public.sales_inquiries where email = v_email and created_at > now() - interval '1 hour') >= 3 then
    raise exception 'We already have your request. A specialist will be in touch soon.' using errcode = '54000';
  end if;
  if (select count(*) from public.sales_inquiries where created_at > now() - interval '1 minute') >= 20 then
    raise exception 'Too many requests right now. Please try again in a minute.' using errcode = '54000';
  end if;
  insert into public.sales_inquiries (full_name, email, company_name, company_type, phone, monthly_moves, plan_interest, message)
  values (btrim(p_full_name), v_email, btrim(p_company_name), p_company_type, nullif(btrim(coalesce(p_phone, '')), ''),
          nullif(btrim(coalesce(p_monthly_moves, '')), ''), nullif(btrim(coalesce(p_plan_interest, '')), ''),
          coalesce(btrim(p_message), ''));
end;
$$;

-- ---------------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;

-- Re-grant Milestone 1 functions (the blanket revoke above covers them too).
grant execute on function
  public.is_platform_admin(), public.is_member(uuid), public.has_role(uuid, public.member_role[]),
  public.shares_company_with(uuid), public.my_companies(),
  public.create_company(text, public.company_kind, text), public.update_company(uuid, text, text),
  public.create_invitation(uuid, text, public.member_role), public.revoke_invitation(uuid),
  public.accept_invitation(text), public.set_member_role(uuid, public.member_role),
  public.set_member_status(uuid, public.membership_status),
  public.admin_list_companies(), public.admin_set_company_status(uuid, public.company_status)
to authenticated;
grant execute on function public.get_invitation(text) to anon, authenticated;

grant execute on function
  public.is_forwarder_user(), public.is_listed_carrier(uuid), public.can_view_carrier(uuid),
  public.save_carrier_profile(uuid, text, text, text, text, text, text, text, text, text, date, boolean),
  public.save_carrier_coverage(uuid, smallint[], jsonb, jsonb, jsonb),
  public.search_carriers(uuid, text, smallint, text, text, text, text[], boolean, int, int),
  public.get_carrier_for_forwarder(uuid, uuid),
  public.set_carrier_relationship(uuid, uuid, public.relationship_status, text),
  public.set_carrier_note(uuid, uuid, text),
  public.my_customers(uuid),
  public.admin_list_carriers(), public.admin_set_qualification(uuid, public.qualification_status, text),
  public.admin_set_inquiry_status(uuid, text)
to authenticated;
grant execute on function public.submit_sales_inquiry(text, text, text, text, text, text, text, text) to anon, authenticated;
