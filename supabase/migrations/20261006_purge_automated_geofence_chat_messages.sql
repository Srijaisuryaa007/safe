-- ==============================================================================
-- Migration: Purge Automated Geofence & System Logs from circle_messages
-- 
-- Description:
-- Geofence arrivals, departures, chime alerts, and battery nudges were previously
-- being inserted into `public.circle_messages` (the user group chat table), causing
-- automated safety activity logs to spam the chat screen as message bubbles.
--
-- This migration cleans up legacy automated system rows from `circle_messages`
-- while preserving authentic member chat messages. All authoritative geofence
-- activity remains safely stored in `public.zone_events` and `public.place_events`.
-- ==============================================================================

DELETE FROM public.circle_messages
WHERE 
  content LIKE '📍 Left %'
  OR content LIKE '📍 Arrived %'
  OR content LIKE 'CHIME ALERT:%'
  OR content LIKE 'BATTERY NUDGE:%'
  OR message_type = 'GEOFENCE'
  OR message_type = 'SYSTEM';

-- Optional: ensure index on circle_messages for efficient human chat fetching
CREATE INDEX IF NOT EXISTS idx_circle_messages_active_human 
  ON public.circle_messages (circle_id, created_at DESC)
  WHERE deleted_at IS NULL;
