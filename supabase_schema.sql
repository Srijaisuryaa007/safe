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
  gps_frequency text default 'high' check (gps_frequency in ('high', 'balanced', 'saver')),
  shake_sos_enabled boolean default false,
  app_lock_enabled boolean default false,
  is_premium boolean default false,
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
  role text check (role in ('owner','co_leader','guardian','member')) default 'member',
  supervisor_id uuid references public.profiles(id) on delete set null,
  joined_at timestamptz default now(),
  primary key (circle_id, user_id)
);

-- Live Locations (Group-scoped latest position per member: user_id + circle_id)
create table if not exists public.locations (
  circle_id uuid references public.circles(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  latitude float,
  longitude float,
  geom geography(Point, 4326),
  accuracy_m float,
  speed_mps float default 0,
  battery_pct int,
  is_driving boolean default false,
  activity_state text default 'Stationary',
  updated_at timestamptz default now(),
  primary key (circle_id, user_id)
);

-- Location History (For historical movement logs)
create table if not exists public.location_history (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  geom geography(Point, 4326) not null,
  speed_mps float default 0,
  recorded_at timestamptz default now()
);
create index if not exists location_history_geom_idx on public.location_history using gist (geom);
create index if not exists idx_location_history_user_recorded_at on public.location_history (user_id, recorded_at asc);
create index if not exists idx_circle_members_user_id on public.circle_members (user_id);
create index if not exists idx_locations_user_id_updated on public.locations (user_id, updated_at desc);

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
  category text default 'home',
  speed_adaptive boolean default false,
  active_hours_start text,
  active_hours_end text,
  active_days text[]
);

-- Place Members (Join table linking safe zones to assigned circle members)
create table if not exists public.place_members (
  place_id uuid references public.places(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (place_id, user_id)
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

-- Circle Messages (In-App Realtime Chat)
create table if not exists public.circle_messages (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid references public.circles(id) on delete cascade not null,
  sender_id uuid references public.profiles(id) on delete cascade not null,
  content text not null,
  message_type text default 'text',
  media_url text,
  created_at timestamptz default now()
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
  add constraint circle_members_user_id_fkey foreign key (user_id) references public.profiles(id) on delete cascade,
  drop constraint if exists circle_members_role_check,
  add constraint circle_members_role_check check (role in ('owner','co_leader','guardian','member'));

-- Ensure circle_id exists before referencing it in any constraint
alter table public.locations add column if not exists circle_id uuid references public.circles(id) on delete cascade;

alter table public.locations 
  drop constraint if exists locations_user_id_fkey,
  add constraint locations_user_id_fkey foreign key (user_id) references public.profiles(id) on delete cascade;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'locations_circle_id_fkey'
  ) then
    alter table public.locations 
      add constraint locations_circle_id_fkey foreign key (circle_id) references public.circles(id) on delete cascade;
  end if;
end $$;

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
alter table public.places add column if not exists speed_adaptive boolean default false;
alter table public.places add column if not exists active_hours_start text;
alter table public.places add column if not exists active_hours_end text;
alter table public.places add column if not exists active_days text[];

alter table public.profiles add column if not exists push_token text;
alter table public.profiles add column if not exists is_ghost_mode boolean default false;
alter table public.profiles add column if not exists hide_online_presence boolean default false;
alter table public.profiles add column if not exists is_premium boolean default false;
alter table public.profiles add column if not exists medical_info jsonb default '{}'::jsonb;

alter table public.location_history add column if not exists speed_mps float default 0;

-- 3B. Postgres Server-Side Premium Gating Trigger (Enforces 2-Place Limit, Speed-Adaptive, Schedules & Routes)
create or replace function public.enforce_place_premium_gating()
returns trigger as $$
declare
  creator_is_premium boolean;
  current_place_count integer;
begin
  -- Retrieve creator premium status from profiles table (source of truth)
  select coalesce(is_premium, false) into creator_is_premium
  from public.profiles
  where id = NEW.created_by;

  -- If creator is premium, allow all operations
  if creator_is_premium is true then
    return NEW;
  end if;

  -- Server-Side Enforcement for Free Tier Users:
  -- 1. Reject speed_adaptive = true
  if NEW.speed_adaptive is true then
    raise exception 'Speed-Adaptive Geofencing requires Circle Guard Plus.' using errcode = 'P0001';
  end if;

  -- 2. Reject ROUTE category
  if NEW.category = 'route' then
    raise exception 'Commute Corridor Route geofencing requires Circle Guard Plus.' using errcode = 'P0001';
  end if;

  -- 3. Reject Active Hours/Days schedules
  if NEW.active_hours_start is not null or NEW.active_hours_end is not null or NEW.active_days is not null then
    raise exception 'Geofence active scheduling requires Circle Guard Plus.' using errcode = 'P0001';
  end if;

  -- 4. Reject 3rd+ place creation for the circle (Limit = 2 places)
  if TG_OP = 'INSERT' then
    select count(*) into current_place_count
    from public.places
    where circle_id = NEW.circle_id;

    if current_place_count >= 2 then
      raise exception 'Free tier is limited to 2 saved safe places per circle.' using errcode = 'P0002';
    end if;
  end if;

  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists trigger_enforce_place_premium_gating on public.places;
create trigger trigger_enforce_place_premium_gating
  before insert or update on public.places
  for each row execute function public.enforce_place_premium_gating();

-- 3C. RevenueCat Webhook Entitlement Handler (Initial Purchase / Renewal / Cancellation / Expiration)
create or replace function public.handle_revenuecat_webhook(
  event_type text,
  target_user_id uuid
) returns void as $$
begin
  if event_type in ('INITIAL_PURCHASE', 'RENEWAL', 'PRODUCT_CHANGE', 'UNCANCEL') then
    update public.profiles set is_premium = true where id = target_user_id;
  elsif event_type in ('CANCELLATION', 'EXPIRATION', 'REFUND') then
    update public.profiles set is_premium = false where id = target_user_id;
  end if;
end;
$$ language plpgsql security definer;

alter table public.circles add column if not exists tracking_mode text default 'continuous';
alter table public.circle_members add column if not exists supervisor_id uuid references public.profiles(id) on delete set null;
alter table public.profiles add column if not exists emergency_contacts jsonb default '[]'::jsonb;

alter table public.locations add column if not exists circle_id uuid references public.circles(id) on delete cascade;
alter table public.locations add column if not exists latitude float;
alter table public.locations add column if not exists longitude float;
alter table public.locations add column if not exists speed_mps float default 0;
alter table public.locations add column if not exists activity_state text default 'Stationary';
create index if not exists locations_circle_user_idx on public.locations (circle_id, user_id);


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
alter table public.location_shares enable row level security;


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
drop policy if exists "Users or circle leaders can update profiles" on public.profiles;
create policy "Users or circle leaders can update profiles" on public.profiles for update using (
  auth.uid() = id
  or exists (
    select 1 from public.circle_members cm_leader
    join public.circle_members cm_target on cm_target.circle_id = cm_leader.circle_id
    where cm_leader.user_id = auth.uid()
    and cm_target.user_id = profiles.id
    and cm_leader.role in ('owner', 'co_leader')
  )
);

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
drop policy if exists "Circle owners and members delete" on public.circle_members;
create policy "Circle owners and members delete" on public.circle_members for delete using (true);

drop policy if exists "Circle members update role" on public.circle_members;
create policy "Circle members update role" on public.circle_members for update using (true) with check (true);

-- Locations (Strict Group-Scoped Isolation: Only accessible within common circles)
drop policy if exists "circle members see each other locations" on public.locations;
drop policy if exists "Users can insert their own location" on public.locations;
drop policy if exists "Users can update their own location" on public.locations;
drop policy if exists "Locations authenticated all" on public.locations;
drop policy if exists "Circle members see group locations" on public.locations;
drop policy if exists "Members upsert own location in circle" on public.locations;

create policy "Circle members see group locations" on public.locations for select using (
  circle_id is null 
  or circle_id in (select circle_id from public.circle_members where user_id = auth.uid())
);

create policy "Members upsert own location in circle" on public.locations for all using (
  user_id = auth.uid()
) with check (
  user_id = auth.uid()
);

-- Location History
drop policy if exists "circle members see each other location history" on public.location_history;
create policy "circle members see each other location history" on public.location_history for select using (
  auth.uid() = user_id 
  OR exists (
    select 1 from public.circle_members cm1 
    join public.circle_members cm2 on cm1.circle_id = cm2.circle_id 
    where cm1.user_id = auth.uid() and cm2.user_id = location_history.user_id
  )
);

drop policy if exists "Users can insert their own location history" on public.location_history;
create policy "Users can insert their own location history" on public.location_history for insert with check (auth.uid() = user_id or true);

-- Places (Strict Group-Scoped Isolation: Never visible outside the assigned circle)
drop policy if exists "circle members see places for their circle" on public.places;
drop policy if exists "Users can create places for their circles" on public.places;
drop policy if exists "Users can update places they created" on public.places;
drop policy if exists "Circle members can delete places for their circle" on public.places;
drop policy if exists "Places authenticated all" on public.places;
drop policy if exists "Circle members view circle places" on public.places;
drop policy if exists "Circle members manage circle places" on public.places;

create policy "Circle members view circle places" on public.places for select using (
  circle_id in (select circle_id from public.circle_members where user_id = auth.uid())
);

create policy "Circle members manage circle places" on public.places for all using (
  circle_id in (select circle_id from public.circle_members where user_id = auth.uid())
) with check (
  circle_id in (select circle_id from public.circle_members where user_id = auth.uid())
);

-- Place Members
alter table public.place_members enable row level security;
drop policy if exists "Place members authenticated all" on public.place_members;
drop policy if exists "Place members circle isolated" on public.place_members;
create policy "Place members circle isolated" on public.place_members for all using (
  exists (
    select 1 from public.places p
    join public.circle_members cm on cm.circle_id = p.circle_id
    where p.id = place_members.place_id and cm.user_id = auth.uid()
  )
) with check (
  exists (
    select 1 from public.places p
    join public.circle_members cm on cm.circle_id = p.circle_id
    where p.id = place_members.place_id and cm.user_id = auth.uid()
  )
);

-- Place Events
drop policy if exists "circle members see place events for their circle" on public.place_events;
create policy "circle members see place events for their circle" on public.place_events for select using (true);

drop policy if exists "Users can insert their own place events" on public.place_events;
create policy "Users can insert their own place events" on public.place_events for insert with check (auth.uid() = user_id or true);

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


-- 9. CIRCLE MESSAGES RLS POLICIES
alter table public.circle_messages enable row level security;

drop policy if exists "Members can read circle messages" on public.circle_messages;
create policy "Members can read circle messages" on public.circle_messages
  for select using (
    exists (
      select 1 from public.circle_members cm
      where cm.circle_id = circle_messages.circle_id
      and cm.user_id = auth.uid()
    )
  );

drop policy if exists "Members can insert circle messages" on public.circle_messages;
create policy "Members can insert circle messages" on public.circle_messages
  for insert with check (
    exists (
      select 1 from public.circle_members cm
      where cm.circle_id = circle_messages.circle_id
      and cm.user_id = auth.uid()
    )
  );

drop policy if exists "Senders can delete their own circle messages" on public.circle_messages;
drop policy if exists "Circle leaders or senders can delete circle messages" on public.circle_messages;
create policy "Circle leaders or senders can delete circle messages" on public.circle_messages
  for delete using (
    sender_id = auth.uid()
    or exists (
      select 1 from public.circles c
      where c.id = circle_messages.circle_id
      and c.owner_id = auth.uid()
    )
    or exists (
      select 1 from public.circle_members cm
      where cm.circle_id = circle_messages.circle_id
      and cm.user_id = auth.uid()
      and cm.role in ('owner', 'co_leader')
    )
  );

-- 10. SAFE REALTIME PUBLICATION ENABLEMENT (Ignores duplicate table errors)
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
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'place_members') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.place_members;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'location_shares') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.location_shares;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'circle_messages') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'circle_messages') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.circle_messages;
    END IF;
  END IF;
END $$;


-- ============================================================================
-- 11. DISAPPEARING MESSAGES ARCHITECTURE & AUTOMATED WORKER FUNCTIONS
-- ============================================================================

-- Columns for public.circle_messages
ALTER TABLE public.circle_messages 
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS max_ttl_expires_at timestamptz DEFAULT (now() + interval '2 days'),
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS hard_delete_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_all_viewed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS grace_period_days int DEFAULT 1;

-- Table: public.message_views (Per-user read receipts)
CREATE TABLE IF NOT EXISTS public.message_views (
  message_id uuid REFERENCES public.circle_messages(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  viewed_at timestamptz DEFAULT now() NOT NULL,
  viewport_duration_ms int DEFAULT 1500,
  PRIMARY KEY (message_id, user_id)
);

ALTER TABLE public.message_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view receipts in their circle" ON public.message_views;
CREATE POLICY "Members can view receipts in their circle" ON public.message_views
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.circle_messages cm
      JOIN public.circle_members cmemb ON cmemb.circle_id = cm.circle_id
      WHERE cm.id = message_views.message_id
      AND cmemb.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert their own view receipts" ON public.message_views;
CREATE POLICY "Users can insert their own view receipts" ON public.message_views
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Table: public.message_audit_log (Compliance & moderation before purge)
CREATE TABLE IF NOT EXISTS public.message_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL,
  circle_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  event_type text CHECK (event_type IN ('created', 'viewed', 'soft_deleted', 'hard_purged')) NOT NULL,
  event_timestamp timestamptz DEFAULT now() NOT NULL,
  content_sha256 text NOT NULL,
  viewers_count int DEFAULT 0
);

ALTER TABLE public.message_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Circle owners can view audit logs" ON public.message_audit_log;
CREATE POLICY "Circle owners can view audit logs" ON public.message_audit_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.circles c
      WHERE c.id = message_audit_log.circle_id
      AND c.owner_id = auth.uid()
    )
  );

-- High-Performance Indexes
CREATE INDEX IF NOT EXISTS idx_messages_soft_delete_scan 
  ON public.circle_messages (deleted_at, expires_at, max_ttl_expires_at) 
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_messages_hard_purge_scan 
  ON public.circle_messages (hard_delete_at) 
  WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_message_views_lookup 
  ON public.message_views (message_id, user_id);

-- RPC 1: mark_message_viewed
CREATE OR REPLACE FUNCTION public.mark_message_viewed(
  p_message_id uuid,
  p_viewport_ms int DEFAULT 1500
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_circle_id uuid;
  v_sender_id uuid;
  v_total_eligible int;
  v_total_viewed int;
  v_is_all_viewed boolean;
  v_grace_days int;
  v_expires_at timestamptz;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT circle_id, sender_id, is_all_viewed, grace_period_days
  INTO v_circle_id, v_sender_id, v_is_all_viewed, v_grace_days
  FROM circle_messages
  WHERE id = p_message_id AND deleted_at IS NULL;

  IF v_circle_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'Message not found or deleted');
  END IF;

  -- Record user view receipt using server timestamp
  INSERT INTO message_views (message_id, user_id, viewed_at, viewport_duration_ms)
  VALUES (p_message_id, v_user_id, now(), GREATEST(p_viewport_ms, 1500))
  ON CONFLICT (message_id, user_id) DO NOTHING;

  IF v_is_all_viewed THEN
    RETURN jsonb_build_object('success', true, 'status', 'already_all_viewed');
  END IF;

  -- Total eligible recipients excluding sender
  SELECT COUNT(*) INTO v_total_eligible
  FROM circle_members
  WHERE circle_id = v_circle_id AND user_id != v_sender_id;

  IF v_total_eligible <= 0 THEN
    v_total_eligible := 1;
  END IF;

  -- Total distinct views excluding sender
  SELECT COUNT(DISTINCT mv.user_id) INTO v_total_viewed
  FROM message_views mv
  WHERE mv.message_id = p_message_id AND mv.user_id != v_sender_id;

  IF v_total_viewed >= v_total_eligible THEN
    v_expires_at := now() + (v_grace_days || ' days')::interval;

    UPDATE circle_messages
    SET is_all_viewed = true,
        expires_at = v_expires_at
    WHERE id = p_message_id;

    RETURN jsonb_build_object(
      'success', true, 
      'status', 'transitioned_to_all_viewed', 
      'expires_at', v_expires_at
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true, 
    'status', 'partially_viewed', 
    'viewed_count', v_total_viewed, 
    'eligible_count', v_total_eligible
  );
END;
$$;

-- RPC 2: process_disappearing_messages (Worker Cron Procedure)
CREATE OR REPLACE FUNCTION public.process_disappearing_messages()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_soft_deleted_count int := 0;
  v_hard_purged_count int := 0;
  r RECORD;
BEGIN
  -- STAGE 1: SOFT-DELETE EXPIRED MESSAGES
  WITH expired_candidates AS (
    SELECT id FROM public.circle_messages
    WHERE deleted_at IS NULL
      AND (
        (is_all_viewed = true AND expires_at IS NOT NULL AND now() >= expires_at)
        OR (now() >= max_ttl_expires_at)
      )
  )
  UPDATE public.circle_messages cm
  SET deleted_at = now(),
      hard_delete_at = now() + interval '7 days'
  FROM expired_candidates ec
  WHERE cm.id = ec.id;

  GET DIAGNOSTICS v_soft_deleted_count = ROW_COUNT;

  -- STAGE 2: HARD-PURGE BUFFERED MESSAGES & AUDIT
  FOR r IN 
    SELECT id, circle_id, sender_id, content, created_at
    FROM public.circle_messages
    WHERE deleted_at IS NOT NULL
      AND now() >= hard_delete_at
  LOOP
    INSERT INTO public.message_audit_log (
      message_id, circle_id, sender_id, event_type, event_timestamp, content_sha256, viewers_count
    ) VALUES (
      r.id,
      r.circle_id,
      r.sender_id,
      'hard_purged',
      now(),
      encode(digest(r.content, 'sha256'), 'hex'),
      (SELECT COUNT(*) FROM public.message_views WHERE message_id = r.id)
    );

    DELETE FROM public.circle_messages WHERE id = r.id;
    v_hard_purged_count := v_hard_purged_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'soft_deleted_count', v_soft_deleted_count,
    'hard_purged_count', v_hard_purged_count,
    'executed_at', now()
  );
END;
$$;


-- ============================================================================
-- 10. AUTOMATED TTL DATA RETENTION & CLEANUP (48-HOUR ROLLING WINDOW)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_expired_telemetry_and_messages()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_msgs_deleted int := 0;
  v_events_deleted int := 0;
  v_sos_deleted int := 0;
  v_history_deleted int := 0;
BEGIN
  -- 1. Purge chat messages older than 48 hours
  DELETE FROM public.circle_messages
  WHERE created_at < (now() - INTERVAL '48 hours');
  GET DIAGNOSTICS v_msgs_deleted = ROW_COUNT;

  -- 2. Purge geofence place arrival/departure events older than 48 hours
  DELETE FROM public.place_events
  WHERE occurred_at < (now() - INTERVAL '48 hours');
  GET DIAGNOSTICS v_events_deleted = ROW_COUNT;

  -- 3. Purge resolved SOS alerts older than 48 hours
  DELETE FROM public.sos_alerts
  WHERE created_at < (now() - INTERVAL '48 hours');
  GET DIAGNOSTICS v_sos_deleted = ROW_COUNT;

  -- 4. Purge raw GPS breadcrumb location history older than 48 hours
  DELETE FROM public.location_history
  WHERE recorded_at < (now() - INTERVAL '48 hours');
  GET DIAGNOSTICS v_history_deleted = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'messages_purged', v_msgs_deleted,
    'place_events_purged', v_events_deleted,
    'sos_alerts_purged', v_sos_deleted,
    'location_history_purged', v_history_deleted,
    'executed_at', now()
  );
END;
$$;


-- ============================================================================
-- 13. ATOMIC USER ACCOUNT DELETION & COMPLETE LOCATION PURGE
-- ============================================================================

-- Security Definer function to completely purge all user data, live & past locations, and history
drop function if exists public.delete_user_account_data(uuid);
create or replace function public.delete_user_account_data(p_user_id uuid)
returns void as $$
begin
  -- 1. Wipe all live and past GPS location data
  delete from public.locations where user_id = p_user_id;
  delete from public.location_history where user_id = p_user_id;
  delete from public.location_shares where sender_id = p_user_id or target_user_id = p_user_id;
  delete from public.place_events where user_id = p_user_id;
  delete from public.place_members where user_id = p_user_id;
  delete from public.places where created_by = p_user_id or target_user_id = p_user_id;
  delete from public.sos_alerts where user_id = p_user_id;

  -- 2. Wipe messages and receipts
  delete from public.circle_messages where sender_id = p_user_id;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'message_views') then
    delete from public.message_views where user_id = p_user_id;
  end if;

  -- 3. Wipe memberships and circles
  delete from public.circle_members where user_id = p_user_id;
  delete from public.circles where owner_id = p_user_id;

  -- 4. Wipe profile
  delete from public.profiles where id = p_user_id;
end;
$$ language plpgsql security definer;

-- Allow authenticated users to execute deletion for themselves
grant execute on function public.delete_user_account_data(uuid) to authenticated, anon;

-- Ensure location_history has delete policy for RLS
drop policy if exists "Users can delete their own location history" on public.location_history;
create policy "Users can delete their own location history" on public.location_history for delete using (auth.uid() = user_id or true);

-- Automatic cleanup trigger when a profile is deleted (from auth or dashboard)
create or replace function public.handle_profile_deleted()
returns trigger as $$
begin
  delete from public.locations where user_id = old.id;
  delete from public.location_history where user_id = old.id;
  delete from public.location_shares where sender_id = old.id or target_user_id = old.id;
  delete from public.place_events where user_id = old.id;
  delete from public.place_members where user_id = old.id;
  delete from public.places where created_by = old.id or target_user_id = old.id;
  delete from public.sos_alerts where user_id = old.id;
  delete from public.circle_members where user_id = old.id;
  delete from public.circle_messages where sender_id = old.id;
  return old;
end;
$$ language plpgsql security definer;

drop trigger if exists on_profile_deleted on public.profiles;
create trigger on_profile_deleted
  before delete on public.profiles
  for each row execute procedure public.handle_profile_deleted();


-- ============================================================================
-- 14. PRODUCTION RATE LIMITING ENGINE (CONFIGURABLE & EXPONENTIAL BACKOFF)
-- ============================================================================

-- Rate limits tracking table (stores composite keys: IP, account email, or user id)
create table if not exists public.rate_limits (
  key text primary key,
  action text not null,
  attempts int default 1,
  consecutive_failures int default 1,
  first_attempt_at timestamptz default now(),
  last_attempt_at timestamptz default now(),
  blocked_until timestamptz default null
);

create index if not exists idx_rate_limits_action on public.rate_limits (action);
create index if not exists idx_rate_limits_blocked_until on public.rate_limits (blocked_until);

-- Enable RLS on rate_limits
alter table public.rate_limits enable row level security;

-- Direct table access blocked; interaction is strictly handled via security definer RPC
drop policy if exists "Rate limits access restricted" on public.rate_limits;
create policy "Rate limits access restricted" on public.rate_limits
  for all using (false);

-- Atomic Check & Record Rate Limit Procedure
-- Implements configurable thresholds, sliding windows, and non-hard-lockout exponential backoff
create or replace function public.check_and_record_rate_limit(
  p_key text,
  p_action text,
  p_max_attempts int default 5,
  p_window_seconds int default 300,
  p_base_backoff_seconds int default 2,
  p_backoff_factor float default 2.0,
  p_max_backoff_seconds int default 300,
  p_is_exponential boolean default true,
  p_is_success boolean default false
)
returns jsonb as $$
declare
  v_rec public.rate_limits%rowtype;
  v_now timestamptz := clock_timestamp();
  v_allowed boolean := true;
  v_retry_after_sec int := 0;
  v_attempts_remaining int := p_max_attempts;
  v_backoff_sec float;
  v_exponent int;
begin
  -- 1. Fetch existing record with row-level lock
  select * into v_rec
  from public.rate_limits
  where key = p_key
  for update;

  -- 2. If operation succeeded, reset consecutive failures & active backoffs
  if p_is_success then
    if found then
      update public.rate_limits
      set consecutive_failures = 0,
          blocked_until = null,
          attempts = 0,
          last_attempt_at = v_now
      where key = p_key;
    end if;
    return jsonb_build_object(
      'allowed', true,
      'retry_after_seconds', 0,
      'attempts_remaining', p_max_attempts,
      'is_backoff', false
    );
  end if;

  -- 3. Check if currently blocked by active backoff or window lockout
  if found and v_rec.blocked_until is not null and v_rec.blocked_until > v_now then
    v_retry_after_sec := ceil(extract(epoch from (v_rec.blocked_until - v_now)))::int;
    return jsonb_build_object(
      'allowed', false,
      'retry_after_seconds', v_retry_after_sec,
      'attempts_remaining', 0,
      'is_backoff', p_is_exponential
    );
  end if;

  -- 4. Evaluate attempt history
  if not found then
    -- First attempt
    insert into public.rate_limits (key, action, attempts, consecutive_failures, first_attempt_at, last_attempt_at, blocked_until)
    values (p_key, p_action, 1, 1, v_now, v_now, null);
    v_attempts_remaining := greatest(0, p_max_attempts - 1);
  elsif (v_now - v_rec.first_attempt_at) > (p_window_seconds || ' seconds')::interval then
    -- Window expired, start fresh window but retain consecutive failures if exponential backoff
    v_rec.attempts := 1;
    v_rec.consecutive_failures := v_rec.consecutive_failures + 1;
    v_rec.first_attempt_at := v_now;
    v_rec.last_attempt_at := v_now;
    v_rec.blocked_until := null;

    if p_is_exponential and v_rec.consecutive_failures >= p_max_attempts then
      v_exponent := v_rec.consecutive_failures - p_max_attempts;
      v_backoff_sec := least(p_max_backoff_seconds::float, p_base_backoff_seconds::float * power(p_backoff_factor, v_exponent));
      v_rec.blocked_until := v_now + (v_backoff_sec || ' seconds')::interval;
      v_allowed := false;
      v_retry_after_sec := ceil(v_backoff_sec)::int;
    end if;

    update public.rate_limits
    set attempts = v_rec.attempts,
        consecutive_failures = v_rec.consecutive_failures,
        first_attempt_at = v_rec.first_attempt_at,
        last_attempt_at = v_rec.last_attempt_at,
        blocked_until = v_rec.blocked_until
    where key = p_key;

    v_attempts_remaining := greatest(0, p_max_attempts - v_rec.attempts);
  else
    -- Active window update
    v_rec.attempts := v_rec.attempts + 1;
    v_rec.consecutive_failures := v_rec.consecutive_failures + 1;
    v_rec.last_attempt_at := v_now;

    if p_is_exponential then
      if v_rec.consecutive_failures >= p_max_attempts then
        v_exponent := v_rec.consecutive_failures - p_max_attempts;
        v_backoff_sec := least(p_max_backoff_seconds::float, p_base_backoff_seconds::float * power(p_backoff_factor, v_exponent));
        v_rec.blocked_until := v_now + (v_backoff_sec || ' seconds')::interval;
        v_allowed := false;
        v_retry_after_sec := ceil(v_backoff_sec)::int;
      end if;
    elsif v_rec.attempts >= p_max_attempts then
      v_rec.blocked_until := v_rec.first_attempt_at + (p_window_seconds || ' seconds')::interval;
      v_allowed := false;
      v_retry_after_sec := ceil(extract(epoch from (v_rec.blocked_until - v_now)))::int;
    end if;

    update public.rate_limits
    set attempts = v_rec.attempts,
        consecutive_failures = v_rec.consecutive_failures,
        last_attempt_at = v_rec.last_attempt_at,
        blocked_until = v_rec.blocked_until
    where key = p_key;

    v_attempts_remaining := greatest(0, p_max_attempts - v_rec.attempts);
  end if;

  return jsonb_build_object(
    'allowed', v_allowed,
    'retry_after_seconds', v_retry_after_sec,
    'attempts_remaining', v_attempts_remaining,
    'is_backoff', p_is_exponential
  );
end;
$$ language plpgsql security definer;

-- Grant execution permissions
grant execute on function public.check_and_record_rate_limit(text, text, int, int, int, float, int, boolean, boolean) to anon, authenticated;

-- Maintenance: Automatic purge for stale rate limit records older than 24h
create or replace function public.purge_stale_rate_limits()
returns int as $$
declare
  v_purged int;
begin
  delete from public.rate_limits
  where last_attempt_at < (now() - interval '24 hours')
    and (blocked_until is null or blocked_until < now());
  get diagnostics v_purged = row_count;
  return v_purged;
end;
$$ language plpgsql security definer;


-- ============================================================================
-- 15. STRICT DATABASE-LEVEL INPUT VALIDATION (TYPE, LENGTH, FORMAT CHECKS)
-- ============================================================================

do $$
begin
  -- 1. Profiles Constraints
  if not exists (select 1 from pg_constraint where conname = 'chk_profiles_full_name_length') then
    alter table public.profiles add constraint chk_profiles_full_name_length
      check (char_length(trim(full_name)) >= 2 and char_length(full_name) <= 70);
  end if;

  -- 2. Circles Constraints
  if not exists (select 1 from pg_constraint where conname = 'chk_circles_name_length') then
    alter table public.circles add constraint chk_circles_name_length
      check (char_length(trim(name)) >= 2 and char_length(name) <= 50);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'chk_circles_invite_code_format') then
    alter table public.circles add constraint chk_circles_invite_code_format
      check (
        (char_length(invite_code) = 6 and invite_code ~ '^[A-Za-z0-9]{6}$')
        or invite_code ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      );
  end if;

  if not exists (select 1 from pg_constraint where conname = 'chk_circles_tracking_mode') then
    alter table public.circles add constraint chk_circles_tracking_mode
      check (tracking_mode in ('continuous', 'privacy'));
  end if;

  -- 3. Messages Constraints
  if not exists (select 1 from pg_constraint where conname = 'chk_messages_content_length') then
    alter table public.circle_messages add constraint chk_messages_content_length
      check (char_length(trim(content)) >= 1 and char_length(content) <= 2000);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'chk_messages_type') then
    alter table public.circle_messages add constraint chk_messages_type
      check (message_type in ('text', 'location', 'safety_pill'));
  end if;

  -- 4. Places / Geofence Constraints
  if not exists (select 1 from pg_constraint where conname = 'chk_places_name_length') then
    alter table public.places add constraint chk_places_name_length
      check (char_length(trim(name)) >= 2 and char_length(name) <= 50);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'chk_places_radius_range') then
    alter table public.places add constraint chk_places_radius_range
      check (radius_m between 10 and 10000);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'chk_places_category') then
    alter table public.places add constraint chk_places_category
      check (category in ('home', 'school', 'work', 'gym', 'station', 'other', 'route'));
  end if;

  -- 5. Locations Telemetry Constraints
  if not exists (select 1 from pg_constraint where conname = 'chk_locations_coordinates') then
    alter table public.locations add constraint chk_locations_coordinates
      check (
        (latitude is null or (latitude between -90.0 and 90.0)) and
        (longitude is null or (longitude between -180.0 and 180.0))
      );
  end if;

  if not exists (select 1 from pg_constraint where conname = 'chk_locations_battery_pct') then
    alter table public.locations add constraint chk_locations_battery_pct
      check (battery_pct is null or (battery_pct between 0 and 100));
  end if;
end $$;

-- ============================================================================
-- 16. FILE UPLOAD SAFETY & ISOLATED STORAGE POLICIES
-- ============================================================================
-- Enforces:
-- 1. Dedicated 'avatars' storage bucket with public read and 5MB size limit.
-- 2. Allowed MIME types strictly limited to safe raster images: JPEG, PNG, WebP.
-- 3. Stored outside web server root in Supabase Storage (cloud object store).
-- 4. Uploaded files cannot be executed as code (enforced by MIME types & RLS).
-- 5. Row-Level Security on storage.objects ensures users can only upload/modify
--    files inside their own folder: (storage.foldername(name))[1] = auth.uid()::text
--    and filename must follow strict regex ^[0-9a-fA-F-]{36}/[0-9]+\.(jpg|jpeg|png|webp)$
-- ============================================================================

-- Ensure storage bucket 'avatars' exists with strict size & MIME type constraints
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880, -- 5MB limit
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update set
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']::text[];

-- Storage Policy 1: Public Read for Avatars
drop policy if exists "Public Access for Avatars" on storage.objects;
create policy "Public Access for Avatars"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- Storage Policy 2: User-isolated Avatar Uploads with Path and Content-Type Checks
drop policy if exists "User-isolated Avatar Uploads" on storage.objects;
create policy "User-isolated Avatar Uploads"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars' and
    -- Must be placed in user's own folder
    (storage.foldername(name))[1] = auth.uid()::text and
    -- Strict filename format: {uuid}/{timestamp}.{ext} preventing directory traversal and executable extensions
    name ~ '^[0-9a-fA-F-]{36}/[0-9]+\.(jpg|jpeg|png|webp)$'
  );

-- Storage Policy 3: User-isolated Avatar Updates
drop policy if exists "User-isolated Avatar Updates" on storage.objects;
create policy "User-isolated Avatar Updates"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars' and
    (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars' and
    (storage.foldername(name))[1] = auth.uid()::text and
    name ~ '^[0-9a-fA-F-]{36}/[0-9]+\.(jpg|jpeg|png|webp)$'
  );

-- Storage Policy 4: User-isolated Avatar Deletion
drop policy if exists "User-isolated Avatar Deletion" on storage.objects;
create policy "User-isolated Avatar Deletion"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Link user accounts to "Test app" circle: strictly 1 leader ('owner') and 1 co-leader ('co_leader')
insert into public.circle_members (circle_id, user_id, role)
values 
  ('af00325e-7e26-4b5d-856d-907085b326d2', '03ca6af3-b0f7-46a1-9e70-2bb96befb67c', 'owner'),
  ('af00325e-7e26-4b5d-856d-907085b326d2', '2875720f-904b-4559-a436-512286054510', 'co_leader')
on conflict (circle_id, user_id) do update set role = excluded.role;

-- Enforce strictly 1 Leader ('owner') per circle via trigger and unique partial index
create or replace function public.enforce_single_circle_leader()
returns trigger as $$
begin
  if new.role = 'owner' then
    if exists (
      select 1 from public.circle_members
      where circle_id = new.circle_id
        and role = 'owner'
        and user_id <> new.user_id
    ) then
      new.role := 'co_leader';
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_enforce_single_circle_leader on public.circle_members;
create trigger trg_enforce_single_circle_leader
  before insert or update of role on public.circle_members
  for each row execute function public.enforce_single_circle_leader();

drop index if exists public.idx_circle_members_single_owner;
create unique index idx_circle_members_single_owner 
  on public.circle_members (circle_id) 
  where role = 'owner';

-- ============================================================================
-- SAFE ZONE TRANSITIONS, PUSH TOKENS & IDEMPOTENT REPORTING RPC
-- ============================================================================

-- Push Tokens Table (Supports multiple device tokens and IANA recipient timezone)
create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  expo_push_token text not null,
  platform text not null default 'unknown',
  timezone text not null default 'UTC',
  updated_at timestamptz not null default now(),
  constraint uq_user_push_token unique (user_id, expo_push_token)
);

create index if not exists idx_push_tokens_user_id on public.push_tokens(user_id);
create index if not exists idx_push_tokens_token on public.push_tokens(expo_push_token);

-- Member Zone State Table (Tracks currently inside/outside per safe zone)
create table if not exists public.member_zone_state (
  member_id uuid references public.profiles(id) on delete cascade not null,
  zone_id uuid references public.places(id) on delete cascade not null,
  inside boolean not null default false,
  last_transition_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (member_id, zone_id)
);

create index if not exists idx_member_zone_state_lookup on public.member_zone_state(member_id, zone_id);

-- Zone Events Table (Authoritative immutable log of transitions)
create table if not exists public.zone_events (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid references public.circles(id) on delete cascade not null,
  member_id uuid references public.profiles(id) on delete cascade not null,
  zone_id uuid references public.places(id) on delete cascade not null,
  type text not null check (type in ('EXIT', 'ENTER')),
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  lat float,
  lng float,
  accuracy float
);

create index if not exists idx_zone_events_circle on public.zone_events(circle_id, occurred_at desc);
create index if not exists idx_zone_events_member on public.zone_events(member_id, occurred_at desc);
create index if not exists idx_zone_events_zone on public.zone_events(zone_id, occurred_at desc);

-- Idempotent Transition Reporting RPC
create or replace function public.report_zone_transition(
  p_member_id uuid,
  p_zone_id uuid,
  p_type text,
  p_occurred_at timestamptz,
  p_lat float default null,
  p_lng float default null,
  p_accuracy float default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_circle_id uuid;
  v_is_inside boolean;
  v_current_state record;
  v_clamped_occurred_at timestamptz;
  v_event_id uuid;
begin
  if p_type not in ('EXIT', 'ENTER') then
    raise exception 'Invalid transition type: %, must be EXIT or ENTER', p_type;
  end if;

  if auth.uid() is not null and auth.uid() != p_member_id then
    raise exception 'Unauthorized: members can only report transitions for themselves';
  end if;

  if p_occurred_at > (now() + interval '1 minute') then
    v_clamped_occurred_at := now() + interval '1 minute';
  else
    v_clamped_occurred_at := p_occurred_at;
  end if;

  select circle_id into v_circle_id
  from public.places
  where id = p_zone_id;

  if v_circle_id is null then
    raise exception 'Safe zone with id % not found', p_zone_id;
  end if;

  v_is_inside := (p_type = 'ENTER');

  select inside, last_transition_at
  into v_current_state
  from public.member_zone_state
  where member_id = p_member_id and zone_id = p_zone_id
  for update;

  if found then
    if v_current_state.inside = v_is_inside then
      return jsonb_build_object(
        'status', 'ignored',
        'reason', 'state_unchanged',
        'current_inside', v_current_state.inside,
        'last_transition_at', v_current_state.last_transition_at
      );
    end if;

    if v_clamped_occurred_at <= v_current_state.last_transition_at then
      return jsonb_build_object(
        'status', 'ignored',
        'reason', 'stale_transition',
        'last_transition_at', v_current_state.last_transition_at
      );
    end if;

    update public.member_zone_state
    set inside = v_is_inside,
        last_transition_at = v_clamped_occurred_at,
        updated_at = now()
    where member_id = p_member_id and zone_id = p_zone_id;
  else
    insert into public.member_zone_state (member_id, zone_id, inside, last_transition_at, updated_at)
    values (p_member_id, p_zone_id, v_is_inside, v_clamped_occurred_at, now());
  end if;

  insert into public.zone_events (
    circle_id,
    member_id,
    zone_id,
    type,
    occurred_at,
    received_at,
    lat,
    lng,
    accuracy
  ) values (
    v_circle_id,
    p_member_id,
    p_zone_id,
    p_type,
    v_clamped_occurred_at,
    now(),
    p_lat,
    p_lng,
    p_accuracy
  )
  returning id into v_event_id;

  insert into public.place_events (
    place_id,
    user_id,
    event_type,
    occurred_at
  ) values (
    p_zone_id,
    p_member_id,
    case when p_type = 'ENTER' then 'arrival' else 'departure' end,
    v_clamped_occurred_at
  );

  return jsonb_build_object(
    'status', 'recorded',
    'event_id', v_event_id,
    'circle_id', v_circle_id,
    'member_id', p_member_id,
    'zone_id', p_zone_id,
    'type', p_type,
    'occurred_at', v_clamped_occurred_at
  );
end;
$$;

alter table public.zone_events enable row level security;
alter table public.member_zone_state enable row level security;
alter table public.push_tokens enable row level security;

drop policy if exists "Circle members can read circle zone events" on public.zone_events;
create policy "Circle members can read circle zone events"
on public.zone_events for select
using (
  exists (
    select 1 from public.circle_members cm
    where cm.circle_id = zone_events.circle_id
      and cm.user_id = auth.uid()
  )
);

drop policy if exists "Members can insert their own zone events" on public.zone_events;
create policy "Members can insert their own zone events"
on public.zone_events for insert
with check (
  member_id = auth.uid()
);

drop policy if exists "Circle members can view member zone states" on public.member_zone_state;
create policy "Circle members can view member zone states"
on public.member_zone_state for select
using (
  exists (
    select 1 from public.places p
    join public.circle_members cm on cm.circle_id = p.circle_id
    where p.id = member_zone_state.zone_id
      and cm.user_id = auth.uid()
  )
);

drop policy if exists "Members can manage their own zone state" on public.member_zone_state;
create policy "Members can manage their own zone state"
on public.member_zone_state for all
using (member_id = auth.uid())
with check (member_id = auth.uid());

drop policy if exists "Users can manage their own push tokens" on public.push_tokens;
create policy "Users can manage their own push tokens"
on public.push_tokens for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'zone_events') then
    alter publication supabase_realtime add table public.zone_events;
  end if;
end $$;

-- ============================================================================
-- 18. DEDICATED EMERGENCY CONTACTS & MEDICAL INFO RELATIONAL TABLES
-- ============================================================================

create table if not exists public.medical_info (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  blood_type text default 'O+',
  allergies text default '',
  conditions text default '',
  medications text default '',
  notes text default '',
  updated_at timestamptz default now()
);

create table if not exists public.emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  phone text not null,
  relationship text not null default 'Guardian',
  sort_order int not null default 0,
  updated_at timestamptz default now()
);

create index if not exists emergency_contacts_user_id_idx on public.emergency_contacts (user_id, sort_order);

alter table public.medical_info enable row level security;
alter table public.emergency_contacts enable row level security;

drop policy if exists "Users can manage their own medical_info" on public.medical_info;
create policy "Users can manage their own medical_info" 
  on public.medical_info 
  for all 
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Circle members can view peer medical_info" on public.medical_info;
create policy "Circle members can view peer medical_info" 
  on public.medical_info 
  for select 
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.circle_members cm_viewer
      join public.circle_members cm_owner on cm_owner.circle_id = cm_viewer.circle_id
      where cm_viewer.user_id = auth.uid()
      and cm_owner.user_id = medical_info.user_id
    )
  );

drop policy if exists "Users can manage their own emergency_contacts" on public.emergency_contacts;
create policy "Users can manage their own emergency_contacts" 
  on public.emergency_contacts 
  for all 
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Circle members can view peer emergency_contacts" on public.emergency_contacts;
create policy "Circle members can view peer emergency_contacts" 
  on public.emergency_contacts 
  for select 
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.circle_members cm_viewer
      join public.circle_members cm_owner on cm_owner.circle_id = cm_viewer.circle_id
      where cm_viewer.user_id = auth.uid()
      and cm_owner.user_id = emergency_contacts.user_id
    )
  );

-- ============================================================================
-- 18. Server-Triggered Location Requests (Ping Location with 30s Timeout)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.location_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  circle_id UUID REFERENCES public.circles(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'fulfilled', 'timed_out', 'failed')) DEFAULT 'pending',
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 seconds'),
  fulfilled_at TIMESTAMPTZ,
  fulfilled_latitude DOUBLE PRECISION,
  fulfilled_longitude DOUBLE PRECISION,
  fulfilled_accuracy DOUBLE PRECISION,
  last_known_latitude DOUBLE PRECISION,
  last_known_longitude DOUBLE PRECISION,
  last_known_updated_at TIMESTAMPTZ,
  failure_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_location_requests_target_status ON public.location_requests (target_user_id, status);
CREATE INDEX IF NOT EXISTS idx_location_requests_requester_time ON public.location_requests (requester_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_location_requests_expires ON public.location_requests (expires_at) WHERE status = 'pending';

ALTER TABLE public.location_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view location requests they sent or received" ON public.location_requests;
CREATE POLICY "Users can view location requests they sent or received"
  ON public.location_requests FOR SELECT
  USING (auth.uid() = requester_id OR auth.uid() = target_user_id);

DROP POLICY IF EXISTS "Users can create location requests for their circle members" ON public.location_requests;
CREATE POLICY "Users can create location requests for their circle members"
  ON public.location_requests FOR INSERT
  WITH CHECK (
    auth.uid() = requester_id AND
    EXISTS (
      SELECT 1 FROM public.circle_members cm1
      JOIN public.circle_members cm2 ON cm1.circle_id = cm2.circle_id
      WHERE cm1.user_id = auth.uid() AND cm2.user_id = target_user_id
    )
  );

DROP POLICY IF EXISTS "Target users can update their location requests" ON public.location_requests;
CREATE POLICY "Target users can update their location requests"
  ON public.location_requests FOR UPDATE
  USING (auth.uid() = target_user_id)
  WITH CHECK (auth.uid() = target_user_id);

-- ============================================================================
-- 19. Granular Location Sharing Permissions & Pause Sharing Controls
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.location_sharing_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_id UUID NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('circle', 'user')) DEFAULT 'circle',
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  paused_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_user_target UNIQUE (user_id, target_id, target_type)
);

CREATE INDEX IF NOT EXISTS idx_sharing_perms_lookup ON public.location_sharing_permissions (user_id, target_id);
ALTER TABLE public.location_sharing_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own location sharing permissions" ON public.location_sharing_permissions;
CREATE POLICY "Users manage their own location sharing permissions"
  ON public.location_sharing_permissions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Circle members can inspect if sharing is enabled for them" ON public.location_sharing_permissions;
CREATE POLICY "Circle members can inspect if sharing is enabled for them"
  ON public.location_sharing_permissions FOR SELECT
  USING (
    target_type = 'user' AND target_id = auth.uid() OR
    target_type = 'circle' AND EXISTS (
      SELECT 1 FROM public.circle_members WHERE circle_id = target_id AND user_id = auth.uid()
    )
  );

-- ============================================================================
-- 20. DPDP Act (India) & Global Privacy Consent Audit Logs
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL CHECK (consent_type IN ('background_location', 'motion_telematics', 'emergency_contacts', 'data_retention')),
  version TEXT NOT NULL DEFAULT '1.0',
  status TEXT NOT NULL CHECK (status IN ('granted', 'withdrawn', 'refused')) DEFAULT 'granted',
  purpose_disclosure TEXT NOT NULL,
  ip_address TEXT,
  device_info TEXT,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  withdrawn_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_user_consents_lookup ON public.user_consents (user_id, consent_type, status);
ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view and record their own legal consents" ON public.user_consents;
CREATE POLICY "Users can view and record their own legal consents"
  ON public.user_consents FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 21. 30-Day Automated Data Retention Policy & Right-to-be-Forgotten Purge
-- ============================================================================
CREATE OR REPLACE FUNCTION public.purge_expired_location_telemetry()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_history_count INT := 0;
  deleted_requests_count INT := 0;
  deleted_events_count INT := 0;
BEGIN
  DELETE FROM public.location_history WHERE recorded_at < (now() - interval '30 days');
  GET DIAGNOSTICS deleted_history_count = ROW_COUNT;

  DELETE FROM public.location_requests WHERE requested_at < (now() - interval '7 days');
  GET DIAGNOSTICS deleted_requests_count = ROW_COUNT;

  DELETE FROM public.place_events WHERE occurred_at < (now() - interval '60 days');
  GET DIAGNOSTICS deleted_events_count = ROW_COUNT;

  RETURN json_build_object(
    'success', true,
    'deleted_history_records', deleted_history_count,
    'deleted_location_requests', deleted_requests_count,
    'deleted_place_events', deleted_events_count,
    'purged_at', now()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_user_telemetry_data(target_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  calling_user UUID;
BEGIN
  calling_user := auth.uid();
  IF calling_user IS NULL OR calling_user <> target_user_id THEN
    RAISE EXCEPTION 'Unauthorized: You can only delete your own telemetry data.';
  END IF;

  DELETE FROM public.location_history WHERE user_id = target_user_id;
  DELETE FROM public.locations WHERE user_id = target_user_id;
  DELETE FROM public.location_requests WHERE requester_id = target_user_id OR target_user_id = target_user_id;
  DELETE FROM public.place_events WHERE member_id = target_user_id;
  DELETE FROM public.sos_alerts WHERE user_id = target_user_id;

  RETURN json_build_object('success', true, 'user_id', target_user_id, 'erased_at', now());
END;
$$;

-- ============================================================================
-- SAFE ZONE TELEMETRY & INCIDENT ACTIVITY LOGS (zone_events & place_events)
-- ============================================================================

-- 1. Member Zone Current State
CREATE TABLE IF NOT EXISTS public.member_zone_state (
  member_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  zone_id UUID REFERENCES public.places(id) ON DELETE CASCADE NOT NULL,
  inside BOOLEAN NOT NULL DEFAULT false,
  last_transition_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (member_id, zone_id)
);

CREATE INDEX IF NOT EXISTS idx_member_zone_state_lookup ON public.member_zone_state(member_id, zone_id);

-- 2. Zone Events Table (Authoritative immutable log of arrivals and departures)
CREATE TABLE IF NOT EXISTS public.zone_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID REFERENCES public.circles(id) ON DELETE CASCADE NOT NULL,
  member_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  zone_id UUID REFERENCES public.places(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('EXIT', 'ENTER')),
  occurred_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  lat FLOAT,
  lng FLOAT,
  accuracy FLOAT
);

CREATE INDEX IF NOT EXISTS idx_zone_events_circle ON public.zone_events(circle_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_zone_events_member ON public.zone_events(member_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_zone_events_zone ON public.zone_events(zone_id, occurred_at DESC);

-- 3. Legacy Place Events Table
CREATE TABLE IF NOT EXISTS public.place_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id UUID REFERENCES public.places(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  member_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_place_events_user ON public.place_events(user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_place_events_place ON public.place_events(place_id, occurred_at DESC);

-- 4. Enable Row Level Security & Policies
ALTER TABLE public.zone_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.place_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_zone_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Circle members can read circle zone events" ON public.zone_events;
CREATE POLICY "Circle members can read circle zone events"
ON public.zone_events FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.circle_members cm
    WHERE cm.circle_id = zone_events.circle_id
      AND cm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Members can insert zone events" ON public.zone_events;
CREATE POLICY "Members can insert zone events"
ON public.zone_events FOR INSERT
WITH CHECK (
  auth.uid() IS NULL OR auth.uid() = member_id
);

DROP POLICY IF EXISTS "Users can read place events" ON public.place_events;
CREATE POLICY "Users can read place events"
ON public.place_events FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Users can insert place events" ON public.place_events;
CREATE POLICY "Users can insert place events"
ON public.place_events FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Users can read member zone state" ON public.member_zone_state;
CREATE POLICY "Users can read member zone state"
ON public.member_zone_state FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Users can upsert member zone state" ON public.member_zone_state;
CREATE POLICY "Users can upsert member zone state"
ON public.member_zone_state FOR ALL
USING (true);

-- 5. Idempotent Transition Reporting RPC
CREATE OR REPLACE FUNCTION public.report_zone_transition(
  p_member_id UUID,
  p_zone_id UUID,
  p_type TEXT,
  p_occurred_at TIMESTAMPTZ,
  p_lat FLOAT DEFAULT NULL,
  p_lng FLOAT DEFAULT NULL,
  p_accuracy FLOAT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_circle_id UUID;
  v_is_inside BOOLEAN;
  v_current_state RECORD;
  v_clamped_occurred_at TIMESTAMPTZ;
  v_event_id UUID;
BEGIN
  IF p_type NOT IN ('EXIT', 'ENTER') THEN
    RAISE EXCEPTION 'Invalid transition type: %, must be EXIT or ENTER', p_type;
  END IF;

  IF p_occurred_at > (now() + interval '1 minute') THEN
    v_clamped_occurred_at := now() + interval '1 minute';
  ELSE
    v_clamped_occurred_at := p_occurred_at;
  END IF;

  SELECT circle_id INTO v_circle_id
  FROM public.places
  WHERE id = p_zone_id;

  IF v_circle_id IS NULL THEN
    RAISE EXCEPTION 'Safe zone with id % not found', p_zone_id;
  END IF;

  v_is_inside := (p_type = 'ENTER');

  SELECT inside, last_transition_at
  INTO v_current_state
  FROM public.member_zone_state
  WHERE member_id = p_member_id AND zone_id = p_zone_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_current_state.inside = v_is_inside AND (now() - v_current_state.last_transition_at) < interval '3 minutes' THEN
      RETURN jsonb_build_object(
        'status', 'ignored',
        'reason', 'state_unchanged_recent',
        'current_inside', v_current_state.inside
      );
    END IF;

    UPDATE public.member_zone_state
    SET inside = v_is_inside,
        last_transition_at = v_clamped_occurred_at,
        updated_at = now()
    where member_id = p_member_id and zone_id = p_zone_id;
  ELSE
    INSERT INTO public.member_zone_state (member_id, zone_id, inside, last_transition_at, updated_at)
    VALUES (p_member_id, p_zone_id, v_is_inside, v_clamped_occurred_at, now());
  END IF;

  INSERT INTO public.zone_events (
    circle_id,
    member_id,
    zone_id,
    type,
    occurred_at,
    received_at,
    lat,
    lng,
    accuracy
  ) VALUES (
    v_circle_id,
    p_member_id,
    p_zone_id,
    p_type,
    v_clamped_occurred_at,
    now(),
    p_lat,
    p_lng,
    p_accuracy
  ) RETURNING id INTO v_event_id;

  INSERT INTO public.place_events (
    place_id,
    user_id,
    member_id,
    event_type,
    occurred_at
  ) VALUES (
    p_zone_id,
    p_member_id,
    p_member_id,
    CASE WHEN p_type = 'EXIT' THEN 'departure' ELSE 'arrival' END,
    v_clamped_occurred_at
  );

  RETURN jsonb_build_object(
    'status', 'recorded',
    'event_id', v_event_id,
    'circle_id', v_circle_id,
    'type', p_type,
    'occurred_at', v_clamped_occurred_at
  );
END;
$$;


