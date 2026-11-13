-- ── Make My Perfume: Storage bucket for product images ──────────────────────
-- Creates the public 'product-images' bucket for perfume bottles, packaging, and
-- notes photography with full RLS policies for public view and admin uploads.

-- 1. Create the bucket in storage.buckets if it does not already exist
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  10485760, -- 10MB limit
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'];

-- 2. Storage RLS Policies
-- Allow anyone (public, anon, authenticated) to view images in 'product-images'
drop policy if exists "Public Access to product-images" on storage.objects;
create policy "Public Access to product-images"
  on storage.objects for select
  using (bucket_id = 'product-images');

-- Allow authenticated users and service role (and authorized admin clients) to upload
drop policy if exists "Allow upload to product-images" on storage.objects;
create policy "Allow upload to product-images"
  on storage.objects for insert
  with check (bucket_id = 'product-images');

-- Allow updating objects in product-images
drop policy if exists "Allow update to product-images" on storage.objects;
create policy "Allow update to product-images"
  on storage.objects for update
  using (bucket_id = 'product-images');

-- Allow deleting objects from product-images
drop policy if exists "Allow delete from product-images" on storage.objects;
create policy "Allow delete from product-images"
  on storage.objects for delete
  using (bucket_id = 'product-images');

-- 3. Grants for anon and authenticated API roles on storage objects for product-images
grant select, insert, update, delete on table storage.objects to anon, authenticated;
grant select, insert, update, delete on table storage.buckets to anon, authenticated;

