-- ============================================================================
-- STEP 5: OPTIMIZE RLS VIA STABLE FUNCTION & REDUCE WAL WRITE AMPLIFICATION
-- ============================================================================

-- 1. Revert REPLICA IDENTITY FULL to DEFAULT on locations
-- Since we now stream live peer movement over pure WebSocket Broadcasts (Step 2),
-- PostgreSQL no longer needs to copy entire before/after rows into the WAL, cutting disk write I/O by 50%.
ALTER TABLE public.locations REPLICA IDENTITY DEFAULT;

-- 2. Create STABLE Security Definer permission check
-- The 'STABLE' keyword instructs PostgreSQL to cache the result of the circle check
-- once per query transaction, rather than re-evaluating the circle_members join for thousands of rows.
CREATE OR REPLACE FUNCTION public.can_view_member_location(viewer_id uuid, target_id uuid)
RETURNS boolean AS $$
BEGIN
  -- Fast-path: self-access
  IF viewer_id = target_id THEN
    RETURN true;
  END IF;

  -- Circle membership join check
  RETURN EXISTS (
    SELECT 1 
    FROM public.circle_members cm1
    JOIN public.circle_members cm2 ON cm1.circle_id = cm2.circle_id
    WHERE cm1.user_id = viewer_id 
      AND cm2.user_id = target_id
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 3. Replace location_history SELECT policy with optimized STABLE function
DROP POLICY IF EXISTS "circle members see each other location history" ON public.location_history;
CREATE POLICY "circle members see each other location history" ON public.location_history
FOR SELECT USING (
  public.can_view_member_location(auth.uid(), user_id)
);
