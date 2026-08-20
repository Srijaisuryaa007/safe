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

-- Live Locations (Latest position per user)
create table if not exists public.locations (
  user_id uuid references public.profiles(id) on delete cascade primary key,
  latitude float,
  longitude float,
  geom geography(Point, 4326),
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
  speed_mps float default 0,
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
alter table public.places add column if not exists speed_adaptive boolean default false;
alter table public.places add column if not exists active_hours_start text;
alter table public.places add column if not exists active_hours_end text;
alter table public.places add column if not exists active_days text[];

alter table public.profiles add column if not exists push_token text;
alter table public.profiles add column if not exists is_ghost_mode boolean default false;
alter table public.profiles add column if not exists hide_online_presence boolean default false;
alter table public.profiles add column if not exists is_premium boolean default false;

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

alter table public.locations add column if not exists latitude float;
alter table public.locations add column if not exists longitude float;
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

-- Place Members
alter table public.place_members enable row level security;
drop policy if exists "Place members authenticated all" on public.place_members;
create policy "Place members authenticated all" on public.place_members for all using (true) with check (true);

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
