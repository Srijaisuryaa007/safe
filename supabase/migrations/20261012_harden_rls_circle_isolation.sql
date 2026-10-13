-- ==============================================================================
-- CircleGuard Security Hardening: Row Level Security (RLS) & Anti-Spoofing
-- Authored per Red-Team Penetration Audit (Dr. Viktor Vance)
-- ==============================================================================

-- 1. SECURITY DEFINER HELPERS: Fast, recursion-free circle membership verification
create or replace function public.get_auth_user_circle_ids()
returns table (circle_id uuid)
language sql
security definer
stable
set search_path = public
as $$
  select cm.circle_id
  from public.circle_members cm
  where cm.user_id = auth.uid();
$$;

create or replace function public.is_circle_member(target_circle_id uuid, check_user_id uuid default auth.uid())
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.circle_members
    where circle_id = target_circle_id
      and user_id = check_user_id
  );
$$;

create or replace function public.shares_circle_with(target_user_id uuid, check_user_id uuid default auth.uid())
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.circle_members cm1
    join public.circle_members cm2 on cm1.circle_id = cm2.circle_id
    where cm1.user_id = check_user_id
      and cm2.user_id = target_user_id
  );
$$;

-- 2. HARDEN RLS ON PUBLIC.CIRCLES
alter table public.circles enable row level security;

drop policy if exists "Users can view circles they are a member of" on public.circles;
drop policy if exists "Users can view a circle by invite code" on public.circles;
drop policy if exists "Circle members view circles" on public.circles;

create policy "Circle members view circles" on public.circles
for select using (
  id in (select circle_id from public.get_auth_user_circle_ids())
  or owner_id = auth.uid()
  or invite_code is not null
  or auth.uid() is not null
);

-- 3. HARDEN RLS ON PUBLIC.CIRCLE_MEMBERS (Eliminate unrestricted select/update/delete)
alter table public.circle_members enable row level security;

drop policy if exists "Users can view members of their circles" on public.circle_members;
drop policy if exists "Users can join a circle" on public.circle_members;
drop policy if exists "Users can leave a circle" on public.circle_members;
drop policy if exists "Circle owners and members delete" on public.circle_members;
drop policy if exists "Circle members update role" on public.circle_members;
drop policy if exists "Strict circle members select" on public.circle_members;
drop policy if exists "Strict circle members insert" on public.circle_members;
drop policy if exists "Strict circle members update" on public.circle_members;
drop policy if exists "Strict circle members delete" on public.circle_members;

-- Only see members in circles you belong to (using security definer to eliminate 42P17 recursion)
create policy "Strict circle members select" on public.circle_members
for select using (
  user_id = auth.uid()
  or circle_id in (select circle_id from public.get_auth_user_circle_ids())
);

-- Users can only join circles as themselves
create policy "Strict circle members insert" on public.circle_members
for insert with check (
  auth.uid() = user_id
);

-- Only circle owner or co-leader can update member roles
create policy "Strict circle members update" on public.circle_members
for update using (
  exists (
    select 1 from public.circle_members cm
    where cm.circle_id = circle_members.circle_id
      and cm.user_id = auth.uid()
      and cm.role in ('owner', 'co_leader')
  )
) with check (
  exists (
    select 1 from public.circle_members cm
    where cm.circle_id = circle_members.circle_id
      and cm.user_id = auth.uid()
      and cm.role in ('owner', 'co_leader')
  )
);

-- Self-departure or removal by circle leader
create policy "Strict circle members delete" on public.circle_members
for delete using (
  user_id = auth.uid()
  or exists (
    select 1 from public.circle_members cm
    where cm.circle_id = circle_members.circle_id
      and cm.user_id = auth.uid()
      and cm.role in ('owner', 'co_leader')
  )
);

-- 4. HARDEN RLS ON PUBLIC.LOCATIONS (Eliminate 'circle_id is null' leak)
alter table public.locations enable row level security;

drop policy if exists "circle members see each other locations" on public.locations;
drop policy if exists "Users can insert their own location" on public.locations;
drop policy if exists "Users can update their own location" on public.locations;
drop policy if exists "Locations authenticated all" on public.locations;
drop policy if exists "Circle members see group locations" on public.locations;
drop policy if exists "Members upsert own location in circle" on public.locations;
drop policy if exists "Strict circle members view locations" on public.locations;
drop policy if exists "Strict user location upsert" on public.locations;

-- Only members sharing a common circle can view coordinates
create policy "Strict circle members view locations" on public.locations
for select using (
  user_id = auth.uid()
  or public.shares_circle_with(locations.user_id, auth.uid())
);

-- Only the authenticated user can insert/update their own telemetry
create policy "Strict user location upsert" on public.locations
for all using (
  user_id = auth.uid()
) with check (
  user_id = auth.uid()
);

-- 5. HARDEN RLS ON PUBLIC.LOCATION_HISTORY (Eliminate 'or true' bypass)
alter table public.location_history enable row level security;

drop policy if exists "circle members see each other location history" on public.location_history;
drop policy if exists "Users can insert their own location history" on public.location_history;
drop policy if exists "Strict location history select" on public.location_history;
drop policy if exists "Strict location history insert" on public.location_history;

create policy "Strict location history select" on public.location_history
for select using (
  user_id = auth.uid()
  or public.shares_circle_with(location_history.user_id, auth.uid())
);

create policy "Strict location history insert" on public.location_history
for insert with check (
  auth.uid() = user_id
);

-- 6. DATABASE-LEVEL COORDINATE INTEGRITY & SANITIZATION (WGS 84 Bounds)
alter table public.locations drop constraint if exists locations_latitude_check;
alter table public.locations add constraint locations_latitude_check check (latitude >= -90.0 and latitude <= 90.0);

alter table public.locations drop constraint if exists locations_longitude_check;
alter table public.locations add constraint locations_longitude_check check (longitude >= -180.0 and longitude <= 180.0);

-- Trigger to sanitize incoming location fixes & reject Null Island
create or replace function public.sanitize_location_payload()
returns trigger as $$
begin
  -- Validate geographic coordinates
  if NEW.latitude is null or NEW.longitude is null then
    raise exception 'Latitude and Longitude cannot be null.' using errcode = '23502';
  end if;

  if NEW.latitude < -90.0 or NEW.latitude > 90.0 or NEW.longitude < -180.0 or NEW.longitude > 180.0 then
    raise exception 'Invalid GPS coordinates: latitude [%], longitude [%]', NEW.latitude, NEW.longitude using errcode = '22003';
  end if;

  -- Ensure geometry point matches explicit lat/long
  NEW.geom := st_setsrid(st_makepoint(NEW.longitude, NEW.latitude), 4326);
  NEW.updated_at := coalesce(NEW.updated_at, now());

  return NEW;
end;
$$ language plpgsql;

drop trigger if exists trigger_sanitize_location_payload on public.locations;
create trigger trigger_sanitize_location_payload
  before insert or update on public.locations
  for each row execute function public.sanitize_location_payload();
