-- Milestone 1: identity, companies, memberships, invitations, platform admins, audit.
-- All access rules are enforced here with RLS + security-definer functions.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.company_kind as enum ('carrier', 'forwarder');
create type public.company_status as enum ('active', 'suspended');
create type public.member_role as enum ('owner', 'admin', 'dispatcher', 'member', 'driver');
create type public.membership_status as enum ('active', 'disabled');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '' check (char_length(full_name) <= 120),
  phone text check (phone is null or char_length(phone) <= 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  kind public.company_kind not null,
  name text not null check (char_length(btrim(name)) between 2 and 120),
  legal_name text check (legal_name is null or char_length(legal_name) <= 200),
  status public.company_status not null default 'active',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.company_memberships (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.member_role not null,
  status public.membership_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, user_id)
);
create index company_memberships_user_idx on public.company_memberships (user_id);

create table public.company_invitations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  email text not null check (email = lower(btrim(email)) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role public.member_role not null,
  token_hash text not null unique,
  invited_by uuid references auth.users (id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index company_invitations_company_idx on public.company_invitations (company_id, created_at desc);

create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  company_id uuid references public.companies (id) on delete set null,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_events_company_idx on public.audit_events (company_id, created_at desc);
create index audit_events_created_idx on public.audit_events (created_at desc);

-- ---------------------------------------------------------------------------
-- Helper functions (security definer so RLS policies can call them without recursion)
-- ---------------------------------------------------------------------------
create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.platform_admins where user_id = (select auth.uid()));
$$;

create or replace function public.is_member(p_company uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.company_memberships m
    join public.companies c on c.id = m.company_id
    where m.company_id = p_company
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and c.status = 'active'
  );
$$;

create or replace function public.has_role(p_company uuid, p_roles public.member_role[])
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.company_memberships m
    join public.companies c on c.id = m.company_id
    where m.company_id = p_company
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and c.status = 'active'
      and m.role = any (p_roles)
  );
$$;

create or replace function public.shares_company_with(p_user uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.company_memberships a
    join public.company_memberships b on a.company_id = b.company_id
    join public.companies c on c.id = a.company_id
    where a.user_id = (select auth.uid()) and a.status = 'active'
      and b.user_id = p_user
      and c.status = 'active'
  );
$$;

create or replace function public.role_allowed_for_kind(p_kind public.company_kind, p_role public.member_role)
returns boolean language sql immutable set search_path = ''
as $$
  select case p_kind
    when 'carrier' then p_role in ('owner', 'admin', 'dispatcher', 'driver')
    when 'forwarder' then p_role in ('owner', 'admin', 'member')
  end;
$$;

create or replace function public.write_audit(
  p_company uuid, p_action text, p_target_type text, p_target_id text, p_metadata jsonb default '{}'::jsonb
) returns void language sql security definer set search_path = ''
as $$
  insert into public.audit_events (company_id, actor_id, action, target_type, target_id, metadata)
  values (p_company, (select auth.uid()), p_action, p_target_type, p_target_id, coalesce(p_metadata, '{}'::jsonb));
$$;

create or replace function public.hash_token(p_token text)
returns text language sql immutable set search_path = ''
as $$
  select encode(extensions.digest(p_token, 'sha256'), 'hex');
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger companies_touch before update on public.companies
  for each row execute function public.touch_updated_at();
create trigger memberships_touch before update on public.company_memberships
  for each row execute function public.touch_updated_at();

create or replace function public.check_role_for_company()
returns trigger language plpgsql set search_path = ''
as $$
declare v_kind public.company_kind;
begin
  select kind into v_kind from public.companies where id = new.company_id;
  if not public.role_allowed_for_kind(v_kind, new.role) then
    raise exception 'Role % is not valid for a % company', new.role, v_kind using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger memberships_role_check before insert or update of role on public.company_memberships
  for each row execute function public.check_role_for_company();
create trigger invitations_role_check before insert or update of role on public.company_invitations
  for each row execute function public.check_role_for_company();

-- Create a profile for every new auth user.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, lower(new.email), coalesce(left(new.raw_user_meta_data ->> 'full_name', 120), ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep profile email in sync when a user changes their email.
create or replace function public.handle_user_email_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = lower(new.email) where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_email_changed after update of email on auth.users
  for each row execute function public.handle_user_email_change();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.company_memberships enable row level security;
alter table public.company_invitations enable row level security;
alter table public.platform_admins enable row level security;
alter table public.audit_events enable row level security;

-- Direct writes are not allowed except where granted below; multi-step writes go through RPCs.
revoke all on public.profiles, public.companies, public.company_memberships,
  public.company_invitations, public.platform_admins, public.audit_events from anon, authenticated;
grant select on public.profiles, public.companies, public.company_memberships,
  public.company_invitations, public.platform_admins, public.audit_events to authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

-- profiles
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.shares_company_with(id) or public.is_platform_admin());
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- companies: members of an active company, and platform admins (metadata only)
create policy companies_select on public.companies for select to authenticated
  using (public.is_member(id) or public.is_platform_admin());

-- memberships: see your own rows (even in a suspended company) and your teammates
create policy memberships_select on public.company_memberships for select to authenticated
  using (user_id = (select auth.uid()) or public.is_member(company_id) or public.is_platform_admin());

-- invitations: company owners/admins only
create policy invitations_select on public.company_invitations for select to authenticated
  using (public.has_role(company_id, array['owner', 'admin']::public.member_role[]));

-- platform admins: you can see whether you are one; admins see the list
create policy platform_admins_select on public.platform_admins for select to authenticated
  using (user_id = (select auth.uid()) or public.is_platform_admin());

-- audit: company owners/admins see their company's events; platform admins see all
create policy audit_select on public.audit_events for select to authenticated
  using (
    (company_id is not null and public.has_role(company_id, array['owner', 'admin']::public.member_role[]))
    or public.is_platform_admin()
  );

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- Companies the current user belongs to, including suspended ones (so the UI can explain).
create or replace function public.my_companies()
returns table (
  company_id uuid, name text, kind public.company_kind, company_status public.company_status,
  role public.member_role, membership_status public.membership_status
)
language sql stable security definer set search_path = ''
as $$
  select c.id, c.name, c.kind, c.status, m.role, m.status
  from public.company_memberships m
  join public.companies c on c.id = m.company_id
  where m.user_id = (select auth.uid())
  order by c.name;
$$;

create or replace function public.create_company(p_name text, p_kind public.company_kind, p_legal_name text default null)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid;
begin
  if v_uid is null then raise exception 'Not signed in' using errcode = '42501'; end if;
  if (select count(*) from public.companies where created_by = v_uid) >= 10 then
    raise exception 'Company limit reached for this account' using errcode = '54000';
  end if;

  insert into public.companies (kind, name, legal_name, created_by)
  values (p_kind, btrim(p_name), nullif(btrim(coalesce(p_legal_name, '')), ''), v_uid)
  returning id into v_id;

  insert into public.company_memberships (company_id, user_id, role) values (v_id, v_uid, 'owner');

  perform public.write_audit(v_id, 'company.created', 'company', v_id::text,
    jsonb_build_object('name', btrim(p_name), 'kind', p_kind));
  return v_id;
end;
$$;

create or replace function public.update_company(p_company uuid, p_name text, p_legal_name text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.has_role(p_company, array['owner', 'admin']::public.member_role[]) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  update public.companies
     set name = btrim(p_name), legal_name = nullif(btrim(coalesce(p_legal_name, '')), '')
   where id = p_company;
  perform public.write_audit(p_company, 'company.updated', 'company', p_company::text,
    jsonb_build_object('name', btrim(p_name)));
end;
$$;

-- Returns the raw token exactly once; only its hash is stored.
create or replace function public.create_invitation(p_company uuid, p_email text, p_role public.member_role)
returns table (invitation_id uuid, token text, expires_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare
  v_email text := lower(btrim(p_email));
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
  v_id uuid;
  v_expires timestamptz := now() + interval '7 days';
begin
  if not public.has_role(p_company, array['owner', 'admin']::public.member_role[]) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_role = 'owner' and not public.has_role(p_company, array['owner']::public.member_role[]) then
    raise exception 'Only an owner can invite another owner' using errcode = '42501';
  end if;
  if (select count(*) from public.company_invitations i
       where i.company_id = p_company and i.created_at > now() - interval '1 hour') >= 50 then
    raise exception 'Too many invitations in the last hour. Try again later.' using errcode = '54000';
  end if;
  if exists (
    select 1 from public.company_memberships m join public.profiles p on p.id = m.user_id
     where m.company_id = p_company and p.email = v_email and m.status = 'active'
  ) then
    raise exception 'That person is already a member of this company' using errcode = '23505';
  end if;

  -- One live invitation per email per company.
  update public.company_invitations i set revoked_at = now()
   where i.company_id = p_company and i.email = v_email
     and i.accepted_at is null and i.revoked_at is null;

  insert into public.company_invitations (company_id, email, role, token_hash, invited_by, expires_at)
  values (p_company, v_email, p_role, public.hash_token(v_token), (select auth.uid()), v_expires)
  returning id into v_id;

  perform public.write_audit(p_company, 'invitation.created', 'invitation', v_id::text,
    jsonb_build_object('email', v_email, 'role', p_role));

  return query select v_id, v_token, v_expires;
end;
$$;

create or replace function public.revoke_invitation(p_invitation uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_company uuid;
begin
  select company_id into v_company from public.company_invitations where id = p_invitation;
  if v_company is null or not public.has_role(v_company, array['owner', 'admin']::public.member_role[]) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  update public.company_invitations set revoked_at = now()
   where id = p_invitation and accepted_at is null and revoked_at is null;
  perform public.write_audit(v_company, 'invitation.revoked', 'invitation', p_invitation::text);
end;
$$;

-- Public lookup for the invite landing page. Requires the secret token; reveals only what the
-- recipient needs to decide.
create or replace function public.get_invitation(p_token text)
returns table (company_name text, company_kind public.company_kind, email text, role public.member_role,
               state text, expires_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select c.name, c.kind, i.email, i.role,
         case
           when i.accepted_at is not null then 'accepted'
           when i.revoked_at is not null then 'revoked'
           when i.expires_at < now() then 'expired'
           when c.status <> 'active' then 'unavailable'
           else 'pending'
         end,
         i.expires_at
  from public.company_invitations i
  join public.companies c on c.id = i.company_id
  where i.token_hash = public.hash_token(p_token);
$$;

create or replace function public.accept_invitation(p_token text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_email text := lower((select auth.jwt()) ->> 'email');
  v_inv public.company_invitations;
  v_status public.company_status;
begin
  if v_uid is null then raise exception 'Not signed in' using errcode = '42501'; end if;

  select * into v_inv from public.company_invitations
   where token_hash = public.hash_token(p_token) for update;
  if v_inv.id is null then raise exception 'Invitation not found' using errcode = 'P0002'; end if;
  if v_inv.accepted_at is not null then raise exception 'Invitation already used' using errcode = '22023'; end if;
  if v_inv.revoked_at is not null then raise exception 'Invitation was revoked' using errcode = '22023'; end if;
  if v_inv.expires_at < now() then raise exception 'Invitation has expired' using errcode = '22023'; end if;
  if v_email is distinct from v_inv.email then
    raise exception 'This invitation was sent to a different email address' using errcode = '42501';
  end if;
  select status into v_status from public.companies where id = v_inv.company_id;
  if v_status <> 'active' then raise exception 'This company is not active' using errcode = '42501'; end if;

  insert into public.company_memberships (company_id, user_id, role, status)
  values (v_inv.company_id, v_uid, v_inv.role, 'active')
  on conflict (company_id, user_id) do update set role = excluded.role, status = 'active';

  update public.company_invitations set accepted_at = now(), accepted_by = v_uid where id = v_inv.id;

  perform public.write_audit(v_inv.company_id, 'invitation.accepted', 'invitation', v_inv.id::text,
    jsonb_build_object('email', v_inv.email, 'role', v_inv.role));
  return v_inv.company_id;
end;
$$;

create or replace function public.count_active_owners(p_company uuid)
returns int language sql stable security definer set search_path = ''
as $$
  select count(*)::int from public.company_memberships
   where company_id = p_company and role = 'owner' and status = 'active';
$$;

create or replace function public.set_member_role(p_membership uuid, p_role public.member_role)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_m public.company_memberships;
begin
  select * into v_m from public.company_memberships where id = p_membership for update;
  if v_m.id is null or not public.has_role(v_m.company_id, array['owner', 'admin']::public.member_role[]) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  -- Only owners may grant or remove the owner role.
  if (p_role = 'owner' or v_m.role = 'owner')
     and not public.has_role(v_m.company_id, array['owner']::public.member_role[]) then
    raise exception 'Only an owner can change owner access' using errcode = '42501';
  end if;
  if v_m.role = 'owner' and p_role <> 'owner' and v_m.status = 'active'
     and public.count_active_owners(v_m.company_id) <= 1 then
    raise exception 'A company needs at least one owner' using errcode = '22023';
  end if;
  update public.company_memberships set role = p_role where id = p_membership;
  perform public.write_audit(v_m.company_id, 'member.role_changed', 'membership', p_membership::text,
    jsonb_build_object('user_id', v_m.user_id, 'from', v_m.role, 'to', p_role));
end;
$$;

create or replace function public.set_member_status(p_membership uuid, p_status public.membership_status)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_m public.company_memberships;
begin
  select * into v_m from public.company_memberships where id = p_membership for update;
  if v_m.id is null or not public.has_role(v_m.company_id, array['owner', 'admin']::public.member_role[]) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if v_m.role = 'owner' and not public.has_role(v_m.company_id, array['owner']::public.member_role[]) then
    raise exception 'Only an owner can change another owner' using errcode = '42501';
  end if;
  if v_m.role = 'owner' and p_status = 'disabled' and public.count_active_owners(v_m.company_id) <= 1 then
    raise exception 'A company needs at least one active owner' using errcode = '22023';
  end if;
  update public.company_memberships set status = p_status where id = p_membership;
  perform public.write_audit(v_m.company_id,
    case p_status when 'disabled' then 'member.disabled' else 'member.reactivated' end,
    'membership', p_membership::text, jsonb_build_object('user_id', v_m.user_id));
end;
$$;

-- Platform admin: company list with usage counts (no job data).
create or replace function public.admin_list_companies()
returns table (id uuid, name text, kind public.company_kind, status public.company_status,
               created_at timestamptz, active_members bigint, pending_invitations bigint)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_platform_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  return query
    select c.id, c.name, c.kind, c.status, c.created_at,
      (select count(*) from public.company_memberships m where m.company_id = c.id and m.status = 'active'),
      (select count(*) from public.company_invitations i where i.company_id = c.id
         and i.accepted_at is null and i.revoked_at is null and i.expires_at > now())
    from public.companies c
    order by c.created_at desc;
end;
$$;

create or replace function public.admin_set_company_status(p_company uuid, p_status public.company_status)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_platform_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  update public.companies set status = p_status where id = p_company;
  if not found then raise exception 'Company not found' using errcode = 'P0002'; end if;
  perform public.write_audit(p_company,
    case p_status when 'suspended' then 'company.suspended' else 'company.reactivated' end,
    'company', p_company::text);
end;
$$;

-- ---------------------------------------------------------------------------
-- Function privileges: nothing callable by default; grant what the app uses.
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;

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
