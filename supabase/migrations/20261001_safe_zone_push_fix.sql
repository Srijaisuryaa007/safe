-- ============================================================================
-- CIRCLEGUARD MIGRATION: SAFE ZONE TRANSITION & PUSH NOTIFICATIONS FIX
-- ============================================================================

-- 1. Push Tokens Table
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

-- 2. Member Zone State Table (Tracks currently inside/outside per safe zone)
create table if not exists public.member_zone_state (
  member_id uuid references public.profiles(id) on delete cascade not null,
  zone_id uuid references public.places(id) on delete cascade not null,
  inside boolean not null default false,
  last_transition_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (member_id, zone_id)
);

create index if not exists idx_member_zone_state_lookup on public.member_zone_state(member_id, zone_id);

-- 3. Zone Events Table (Authoritative immutable log of transitions)
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

-- 4. Idempotent Transition Reporting RPC
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
  -- Validate transition type
  if p_type not in ('EXIT', 'ENTER') then
    raise exception 'Invalid transition type: %, must be EXIT or ENTER', p_type;
  end if;

  -- Validate caller authorization (member can only report for themselves if authenticated)
  if auth.uid() is not null and auth.uid() != p_member_id then
    raise exception 'Unauthorized: members can only report transitions for themselves';
  end if;

  -- Clamp occurred_at to at most now() + 1 minute (prevent clock-skew future leaks)
  -- Never overwrite it with now()
  if p_occurred_at > (now() + interval '1 minute') then
    v_clamped_occurred_at := now() + interval '1 minute';
  else
    v_clamped_occurred_at := p_occurred_at;
  end if;

  -- Resolve circle_id from safe zone place
  select circle_id into v_circle_id
  from public.places
  where id = p_zone_id;

  if v_circle_id is null then
    raise exception 'Safe zone with id % not found', p_zone_id;
  end if;

  v_is_inside := (p_type = 'ENTER');

  -- Fetch existing state for member and zone with row lock
  select inside, last_transition_at
  into v_current_state
  from public.member_zone_state
  where member_id = p_member_id and zone_id = p_zone_id
  for update;

  -- Idempotency check:
  if found then
    -- If state has not changed (e.g. duplicate from location task and geofence task), ignore
    if v_current_state.inside = v_is_inside then
      return jsonb_build_object(
        'status', 'ignored',
        'reason', 'state_unchanged',
        'current_inside', v_current_state.inside,
        'last_transition_at', v_current_state.last_transition_at
      );
    end if;

    -- If out of order or older than last known transition, ignore
    if v_clamped_occurred_at <= v_current_state.last_transition_at then
      return jsonb_build_object(
        'status', 'ignored',
        'reason', 'stale_transition',
        'last_transition_at', v_current_state.last_transition_at
      );
    end if;

    -- State has genuinely transitioned to new state: update state
    update public.member_zone_state
    set inside = v_is_inside,
        last_transition_at = v_clamped_occurred_at,
        updated_at = now()
    where member_id = p_member_id and zone_id = p_zone_id;
  else
    -- Insert initial state
    insert into public.member_zone_state (member_id, zone_id, inside, last_transition_at, updated_at)
    values (p_member_id, p_zone_id, v_is_inside, v_clamped_occurred_at, now());
  end if;

  -- Insert authoritative zone event
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

  -- Backward-compatibility mirror to place_events
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

-- 5. Row Level Security Policies
alter table public.zone_events enable row level security;
alter table public.member_zone_state enable row level security;
alter table public.push_tokens enable row level security;

-- Zone Events Policies
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

-- Member Zone State Policies
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

-- Push Tokens Policies
drop policy if exists "Users can manage their own push tokens" on public.push_tokens;
create policy "Users can manage their own push tokens"
on public.push_tokens for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Enable Realtime for zone_events
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'zone_events') then
    alter publication supabase_realtime add table public.zone_events;
  end if;
end $$;

-- 6. Trigger to automatically invoke Edge Function on zone_events INSERT (via pg_net if enabled)
create or replace function public.notify_zone_event_push()
returns trigger
language plpgsql
security definer
as $$
begin
  begin
    perform
      net.http_post(
        url := 'https://phgizfyyywwjieruytsy.supabase.co/functions/v1/zone-push-webhook',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBoZ2l6Znl5eXd3amllcnV5dHN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4NzI0OTgsImV4cCI6MjEwMDQ0ODQ5OH0.2wPN8HhSyfab5FxvNEoMmG4hF0152fLX2CZnL3gvGsQ'
        ),
        body := jsonb_build_object(
          'type', 'INSERT',
          'table', 'zone_events',
          'record', row_to_json(new)
        )
      );
  exception
    when others then
      -- If pg_net is not installed or enabled in the project, database webhook handles dispatch
      null;
  end;
  return new;
end;
$$;

drop trigger if exists trg_zone_events_push on public.zone_events;
create trigger trg_zone_events_push
after insert on public.zone_events
for each row
execute function public.notify_zone_event_push();

