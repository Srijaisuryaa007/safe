-- Migration: 20261005_location_requests_and_compliance.sql
-- Description: Server-triggered location requests (Ping), Granular Sharing, DPDP Consent Tracking, & 30-Day Auto Retention

-- ============================================================================
-- 1. Server-Triggered Location Requests (Ping Location with 30s Timeout)
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

-- Indexes for lightning-fast real-time lookup and polling
CREATE INDEX IF NOT EXISTS idx_location_requests_target_status 
  ON public.location_requests (target_user_id, status);

CREATE INDEX IF NOT EXISTS idx_location_requests_requester_time 
  ON public.location_requests (requester_id, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_location_requests_expires 
  ON public.location_requests (expires_at) WHERE status = 'pending';

-- Enable Row Level Security (RLS)
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
-- 2. Granular Location Sharing Permissions & Pause Sharing Controls
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.location_sharing_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_id UUID NOT NULL, -- Circle ID or User ID
  target_type TEXT NOT NULL CHECK (target_type IN ('circle', 'user')) DEFAULT 'circle',
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  paused_until TIMESTAMPTZ, -- If set in future, sharing is paused until this time
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_user_target UNIQUE (user_id, target_id, target_type)
);

CREATE INDEX IF NOT EXISTS idx_sharing_perms_lookup 
  ON public.location_sharing_permissions (user_id, target_id);

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
-- 3. DPDP Act (India) & Global Privacy Consent Audit Logs
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

CREATE INDEX IF NOT EXISTS idx_user_consents_lookup 
  ON public.user_consents (user_id, consent_type, status);

ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view and record their own legal consents" ON public.user_consents;
CREATE POLICY "Users can view and record their own legal consents"
  ON public.user_consents FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ============================================================================
-- 4. 30-Day Automated Data Retention Policy & Right-to-be-Forgotten Purge
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
  -- 1. Auto-delete location_history older than 30 days
  DELETE FROM public.location_history
  WHERE recorded_at < (now() - interval '30 days');
  GET DIAGNOSTICS deleted_history_count = ROW_COUNT;

  -- 2. Auto-delete expired location ping requests older than 7 days
  DELETE FROM public.location_requests
  WHERE requested_at < (now() - interval '7 days');
  GET DIAGNOSTICS deleted_requests_count = ROW_COUNT;

  -- 3. Auto-delete transient place events older than 60 days
  DELETE FROM public.place_events
  WHERE occurred_at < (now() - interval '60 days');
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

-- Complete "Delete My Data" (Right to be Forgotten) RPC
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
-- 5. Silent Devices Inactivity Watchdog Helper View
-- ============================================================================
CREATE OR REPLACE VIEW public.inactive_circle_members AS
SELECT 
  cm.circle_id,
  cm.user_id,
  p.full_name,
  p.phone,
  p.push_token,
  l.latitude AS last_latitude,
  l.longitude AS last_longitude,
  l.updated_at AS last_seen_at,
  EXTRACT(EPOCH FROM (now() - l.updated_at)) / 3600 AS hours_silent
FROM public.circle_members cm
JOIN public.profiles p ON cm.user_id = p.id
JOIN public.locations l ON cm.user_id = l.user_id
WHERE 
  p.is_ghost_mode IS NOT TRUE AND
  p.hide_online_presence IS NOT TRUE AND
  l.updated_at < (now() - interval '12 hours');
