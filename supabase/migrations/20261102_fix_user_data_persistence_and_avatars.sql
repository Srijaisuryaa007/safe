-- ============================================================================
-- Migration: Fix User Data Persistence & Avatars
-- Permanently resolves data disappearing issues for:
-- 1. Profile Picture (avatars bucket public access & isolated RLS policies)
-- 2. Medical Info (dual persistence: relational medical_info + profiles.medical_info)
-- 3. Emergency Contacts (relational emergency_contacts + profiles.emergency_contacts)
-- ============================================================================

-- 1. Ensure JSONB fallback columns exist on public.profiles
alter table public.profiles add column if not exists medical_info jsonb default '{}'::jsonb;
alter table public.profiles add column if not exists emergency_contacts jsonb default '[]'::jsonb;

-- 2. Ensure dedicated relational medical_info table exists
create table if not exists public.medical_info (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  blood_type text default 'O+',
  allergies text default '',
  conditions text default '',
  medications text default '',
  notes text default '',
  updated_at timestamptz default now()
);

-- 3. Ensure dedicated relational emergency_contacts table exists
create table if not exists public.emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  phone text not null,
  relationship text not null default 'Guardian',
  sort_order int not null default 0,
  updated_at timestamptz default now()
);

create index if not exists emergency_contacts_user_id_idx on public.emergency_contacts (user_id, sort_order);

-- 4. Enable Row-Level Security
alter table public.medical_info enable row level security;
alter table public.emergency_contacts enable row level security;

-- 5. Policies for medical_info
drop policy if exists "Users can manage their own medical_info" on public.medical_info;
create policy "Users can manage their own medical_info" 
  on public.medical_info 
  for all 
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Circle members can view peer medical_info" on public.medical_info;
create policy "Circle members can view peer medical_info" 
  on public.medical_info 
  for select 
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.circle_members cm_viewer
      join public.circle_members cm_owner on cm_owner.circle_id = cm_viewer.circle_id
      where cm_viewer.user_id = auth.uid()
      and cm_owner.user_id = medical_info.user_id
    )
  );

-- 6. Policies for emergency_contacts
drop policy if exists "Users can manage their own emergency_contacts" on public.emergency_contacts;
create policy "Users can manage their own emergency_contacts" 
  on public.emergency_contacts 
  for all 
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Circle members can view peer emergency_contacts" on public.emergency_contacts;
create policy "Circle members can view peer emergency_contacts" 
  on public.emergency_contacts 
  for select 
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.circle_members cm_viewer
      join public.circle_members cm_owner on cm_owner.circle_id = cm_viewer.circle_id
      where cm_viewer.user_id = auth.uid()
      and cm_owner.user_id = emergency_contacts.user_id
    )
  );

-- 7. Ensure Storage Bucket 'avatars' is explicitly PUBLIC
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update set
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']::text[];

-- 8. Storage RLS Policies for avatars
drop policy if exists "Public Access for Avatars" on storage.objects;
drop policy if exists "Avatar images are publicly accessible" on storage.objects;
create policy "Public Access for Avatars"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "User-isolated Avatar Uploads" on storage.objects;
drop policy if exists "Users can upload their own avatar" on storage.objects;
create policy "User-isolated Avatar Uploads"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "User-isolated Avatar Updates" on storage.objects;
drop policy if exists "Users can update their own avatar" on storage.objects;
create policy "User-isolated Avatar Updates"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars' and
    (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "User-isolated Avatar Deletion" on storage.objects;
drop policy if exists "Users can delete their own avatar" on storage.objects;
create policy "User-isolated Avatar Deletion"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

