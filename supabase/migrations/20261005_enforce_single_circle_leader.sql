-- ============================================================================
-- ENFORCE STRICT SINGLE LEADER PER CIRCLE ARCHITECTURE
-- ============================================================================
-- A circle must have EXACTLY ONE Leader (owner).
-- The Leader can choose any number (N) of Co-Leaders (co_leader) and Guardians (guardian).
-- Any duplicate owners in existing circles are safely normalized to 'co_leader'.
-- ============================================================================

-- 1. Normalize existing circles so only the authentic circle founder is 'owner'
-- All other members in the circle with role = 'owner' become 'co_leader'
UPDATE public.circle_members cm
SET role = 'co_leader'
FROM public.circles c
WHERE cm.circle_id = c.id
  AND cm.role = 'owner'
  AND cm.user_id <> c.owner_id;

-- 2. In case any circle had duplicate owners without a matching circles.owner_id,
-- retain only the earliest joined member as 'owner' and demote others to 'co_leader'
WITH ranked_owners AS (
  SELECT circle_id, user_id,
         ROW_NUMBER() OVER (PARTITION BY circle_id ORDER BY joined_at ASC) as rn
  FROM public.circle_members
  WHERE role = 'owner'
)
UPDATE public.circle_members cm
SET role = 'co_leader'
FROM ranked_owners ro
WHERE cm.circle_id = ro.circle_id
  AND cm.user_id = ro.user_id
  AND ro.rn > 1;

-- 3. Universal Sync: For EVERY circle across the entire platform,
-- ensure whoever created the circle (circles.owner_id) is set as 'owner'
UPDATE public.circle_members cm
SET role = 'owner'
FROM public.circles c
WHERE cm.circle_id = c.id
  AND cm.user_id = c.owner_id;

-- 4. Create trigger to automatically normalize any future duplicate 'owner' to 'co_leader'
CREATE OR REPLACE FUNCTION public.enforce_single_circle_leader()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'owner' THEN
    -- Check if another member in this circle already has role = 'owner'
    IF EXISTS (
      SELECT 1 FROM public.circle_members
      WHERE circle_id = NEW.circle_id
        AND role = 'owner'
        AND user_id <> NEW.user_id
    ) THEN
      -- Automatically demote to co_leader to preserve single-leader invariant
      NEW.role := 'co_leader';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_single_circle_leader ON public.circle_members;
CREATE TRIGGER trg_enforce_single_circle_leader
  BEFORE INSERT OR UPDATE OF role ON public.circle_members
  FOR EACH ROW EXECUTE FUNCTION public.enforce_single_circle_leader();

-- 5. Create unique partial index on circle_members so database enforces at most 1 owner per circle
DROP INDEX IF EXISTS public.idx_circle_members_single_owner;
CREATE UNIQUE INDEX idx_circle_members_single_owner
  ON public.circle_members (circle_id)
  WHERE role = 'owner';

COMMENT ON INDEX public.idx_circle_members_single_owner IS
  'Ensures each circle has strictly one Leader (owner). Leaders can assign unlimited co-leaders and guardians.';
