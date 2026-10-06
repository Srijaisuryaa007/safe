-- ============================================================================
-- Migration: Member Privacy & Security Inspection + GPS Frequency Tracking
-- Enables circle leaders to inspect member privacy options & GPS sync frequency.
-- ============================================================================

alter table public.profiles
  add column if not exists gps_frequency text default 'high' check (gps_frequency in ('high', 'balanced', 'saver')),
  add column if not exists shake_sos_enabled boolean default false,
  add column if not exists app_lock_enabled boolean default false;

-- Create index for quick filtering if needed
create index if not exists idx_profiles_gps_frequency on public.profiles(gps_frequency);

-- Notify schema reload
comment on column public.profiles.gps_frequency is 'Member GPS polling frequency: high (5s), balanced (15s), saver (60s)';
comment on column public.profiles.shake_sos_enabled is 'Whether member has shake-to-SOS emergency gesture armed';
comment on column public.profiles.app_lock_enabled is 'Whether member has biometric authentication lock active';
