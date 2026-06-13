-- Migration: Add DELETE policy for attendance table
-- Purpose: Allow admins to delete attendance records
-- Issue: The attendance table only had SELECT policy, no DELETE policy

-- Add DELETE policy for attendance table (admin only)
DROP POLICY IF EXISTS "Admins can delete attendance" ON public.attendance;
CREATE POLICY "Admins can delete attendance" ON public.attendance
    FOR DELETE USING (public.is_admin());

-- Also add INSERT and UPDATE policies if they don't exist (for completeness)
DROP POLICY IF EXISTS "Admins can insert attendance" ON public.attendance;
CREATE POLICY "Admins can insert attendance" ON public.attendance
    FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update attendance" ON public.attendance;
CREATE POLICY "Admins can update attendance" ON public.attendance
    FOR UPDATE USING (public.is_admin());

-- Enable RLS on attendance table if not already enabled
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
