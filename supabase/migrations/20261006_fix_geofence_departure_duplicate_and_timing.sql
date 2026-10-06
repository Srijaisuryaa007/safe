-- ============================================================================
-- FIX GEOFENCE DEPARTURE DUPLICATES & TIMING ACCURACY
-- ============================================================================

-- 1. Update report_zone_transition RPC with strict state alternation
-- An EXIT event can ONLY occur if the user was inside.
-- An ENTER event can ONLY occur if the user was outside.
-- If the state is unchanged, reject the event unconditionally (no 3-minute bypass).
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
    -- STRICT STATE ALTERNATION:
    -- If user is already outside and report is EXIT -> IGNORE unconditionally!
    -- If user is already inside and report is ENTER -> IGNORE unconditionally!
    IF v_current_state.inside = v_is_inside THEN
      RETURN jsonb_build_object(
        'status', 'ignored',
        'reason', 'state_unchanged',
        'current_inside', v_current_state.inside
      );
    END IF;

    -- Anti-flapping: minimum 45s between opposite state changes
    IF (now() - v_current_state.last_transition_at) < interval '45 seconds' THEN
      RETURN jsonb_build_object(
        'status', 'ignored',
        'reason', 'transition_too_rapid',
        'current_inside', v_current_state.inside
      );
    END IF;

    UPDATE public.member_zone_state
    SET inside = v_is_inside,
        last_transition_at = v_clamped_occurred_at,
        updated_at = now()
    WHERE member_id = p_member_id AND zone_id = p_zone_id;
  ELSE
    INSERT INTO public.member_zone_state (member_id, zone_id, inside, last_transition_at, updated_at)
    VALUES (p_member_id, p_zone_id, v_is_inside, v_clamped_occurred_at, now());
  END IF;

  -- Insert authoritative zone event
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

  -- Insert backwards-compatible place event
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

-- 2. Cleanup redundant duplicate exit events created on repeated app-opens
-- Delete redundant zone_events where the previous event for the same member & zone was the same type
WITH ordered_events AS (
  SELECT 
    id,
    member_id,
    zone_id,
    type,
    occurred_at,
    LAG(type) OVER (PARTITION BY member_id, zone_id ORDER BY occurred_at ASC) AS prev_type
  FROM public.zone_events
)
DELETE FROM public.zone_events
WHERE id IN (
  SELECT id FROM ordered_events WHERE type = prev_type
);

-- Similarly clean duplicate place_events
WITH ordered_pe AS (
  SELECT 
    id,
    user_id,
    place_id,
    event_type,
    occurred_at,
    LAG(event_type) OVER (PARTITION BY user_id, place_id ORDER BY occurred_at ASC) AS prev_type
  FROM public.place_events
)
DELETE FROM public.place_events
WHERE id IN (
  SELECT id FROM ordered_pe WHERE event_type = prev_type
);
