-- Migration: 20261102_fix_member_gps_frequency_and_leader_rpc.sql
-- 1. Loosen gps_frequency check constraint to accept both legacy ('realtime', 'battery_saver')
--    and standard ('high', 'balanced', 'saver') strings without constraint violation.
-- 2. Create is_circle_leader_of() security definer helper.
-- 3. Create update_member_gps_frequency() RPC with SECURITY DEFINER to allow Circle Leaders
--    to change members' tracking frequency reliably.
-- 4. Update profiles RLS policy to ensure circle leaders can update member privacy/telemetry settings.

-- 1. Fix CHECK constraint on public.profiles(gps_frequency)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_gps_frequency_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_gps_frequency_check 
  CHECK (gps_frequency IN ('high', 'balanced', 'saver', 'realtime', 'battery_saver'));

-- 2. Security definer helper function
CREATE OR REPLACE FUNCTION public.is_circle_leader_of(target_user_id UUID, check_leader_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.circle_members cm_leader
    JOIN public.circle_members cm_target ON cm_target.circle_id = cm_leader.circle_id
    WHERE cm_leader.user_id = check_leader_id
      AND cm_target.user_id = target_user_id
      AND cm_leader.role IN ('owner', 'co_leader')
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_circle_leader_of(UUID, UUID) TO authenticated;

-- 3. Dedicated RPC for leaders to update member GPS frequency
CREATE OR REPLACE FUNCTION public.update_member_gps_frequency(
  p_target_user_id UUID,
  p_frequency TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_normalized TEXT;
  v_is_authorized BOOLEAN := false;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Normalize frequency to standard DB values
  IF p_frequency IN ('high', 'realtime') THEN
    v_normalized := 'high';
  ELSIF p_frequency IN ('saver', 'battery_saver') THEN
    v_normalized := 'saver';
  ELSE
    v_normalized := 'balanced';
  END IF;

  -- Self is always authorized, or must be circle leader
  IF v_caller_id = p_target_user_id OR public.is_circle_leader_of(p_target_user_id, v_caller_id) THEN
    v_is_authorized := true;
  END IF;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Unauthorized: Only circle leaders can adjust member GPS frequency';
  END IF;

  UPDATE public.profiles
  SET gps_frequency = v_normalized
  WHERE id = p_target_user_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_member_gps_frequency(UUID, TEXT) TO authenticated;

-- 4. Ensure profiles UPDATE RLS policy allows circle leaders
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users or circle leaders can update profiles" ON public.profiles;

CREATE POLICY "Users or circle leaders can update profiles" ON public.profiles
FOR UPDATE USING (
  auth.uid() = id
  OR public.is_circle_leader_of(id, auth.uid())
)
WITH CHECK (
  auth.uid() = id
  OR public.is_circle_leader_of(id, auth.uid())
);
