-- Migration 1005: Add photo_url to attendance + create selfie_absensi storage bucket

-- 1. Add photo_url column to attendance table
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- 2. Create Supabase Storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'selfie_absensi',
  'selfie_absensi',
  true,
  25600,
  ARRAY['image/jpeg', 'image/jpg']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 25600,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg']::text[];

-- 3. RLS: Upload policy - users can upload their own selfies
CREATE POLICY "Users can upload own selfie"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'selfie_absensi'
  AND (storage.foldername(name))[1] = 'selfies'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- 4. RLS: Select policy - users can read their own photos
CREATE POLICY "Users can read own selfie"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'selfie_absensi'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- 5. RLS: Admin/Owner can read all selfies
CREATE POLICY "Admins can read all selfies"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'selfie_absensi'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'owner')
  )
);

-- 6. RLS: Admin/Owner can delete selfies
CREATE POLICY "Admins can delete selfies"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'selfie_absensi'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'owner')
  )
);
