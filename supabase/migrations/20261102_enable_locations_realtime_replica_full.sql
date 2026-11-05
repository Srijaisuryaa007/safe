-- Migration: 20261102_enable_locations_realtime_replica_full.sql
-- Enables REPLICA IDENTITY FULL on locations to allow Supabase Realtime CDC 
-- to reliably broadcast UPDATE events across RLS-protected circle members.

-- 1. Enable REPLICA IDENTITY FULL on locations
ALTER TABLE public.locations REPLICA IDENTITY FULL;

-- 2. Enable REPLICA IDENTITY FULL on circle_members and places for real-time consistency
ALTER TABLE public.circle_members REPLICA IDENTITY FULL;
ALTER TABLE public.places REPLICA IDENTITY FULL;

-- 3. Ensure tables are added to the supabase_realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'locations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.locations;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'circle_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.circle_members;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'places'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.places;
  END IF;
END $$;

