-- Enable PostGIS for geography types
create extension if not exists postgis with schema extensions;

-- Users
create table if not exists profiles (
  id uuid references auth.users primary key,
  full_name text not null,
  phone text unique,
  avatar_url text,
  created_at timestamptz default now()
);

-- Circles (family groups)
create table if not exists circles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid references profiles(id) not null,
  invite_code text unique not null,
  created_at timestamptz default now()
);

create table if not exists circle_members (
  circle_id uuid references circles(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  role text check (role in ('owner','member')) default 'member',
  joined_at timestamptz default now(),
  primary key (circle_id, user_id)
);

-- Live locations (latest position only, overwritten)
create table if not exists locations (
  user_id uuid references profiles(id) primary key,
  geom geography(Point, 4326) not null,
  accuracy_m float,
  speed_mps float,
  battery_pct int,
  is_driving boolean default false,
  updated_at timestamptz default now()
);

-- Location history (for trips/reports)
create table if not exists location_history (
  id bigint generated always as identity primary key,
  user_id uuid references profiles(id),
  geom geography(Point, 4326) not null,
  recorded_at timestamptz default now()
);
create index if not exists location_history_geom_idx on location_history using gist (geom);

-- Places (home, school, work etc.)
create table if not exists places (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid references circles(id) on delete cascade,
  name text not null,
  geom geography(Point, 4326) not null,
  radius_m int default 150,
  created_by uuid references profiles(id)
);

-- Place events (arrival/departure log)
create table if not exists place_events (
  id bigint generated always as identity primary key,
  place_id uuid references places(id),
  user_id uuid references profiles(id),
  event_type text check (event_type in ('arrival','departure')),
  occurred_at timestamptz default now()
);

-- SOS alerts
create table if not exists sos_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  circle_id uuid references circles(id),
  geom geography(Point, 4326),
  status text check (status in ('active','resolved')) default 'active',
  created_at timestamptz default now(),
  resolved_at timestamptz
);

-- Enable Row Level Security on ALL tables
alter table profiles enable row level security;
alter table circles enable row level security;
alter table circle_members enable row level security;
alter table locations enable row level security;
alter table location_history enable row level security;
alter table places enable row level security;
alter table place_events enable row level security;
alter table sos_alerts enable row level security;

-- Function to avoid infinite recursion when checking circle membership
create or replace function get_user_circle_ids()
returns setof uuid
language sql
security definer
set search_path = public
as $$
  select circle_id from circle_members where user_id = auth.uid();
$$;

-- RLS POLICIES --
-- Note: if you are running this again on an existing database, 
-- you may need to drop the old policies first or reset the database.

-- Profiles
drop policy if exists "Public profiles are viewable by everyone" on profiles;
create policy "Public profiles are viewable by everyone" on profiles for select using (true);
drop policy if exists "Users can view profiles of circle members" on profiles;
create policy "Users can view profiles of circle members"
on profiles
for select
using (
  exists (
    select 1
    from circle_members cm1
    join circle_members cm2 on cm1.circle_id = cm2.circle_id
    where cm1.user_id = auth.uid()
      and cm2.user_id = profiles.id
  )
);
drop policy if exists "Users can insert their own profile" on profiles;
create policy "Users can insert their own profile" on profiles for insert with check (auth.uid() = id);
drop policy if exists "Users can update their own profile" on profiles;
create policy "Users can update their own profile" on profiles for update using (auth.uid() = id);

-- Circles
drop policy if exists "Users can view circles they are a member of" on circles;
create policy "Users can view circles they are a member of" on circles for select using (
  id in (select get_user_circle_ids())
);
drop policy if exists "Users can view a circle by invite code" on circles;
create policy "Users can view a circle by invite code" on circles for select using (true); -- needed to validate invite code before joining
drop policy if exists "Authenticated users can create circles" on circles;
create policy "Authenticated users can create circles" on circles for insert with check (auth.role() = 'authenticated');
drop policy if exists "Circle owners can update their circle" on circles;
create policy "Circle owners can update their circle" on circles for update using (owner_id = auth.uid());

-- Circle Members
drop policy if exists "Users can view members of their circles" on circle_members;
create policy "Users can view members of their circles" on circle_members for select using (
  circle_id in (select get_user_circle_ids())
);
drop policy if exists "Users can join a circle" on circle_members;
create policy "Users can join a circle" on circle_members for insert with check (auth.uid() = user_id);
drop policy if exists "Users can leave a circle" on circle_members;
create policy "Users can leave a circle" on circle_members for delete using (auth.uid() = user_id);

-- Locations
drop policy if exists "circle members see each other locations" on locations;
create policy "circle members see each other locations" on locations for select using (
  user_id in (
    select user_id from circle_members where circle_id in (select get_user_circle_ids())
  )
);
drop policy if exists "Users can insert their own location" on locations;
create policy "Users can insert their own location" on locations for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update their own location" on locations;
create policy "Users can update their own location" on locations for update using (auth.uid() = user_id);

-- Location History
drop policy if exists "circle members see each other location history" on location_history;
create policy "circle members see each other location history" on location_history for select using (
  user_id in (
    select user_id from circle_members where circle_id in (select get_user_circle_ids())
  )
);
drop policy if exists "Users can insert their own location history" on location_history;
create policy "Users can insert their own location history" on location_history for insert with check (auth.uid() = user_id);

-- Places
drop policy if exists "circle members see places for their circle" on places;
create policy "circle members see places for their circle" on places for select using (
  circle_id in (select get_user_circle_ids())
);
drop policy if exists "Users can create places for their circles" on places;
create policy "Users can create places for their circles" on places for insert with check (
  circle_id in (select get_user_circle_ids())
);
drop policy if exists "Users can update places they created" on places;
create policy "Users can update places they created" on places for update using (created_by = auth.uid());
drop policy if exists "Users can delete places they created" on places;
create policy "Users can delete places they created" on places for delete using (created_by = auth.uid());

-- Place Events
drop policy if exists "circle members see place events for their circle" on place_events;
create policy "circle members see place events for their circle" on place_events for select using (
  place_id in (select id from places where circle_id in (select get_user_circle_ids()))
);
drop policy if exists "Users can insert their own place events" on place_events;
create policy "Users can insert their own place events" on place_events for insert with check (auth.uid() = user_id);

-- SOS Alerts
drop policy if exists "circle members see sos alerts for their circle" on sos_alerts;
create policy "circle members see sos alerts for their circle" on sos_alerts for select using (
  circle_id in (select get_user_circle_ids())
);
drop policy if exists "Users can insert their own sos alerts" on sos_alerts;
create policy "Users can insert their own sos alerts" on sos_alerts for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update their own sos alerts" on sos_alerts;
create policy "Users can update their own sos alerts" on sos_alerts for update using (auth.uid() = user_id);

-- Storage (Avatars)
-- Note: you need to create a bucket named 'avatars' manually in the Supabase Dashboard
-- or using the API before these policies will apply.
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict (id) do nothing;
drop policy if exists "Avatar images are publicly accessible" on storage.objects;
create policy "Avatar images are publicly accessible" on storage.objects for select using (bucket_id = 'avatars');
drop policy if exists "Users can upload their own avatar" on storage.objects;
create policy "Users can upload their own avatar" on storage.objects for insert with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
drop policy if exists "Users can update their own avatar" on storage.objects;
create policy "Users can update their own avatar" on storage.objects for update using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
drop policy if exists "Users can delete their own avatar" on storage.objects;
create policy "Users can delete their own avatar" on storage.objects for delete using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
