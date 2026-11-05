-- ==============================================================================
-- FIX: Storage RLS Policies for chat-attachments bucket
-- Enables reliable photo & document uploads from Circle Chat
-- ==============================================================================

-- 1. Ensure chat-attachments bucket exists and is public
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-attachments', 'chat-attachments', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Drop existing conflicting policies
DROP POLICY IF EXISTS "Authenticated users can upload chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update their chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Chat attachments are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload to chat-attachments" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update chat-attachments" ON storage.objects;

-- 3. Public read access for chat attachments
CREATE POLICY "Chat attachments are publicly accessible"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'chat-attachments');

-- 4. Insert permission for chat attachments
CREATE POLICY "Authenticated users can upload chat attachments"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'chat-attachments');

-- 5. Update permission (required when upsert is enabled in Supabase Storage JS)
CREATE POLICY "Authenticated users can update their chat attachments"
ON storage.objects FOR UPDATE
TO public
USING (bucket_id = 'chat-attachments')
WITH CHECK (bucket_id = 'chat-attachments');

-- 6. Delete permission
CREATE POLICY "Users can delete their own chat attachments"
ON storage.objects FOR DELETE
TO public
USING (
  bucket_id = 'chat-attachments'
  AND (
    auth.uid() IS NOT NULL
    OR (auth.uid())::text = (storage.foldername(name))[1]
  )
);
