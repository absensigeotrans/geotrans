-- Migration: 1021_fix_is_admin_function.sql
-- Fix: is_admin() checked auth.users.raw_user_meta_data->>'role' instead of
-- public.profiles.role, causing RLS to block UPDATE/DELETE on offices table
-- when the metadata was out of sync with profiles.
--
-- Root cause: the admin frontend checks profiles.role, but the RLS function
-- checked auth.users metadata. These could diverge when:
--   1. Admin user was created before migration 1013 (sync trigger)
--   2. Role was changed via a path that didn't update auth metadata
--   3. JWT token contained stale metadata
--
-- Fix: query public.profiles directly (SECURITY DEFINER bypasses RLS).

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
