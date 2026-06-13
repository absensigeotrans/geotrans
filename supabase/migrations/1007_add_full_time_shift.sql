-- Migration: Add 'full_time' shift type option
-- Created: 2026-05-21
-- Purpose:
--   Allow Juru Parkir to select 'full_time' shift (07:00-16:00, late > 07:03)
--   alongside 'morning' (06:00-14:00, late > 06:03) and 'afternoon' (10:00-18:00, late > 10:03)

-- Drop old CHECK constraint
ALTER TABLE user_shift_schedules DROP CONSTRAINT IF EXISTS user_shift_schedules_shift_type_check;

-- Add new CHECK constraint with 'full_time'
ALTER TABLE user_shift_schedules ADD CONSTRAINT user_shift_schedules_shift_type_check 
    CHECK (shift_type IN ('morning', 'afternoon', 'full_time'));
