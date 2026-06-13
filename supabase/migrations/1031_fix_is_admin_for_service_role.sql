-- Migration: Fix is_admin function to allow service_role key
-- Created: 2026-06-12

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    -- Allow service_role key (from server-side API routes) to bypass admin checks
    IF auth.role() = 'service_role' THEN
        RETURN TRUE;
    END IF;

    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
