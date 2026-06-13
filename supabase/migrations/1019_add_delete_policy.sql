-- Migration: 1019_add_delete_policy.sql
-- Add DELETE policy for admin to allow deleting attendance records from admin panel.

CREATE POLICY "attendance_delete_admin" ON public.attendance
  FOR DELETE TO authenticated
  USING (is_admin());
