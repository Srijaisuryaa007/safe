-- ============================================================================
-- SAFE ZONE INCIDENT & ACTIVITY TAB FIX
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

-- 5. Enable Realtime Publications
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'zone_events') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.zone_events;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'place_events') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.place_events;
  END IF;
END $$;

-- 6. Idempotent Transition Reporting RPC
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
