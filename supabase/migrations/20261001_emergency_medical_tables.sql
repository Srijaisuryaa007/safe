-- ============================================================================
-- CIRCLEGUARD EMERGENCY CONTACTS & MEDICAL INFO RELATIONAL TABLES & MIGRATION
-- Migration: 20261001_emergency_medical_tables.sql
-- ============================================================================

-- 1. Create dedicated medical_info table
create table if not exists public.medical_info (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  blood_type text default 'O+',
  allergies text default '',
  conditions text default '',
  medications text default '',
  notes text default '',
  updated_at timestamptz default now()
);

-- 2. Create dedicated emergency_contacts table
create table if not exists public.emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  phone text not null,
  relationship text not null default 'Guardian',
  sort_order int not null default 0,
  updated_at timestamptz default now()
);

-- Create index on emergency_contacts for fast user lookups & ordering
create index if not exists emergency_contacts_user_id_idx on public.emergency_contacts (user_id, sort_order);

-- 3. Enable Row Level Security (RLS)
alter table public.medical_info enable row level security;
alter table public.emergency_contacts enable row level security;

-- 4. RLS Policies for medical_info
-- Owner has full CRUD access
drop policy if exists "Users can manage their own medical_info" on public.medical_info;
create policy "Users can manage their own medical_info" 
  on public.medical_info 
  for all 
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Circle members / Guardians can view medical_info for emergency / SOS flows
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

-- 5. RLS Policies for emergency_contacts
-- Owner has full CRUD access
drop policy if exists "Users can manage their own emergency_contacts" on public.emergency_contacts;
create policy "Users can manage their own emergency_contacts" 
  on public.emergency_contacts 
  for all 
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Circle members can view peer emergency_contacts in emergency scenarios
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

-- 6. Backwards Compatibility Data Migration
-- Safely copy legacy medical_info from public.profiles into public.medical_info
do $$
begin
  if exists (
    select 1 
    from information_schema.columns 
    where table_schema = 'public' 
      and table_name = 'profiles' 
      and column_name = 'medical_info'
  ) then
    insert into public.medical_info (user_id, blood_type, allergies, conditions, medications, notes, updated_at)
    select 
      id as user_id,
      coalesce(nullif(medical_info->>'bloodType', ''), 'O+'),
      coalesce(medical_info->>'allergies', ''),
      coalesce(medical_info->>'conditions', ''),
      coalesce(medical_info->>'medications', ''),
      coalesce(medical_info->>'notes', ''),
      now()
    from public.profiles
    where medical_info is not null 
      and medical_info != '{}'::jsonb
    on conflict (user_id) do update set
      blood_type = coalesce(nullif(excluded.blood_type, ''), medical_info.blood_type),
      allergies = coalesce(nullif(excluded.allergies, ''), medical_info.allergies),
      conditions = coalesce(nullif(excluded.conditions, ''), medical_info.conditions),
      medications = coalesce(nullif(excluded.medications, ''), medical_info.medications),
      notes = coalesce(nullif(excluded.notes, ''), medical_info.notes),
      updated_at = now();
  end if;
end $$;

-- Safely copy legacy emergency_contacts array from public.profiles into public.emergency_contacts
do $$
begin
  if exists (
    select 1 
    from information_schema.columns 
    where table_schema = 'public' 
      and table_name = 'profiles' 
      and column_name = 'emergency_contacts'
  ) then
    insert into public.emergency_contacts (id, user_id, name, phone, relationship, sort_order, updated_at)
    select 
      case 
        when (contact->>'id') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' 
        then (contact->>'id')::uuid 
        else gen_random_uuid() 
      end as id,
      p.id as user_id,
      coalesce(contact->>'name', 'Emergency Contact') as name,
      coalesce(contact->>'phone', '') as phone,
      coalesce(contact->>'relationship', 'Guardian') as relationship,
      (ord - 1) as sort_order,
      now()
    from public.profiles p,
    lateral jsonb_array_elements(case when jsonb_typeof(p.emergency_contacts) = 'array' then p.emergency_contacts else '[]'::jsonb end) with ordinality as arr(contact, ord)
    where coalesce(contact->>'phone', '') <> ''
    on conflict (id) do nothing;
  end if;
end $$;
