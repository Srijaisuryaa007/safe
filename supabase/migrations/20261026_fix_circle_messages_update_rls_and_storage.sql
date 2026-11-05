-- ==============================================================================
-- Migration: Add UPDATE RLS policy for circle_messages & Chat Attachments Storage
-- ==============================================================================

-- 1. Enable UPDATE on circle_messages for message senders & circle leaders
-- This allows soft-deleting (setting deleted_at) or editing messages securely.
alter table public.circle_messages enable row level security;

drop policy if exists "Circle leaders or senders can update circle messages" on public.circle_messages;
create policy "Circle leaders or senders can update circle messages" on public.circle_messages
  for update using (
    sender_id = auth.uid()
    or exists (
      select 1 from public.circles c
      where c.id = circle_messages.circle_id
      and c.owner_id = auth.uid()
    )
    or exists (
      select 1 from public.circle_members cm
      where cm.circle_id = circle_messages.circle_id
      and cm.user_id = auth.uid()
      and cm.role in ('owner', 'co_leader')
    )
  )
  with check (
    sender_id = auth.uid()
    or exists (
      select 1 from public.circles c
      where c.id = circle_messages.circle_id
      and c.owner_id = auth.uid()
    )
    or exists (
      select 1 from public.circle_members cm
      where cm.circle_id = circle_messages.circle_id
      and cm.user_id = auth.uid()
      and cm.role in ('owner', 'co_leader')
    )
  );

-- 2. Ensure chat-attachments bucket exists for photos and documents
insert into storage.buckets (id, name, public) 
values ('chat-attachments', 'chat-attachments', true) 
on conflict (id) do nothing;

drop policy if exists "Chat attachments are publicly accessible" on storage.objects;
create policy "Chat attachments are publicly accessible" on storage.objects 
  for select using (bucket_id = 'chat-attachments');

drop policy if exists "Authenticated users can upload chat attachments" on storage.objects;
create policy "Authenticated users can upload chat attachments" on storage.objects 
  for insert with check (
    bucket_id = 'chat-attachments' 
    and auth.uid() is not null
  );

drop policy if exists "Users can delete their own chat attachments" on storage.objects;
create policy "Users can delete their own chat attachments" on storage.objects 
  for delete using (
    bucket_id = 'chat-attachments' 
    and auth.uid()::text = (storage.foldername(name))[1]
  );
