-- Migration 1029: Allow public SELECT access to objects in selfie_absensi bucket

DROP POLICY IF EXISTS "Public SELECT access for selfie_absensi" ON storage.objects;

CREATE POLICY "Public SELECT access for selfie_absensi"
ON storage.objects FOR SELECT
USING ( bucket_id = 'selfie_absensi' );
