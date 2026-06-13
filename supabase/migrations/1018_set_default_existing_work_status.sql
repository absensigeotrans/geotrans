-- Migration: 1018_set_default_existing_work_status.sql
-- Set default work_status for existing records that are NULL
-- After this migration, all existing records will have a work_status value.
-- Future records are handled by the ?? 'WFO' fallback in the mobile app.

UPDATE public.attendance
SET work_status = 'WFO'
WHERE work_status IS NULL;
