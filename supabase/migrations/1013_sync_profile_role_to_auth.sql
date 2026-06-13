-- Migration: Sync profiles.role to auth.users.raw_user_meta_data
-- Created: 2026-05-26
-- Purpose:
--   Whenever admin updates a user's role via the admin panel,
--   the update only affects profiles table. auth.users.raw_user_meta_data
--   stays stale, causing JWT tokens and phone apps to see the old role.
--   This trigger syncs role changes automatically.

CREATE OR REPLACE FUNCTION public.sync_profile_role_to_auth()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.role IS DISTINCT FROM NEW.role THEN
        UPDATE auth.users
        SET raw_user_meta_data = 
            COALESCE(raw_user_meta_data, '{}'::jsonb) || 
            jsonb_build_object('role', NEW.role)
        WHERE id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS sync_profile_role_to_auth ON public.profiles;
CREATE TRIGGER sync_profile_role_to_auth
    AFTER UPDATE OF role ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_profile_role_to_auth();

-- Also sync existing mismatched profiles
UPDATE auth.users u
SET raw_user_meta_data = 
    COALESCE(raw_user_meta_data, '{}'::jsonb) || 
    jsonb_build_object('role', p.role)
FROM public.profiles p
WHERE u.id = p.id
    AND (u.raw_user_meta_data->>'role') IS DISTINCT FROM p.role;
