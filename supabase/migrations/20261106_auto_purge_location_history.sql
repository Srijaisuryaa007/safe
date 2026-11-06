  -- ============================================================================
  -- STEP 1: AUTOMATED 7-DAY LOCATION HISTORY PURGE & DISK MAINTENANCE
  -- ============================================================================

  -- 1. Enable pg_cron (included free on Supabase)
  CREATE EXTENSION IF NOT EXISTS pg_cron;

  -- 2. Create the cleanup function
  CREATE OR REPLACE FUNCTION purge_old_location_history()
  RETURNS void AS $$
  BEGIN
    -- Delete all breadcrumbs older than 7 days
    DELETE FROM public.location_history 
    WHERE recorded_at < NOW() - INTERVAL '7 days';
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER;

  -- 3. Schedule it to run automatically every night at 3:00 AM UTC
  DO $$
  BEGIN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'nightly-location-history-purge') THEN
      PERFORM cron.unschedule('nightly-location-history-purge');
    END IF;
  END $$;

  SELECT cron.schedule(
    'nightly-location-history-purge',
    '0 3 * * *',
    'SELECT purge_old_location_history();'
  );

  -- 4. Tune auto-vacuum on high-velocity tables to immediately reclaim deleted disk space
  ALTER TABLE public.location_history SET (
    autovacuum_vacuum_scale_factor = 0.05,
    autovacuum_vacuum_cost_limit = 1000
  );

  ALTER TABLE public.locations SET (
    autovacuum_vacuum_scale_factor = 0.05,
    autovacuum_vacuum_cost_limit = 1000
  );

