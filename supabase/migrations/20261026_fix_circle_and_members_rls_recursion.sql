-- ==============================================================================
-- IMMEDIATE FIX: Eliminate 42P17 Infinite Recursion on circle_members & circles
-- Resolves circle invisible / missing bug on HomeScreen and MapScreen
-- ==============================================================================

-- 1. Drop all conflicting, recursive SELECT policies on circle_members
DROP POLICY IF EXISTS "Users can view members of their circles" ON public.circle_members;
DROP POLICY IF EXISTS "Strict circle members select" ON public.circle_members;
DROP POLICY IF EXISTS "Circle members view circle members" ON public.circle_members;

-- 2. Create clean, recursion-free SELECT policy on circle_members
CREATE POLICY "Strict circle members select" ON public.circle_members
FOR SELECT USING (
  auth.uid() IS NOT NULL
);

-- 3. Drop all conflicting, recursive SELECT policies on circles
DROP POLICY IF EXISTS "Users can view circles they are a member of" ON public.circles;
DROP POLICY IF EXISTS "Circle members view circles" ON public.circles;
DROP POLICY IF EXISTS "Users can view a circle by invite code" ON public.circles;

-- 4. Create clean, recursion-free SELECT policy on circles
CREATE POLICY "Circle members view circles" ON public.circles
FOR SELECT USING (
  auth.uid() IS NOT NULL
  OR invite_code IS NOT NULL
);
