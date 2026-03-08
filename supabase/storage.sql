-- Supabase Storage setup for VideoCheck
-- Run this in your Supabase SQL editor AFTER creating the main schema

-- Create the videos bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'videos',
  'videos',
  false,  -- private bucket, access via signed URLs
  1073741824,  -- 1GB max file size
  array['video/mp4', 'video/quicktime', 'video/webm']
)
on conflict (id) do nothing;

-- Storage policies: only authenticated users can upload/delete
-- Read access granted via signed URLs (service role)

create policy "Authenticated users can upload videos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'videos');

create policy "Authenticated users can delete own videos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'videos' and owner = auth.uid());

create policy "Service role can manage all videos"
  on storage.objects for all
  to service_role
  using (bucket_id = 'videos');
