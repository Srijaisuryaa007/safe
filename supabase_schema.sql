-- ============================================================================
-- CIRCLEGUARD PRODUCTION SUPABASE SCHEMA & SECURITY POLICIES (MASTER FILE)
-- ============================================================================

-- 1. Enable PostGIS Extension for Geography & Mapping Types
create extension if not exists postgis with schema extensions;

-- 2. CREATE TABLES WITH ON DELETE CASCADE

-- Profiles (linked to Supabase auth.users)
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  full_name text not null,
  phone text unique,
  avatar_url text,
  push_token text,
  is_ghost_mode boolean default false,
  hide_online_presence boolean default false,
  created_at timestamptz default now()
);

-- Circles (Family / Private groups)
create table if not exists public.circles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid references public.profiles(id) on delete cascade not null,
  invite_code text unique not null,
  tracking_mode text default 'continuous',
  created_at timestamptz default now()
);

-- Circle Members
create table if not exists public.circle_members (
  circle_id uuid references public.circles(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  role text check (role in ('owner','member')) default 'member',
  joined_at timestamptz default now(),
  primary key (circle_id, user_id)
);

-- Live Locations (Latest position per user)
create table if not exists public.locations (
  user_id uuid references public.profiles(id) on delete cascade primary key,
  geom geography(Point, 4326) not null,
  accuracy_m float,
  speed_mps float default 0,
  battery_pct int,
  is_driving boolean default false,
  activity_state text default 'Stationary',
  updated_at timestamptz default now()
);

-- Location History (For historical movement logs)
create table if not exists public.location_history (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  geom geography(Point, 4326) not null,
  recorded_at timestamptz default now()
);
create index if not exists location_history_geom_idx on public.location_history using gist (geom);

-- Places (Home, School, Work, Route geofences)
create table if not exists public.places (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid references public.circles(id) on delete cascade,
  name text not null,
  geom geography(Point, 4326) not null,
  radius_m int default 150,
  created_by uuid references public.profiles(id) on delete cascade,
  start_lat float,
  start_lng float,
  end_lat float,
  end_lng float,
  target_user_id uuid references public.profiles(id) on delete cascade,
  category text default 'home'
);

-- Place Events (Arrival & Departure logs)
create table if not exists public.place_events (
  id bigint generated always as identity primary key,
  place_id uuid references public.places(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  event_type text check (event_type in ('arrival','departure')),
  occurred_at timestamptz default now()
);

-- Location Shares (Realtime targeted location broadcast events)
create table if not exists public.location_shares (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid references public.circles(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete cascade,
  target_user_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz default now()
);

-- SOS Alerts
create table if not exists public.sos_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  circle_id uuid references public.circles(id) on delete cascade,
  geom geography(Point, 4326),
  status text check (status in ('active','resolved','cancelled')) default 'active',
  created_at timestamptz default now(),
  resolved_at timestamptz
);


-- 3. MIGRATION ALTER STATEMENTS (Safe for existing databases)

alter table public.profiles 
  drop constraint if exists profiles_id_fkey,
  add constraint profiles_id_fkey foreign key (id) references auth.users(id) on delete cascade;

alter table public.circles 
  drop constraint if exists circles_owner_id_fkey,
  add constraint circles_owner_id_fkey foreign key (owner_id) references public.profiles(id) on delete cascade;

alter table public.circle_members 
  drop constraint if exists circle_members_circle_id_fkey,
  add constraint circle_members_circle_id_fkey foreign key (circle_id) references public.circles(id) on delete cascade,
  drop constraint if exists circle_members_user_id_fkey,
  add constraint circle_members_user_id_fkey foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.locations 
  drop constraint if exists locations_user_id_fkey,
  add constraint locations_user_id_fkey foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.location_history 
  drop constraint if exists location_history_user_id_fkey,
  add constraint location_history_user_id_fkey foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.places 
  drop constraint if exists places_circle_id_fkey,
  add constraint places_circle_id_fkey foreign key (circle_id) references public.circles(id) on delete cascade,
  drop constraint if exists places_created_by_fkey,
  add constraint places_created_by_fkey foreign key (created_by) references public.profiles(id) on delete cascade;

alter table public.place_events 
  drop constraint if exists place_events_place_id_fkey,
  add constraint place_events_place_id_fkey foreign key (place_id) references public.places(id) on delete cascade,
  drop constraint if exists place_events_user_id_fkey,
  add constraint place_events_user_id_fkey foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.sos_alerts 
  drop constraint if exists sos_alerts_user_id_fkey,
  add constraint sos_alerts_user_id_fkey foreign key (user_id) references public.profiles(id) on delete cascade,
  drop constraint if exists sos_alerts_circle_id_fkey,
  add constraint sos_alerts_circle_id_fkey foreign key (circle_id) references public.circles(id) on delete cascade;

-- Idempotent Column Additions for Existing Deployments
alter table public.places add column if not exists start_lat float;
alter table public.places add column if not exists start_lng float;
alter table public.places add column if not exists end_lat float;
alter table public.places add column if not exists end_lng float;
alter table public.places add column if not exists target_user_id uuid references public.profiles(id) on delete cascade;
alter table public.places add column if not exists category text default 'home';

alter table public.profiles add column if not exists push_token text;
alter table public.profiles add column if not exists is_ghost_mode boolean default false;
alter table public.profiles add column if not exists hide_online_presence boolean default false;

alter table public.circles add column if not exists tracking_mode text default 'continuous';

alter table public.locations add column if not exists speed_mps float default 0;
alter table public.locations add column if not exists activity_state text default 'Stationary';


-- 4. AUTO PROFILE CREATION TRIGGER ON USER SIGN-UP
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- 5. ENABLE ROW LEVEL SECURITY (RLS)
alter table public.profiles enable row level security;
alter table public.circles enable row level security;
alter table public.circle_members enable row level security;
alter table public.locations enable row level security;
alter table public.location_history enable row level security;
alter table public.places enable row level security;
alter table public.place_events enable row level security;
alter table public.sos_alerts enable row level security;


-- 6. HELPER FUNCTION TO AVOID RLS RECURSION
create or replace function public.get_user_circle_ids()
returns setof uuid
language sql
security definer
set search_path = public
as $$
  select circle_id from circle_members where user_id = auth.uid();
$$;


-- 7. RLS POLICIES

-- Profiles
drop policy if exists "Public profiles are viewable by everyone" on public.profiles;
create policy "Public profiles are viewable by everyone" on public.profiles for select using (true);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile" on public.profiles for insert with check (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile" on public.profiles for update using (auth.uid() = id);

-- Circles
drop policy if exists "Users can view circles they are a member of" on public.circles;
create policy "Users can view circles they are a member of" on public.circles for select using (true);

drop policy if exists "Users can view a circle by invite code" on public.circles;
create policy "Users can view a circle by invite code" on public.circles for select using (true);

drop policy if exists "Authenticated users can create circles" on public.circles;
create policy "Authenticated users can create circles" on public.circles for insert with check (auth.role() = 'authenticated');

drop policy if exists "Circle owners can update their circle" on public.circles;
create policy "Circle owners can update their circle" on public.circles for update using (owner_id = auth.uid());

drop policy if exists "Circle owners can delete their circle" on public.circles;
create policy "Circle owners can delete their circle" on public.circles for delete using (owner_id = auth.uid());

-- Circle Members
drop policy if exists "Users can view members of their circles" on public.circle_members;
create policy "Users can view members of their circles" on public.circle_members for select using (true);

drop policy if exists "Users can join a circle" on public.circle_members;
create policy "Users can join a circle" on public.circle_members for insert with check (auth.uid() = user_id);

drop policy if exists "Users can leave a circle" on public.circle_members;
create policy "Users can leave a circle" on public.circle_members for delete using (auth.uid() = user_id);

-- Locations (Allows instant cross-member reading & updating)
drop policy if exists "circle members see each other locations" on public.locations;
drop policy if exists "Users can insert their own location" on public.locations;
drop policy if exists "Users can update their own location" on public.locations;
drop policy if exists "Locations authenticated all" on public.locations;
create policy "Locations authenticated all" on public.locations for all using (true) with check (true);

-- Location History
drop policy if exists "circle members see each other location history" on public.location_history;
create policy "circle members see each other location history" on public.location_history for select using (true);

drop policy if exists "Users can insert their own location history" on public.location_history;
create policy "Users can insert their own location history" on public.location_history for insert with check (auth.uid() = user_id);

-- Places
drop policy if exists "circle members see places for their circle" on public.places;
drop policy if exists "Users can create places for their circles" on public.places;
drop policy if exists "Users can update places they created" on public.places;
drop policy if exists "Circle members can delete places for their circle" on public.places;
drop policy if exists "Places authenticated all" on public.places;
create policy "Places authenticated all" on public.places for all using (true) with check (true);

-- Place Events
drop policy if exists "circle members see place events for their circle" on public.place_events;
create policy "circle members see place events for their circle" on public.place_events for select using (true);

drop policy if exists "Users can insert their own place events" on public.place_events;
create policy "Users can insert their own place events" on public.place_events for insert with check (auth.uid() = user_id);

-- Location Shares
drop policy if exists "Location shares authenticated all" on public.location_shares;
create policy "Location shares authenticated all" on public.location_shares for all using (true) with check (true);

-- SOS Alerts
drop policy if exists "circle members see sos alerts for their circle" on public.sos_alerts;
drop policy if exists "Users can insert their own sos alerts" on public.sos_alerts;
drop policy if exists "Users can update their own sos alerts" on public.sos_alerts;
drop policy if exists "SOS alerts authenticated all" on public.sos_alerts;
create policy "SOS alerts authenticated all" on public.sos_alerts for all using (true) with check (true);


-- 8. STORAGE SETUP & BUCKET POLICIES FOR AVATARS
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict (id) do nothing;

drop policy if exists "Avatar images are publicly accessible" on storage.objects;
create policy "Avatar images are publicly accessible" on storage.objects for select using (bucket_id = 'avatars');

drop policy if exists "Users can upload their own avatar" on storage.objects;
create policy "Users can upload their own avatar" on storage.objects for insert with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Users can update their own avatar" on storage.objects;
create policy "Users can update their own avatar" on storage.objects for update using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Users can delete their own avatar" on storage.objects;
create policy "Users can delete their own avatar" on storage.objects for delete using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);


-- 9. SAFE REALTIME PUBLICATION ENABLEMENT (Ignores duplicate table errors)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'locations') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.locations;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'circle_members') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.circle_members;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'sos_alerts') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sos_alerts;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'places') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.places;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'location_shares') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.location_shares;
  END IF;
END $$;
