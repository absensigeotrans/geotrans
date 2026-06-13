-- Migration: 1024_one_attendance_per_day.sql
-- Prevent duplicate check-ins: only one attendance record per user per day
-- Combines a unique partial index (DB-level safety net) + RLS refinement

-- 1. Clean up any existing duplicates before adding the constraint
-- Keep only the earliest check-in for each user on each day
DELETE FROM public.attendance a
USING (
  SELECT user_id, (check_in_time AT TIME ZONE 'Asia/Jakarta')::date AS day, MIN(check_in_time) AS min_time
  FROM public.attendance
  GROUP BY user_id, (check_in_time AT TIME ZONE 'Asia/Jakarta')::date
  HAVING COUNT(*) > 1
) dup
WHERE a.user_id = dup.user_id
  AND (a.check_in_time AT TIME ZONE 'Asia/Jakarta')::date = dup.day
  AND a.check_in_time > dup.min_time;

-- 2. Create a unique partial index on (user_id, check_in_date)
-- This prevents a second INSERT for the same user on the same calendar day
-- NOTE: Uses (check_in_time AT TIME ZONE 'Asia/Jakarta')::date for timezone-aware daily boundary
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_one_per_day
ON public.attendance (user_id, ((check_in_time AT TIME ZONE 'Asia/Jakarta')::date));

COMMENT ON INDEX idx_attendance_one_per_day IS 'Ensures one attendance record per user per calendar day';
