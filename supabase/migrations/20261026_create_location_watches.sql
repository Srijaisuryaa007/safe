-- ==============================================================================
-- MIGRATION: One-Tap Location Watches ("Notify Me When...")
-- Ad-hoc arrival/departure notifications for circle members
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.location_watches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID REFERENCES public.circles(id) ON DELETE CASCADE NOT NULL,
  creator_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  target_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  watch_type TEXT CHECK (watch_type IN ('leaves_current', 'arrives_place', 'leaves_place')) NOT NULL,
  place_id UUID REFERENCES public.places(id) ON DELETE CASCADE,
  place_name TEXT,
  current_lat DOUBLE PRECISION,
  current_lng DOUBLE PRECISION,
  radius_meters DOUBLE PRECISION DEFAULT 150,
  is_recurring BOOLEAN DEFAULT false,
  status TEXT CHECK (status IN ('active', 'triggered', 'cancelled')) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  triggered_at TIMESTAMPTZ
);

-- Indices for fast real-time query
CREATE INDEX IF NOT EXISTS idx_location_watches_active 
  ON public.location_watches (circle_id, target_user_id, status);

CREATE INDEX IF NOT EXISTS idx_location_watches_creator 
  ON public.location_watches (creator_id, status);

-- Enable Row Level Security
ALTER TABLE public.location_watches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Circle members can view location watches" ON public.location_watches;
CREATE POLICY "Circle members can view location watches" ON public.location_watches
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can create location watches" ON public.location_watches;
CREATE POLICY "Users can create location watches" ON public.location_watches
  FOR INSERT WITH CHECK (auth.uid() = creator_id);

DROP POLICY IF EXISTS "Users can update location watches" ON public.location_watches;
CREATE POLICY "Users can update location watches" ON public.location_watches
  FOR UPDATE USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can delete location watches" ON public.location_watches;
CREATE POLICY "Users can delete location watches" ON public.location_watches
  FOR DELETE USING (auth.uid() = creator_id);

-- Realtime Publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'location_watches'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.location_watches;
  END IF;
END $$;
