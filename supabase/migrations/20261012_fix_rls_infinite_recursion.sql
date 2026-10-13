-- ==============================================================================
-- IMMEDIATE FIX: Eliminate 42P17 Infinite Recursion & Restore 7-Member Circle
-- Run this in your Supabase SQL Editor (Dashboard -> SQL Editor -> New Query -> Run)
-- ==============================================================================

-- 1. Helper function running as SECURITY DEFINER to bypass RLS recursion on circle_members
create or replace function public.get_auth_user_circle_ids()
returns table (circle_id uuid)
language sql
security definer
stable
set search_path = public
as $$
  select cm.circle_id
  from public.circle_members cm
  where cm.user_id = auth.uid();
$$;

-- 2. Drop all conflicting/recursive policies on circle_members
drop policy if exists "Strict circle members select" on public.circle_members;
drop policy if exists "Circle members view circle members" on public.circle_members;
drop policy if exists "Users can view members of their circles" on public.circle_members;
drop policy if exists "Strict circle members insert" on public.circle_members;
drop policy if exists "Users can join a circle" on public.circle_members;
drop policy if exists "Circle members update role" on public.circle_members;
drop policy if exists "Strict circle members update" on public.circle_members;
drop policy if exists "Circle owners and members delete" on public.circle_members;
drop policy if exists "Strict circle members delete" on public.circle_members;

-- 3. Re-create clean, non-recursive policies on circle_members
create policy "Strict circle members select" on public.circle_members
for select using (
  user_id = auth.uid()
  or circle_id in (select circle_id from public.get_auth_user_circle_ids())
);

create policy "Strict circle members insert" on public.circle_members
for insert with check (
  auth.uid() = user_id
);

create policy "Strict circle members update" on public.circle_members
for update using (
  user_id = auth.uid()
  or circle_id in (select circle_id from public.get_auth_user_circle_ids())
);

create policy "Strict circle members delete" on public.circle_members
for delete using (
  user_id = auth.uid()
  or circle_id in (select circle_id from public.get_auth_user_circle_ids())
);

-- 4. Re-create clean policies on circles (allows joining via invite code & membership lookup)
drop policy if exists "Circle members view circles" on public.circles;
drop policy if exists "Users can view circles they are a member of" on public.circles;
drop policy if exists "Users can view a circle by invite code" on public.circles;

create policy "Circle members view circles" on public.circles
for select using (
  auth.uid() is not null
  or invite_code is not null
);
