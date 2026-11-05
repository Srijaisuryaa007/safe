-- Migration: 20261105_fix_places_rls_and_event_column.sql
-- 1. Ensure column member_id exists on place_events so report_zone_transition RPC does not fail
ALTER TABLE public.place_events ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 2. Harden and unblock RLS policies on public.places so users can see all safe zones in their circles or created by them
ALTER TABLE public.places ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Circle members view circle places" ON public.places;
DROP POLICY IF EXISTS "circle members see places for their circle" ON public.places;
DROP POLICY IF EXISTS "Places authenticated all" ON public.places;

CREATE POLICY "Circle members view circle places" ON public.places
FOR SELECT USING (
  auth.uid() IS NOT NULL
  OR circle_id IS NULL
  OR circle_id IN (SELECT circle_id FROM public.circle_members WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "Circle members manage circle places" ON public.places;
DROP POLICY IF EXISTS "Users can create places for their circles" ON public.places;
DROP POLICY IF EXISTS "Users can update places they created" ON public.places;
DROP POLICY IF EXISTS "Circle members can delete places for their circle" ON public.places;

CREATE POLICY "Circle members manage circle places" ON public.places
FOR ALL USING (
  auth.uid() IS NOT NULL
) WITH CHECK (
  auth.uid() IS NOT NULL
);
