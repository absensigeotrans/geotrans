-- Migration: 1016_rebuild_attendance_table.sql
-- Drop and recreate attendance table with all integrated columns
-- Includes: work_status, overtime_minutes, work_duration_minutes, photo_url

-- 1. Drop existing triggers on attendance
DROP TRIGGER IF EXISTS validate_geofence_before_insert ON public.attendance;
DROP TRIGGER IF EXISTS update_attendance_updated_at ON public.attendance;

-- 2. Drop attendance table with CASCADE
-- Drops attendance_logs too (FK REFERENCES attendance(id) ON DELETE CASCADE)
DROP TABLE IF EXISTS public.attendance CASCADE;

-- 3. Recreate attendance table with ALL columns
CREATE TABLE public.attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    office_id UUID REFERENCES public.offices(id) ON DELETE SET NULL,
    check_in_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    check_in_latitude DOUBLE PRECISION,
    check_in_longitude DOUBLE PRECISION,
    check_in_accuracy DOUBLE PRECISION,
    check_in_location_data JSONB,
    check_out_time TIMESTAMPTZ,
    check_out_latitude DOUBLE PRECISION,
    check_out_longitude DOUBLE PRECISION,
    check_out_accuracy DOUBLE PRECISION,
    check_out_location_data JSONB,
    is_valid BOOLEAN DEFAULT true,
    is_mocked BOOLEAN DEFAULT false,
    distance_from_office DOUBLE PRECISION,
    status attendance_status DEFAULT 'outside_radius',
    photo_url TEXT,
    work_status TEXT DEFAULT 'WFO',
    overtime_minutes INTEGER DEFAULT 0,
    work_duration_minutes INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Recreate attendance_logs table
CREATE TABLE IF NOT EXISTS public.attendance_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attendance_id UUID REFERENCES public.attendance(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    details JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Enable Row Level Security
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;

-- 6. RLS policies for attendance
DROP POLICY IF EXISTS "attendance_select_own" ON public.attendance;
CREATE POLICY "attendance_select_own" ON public.attendance
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "attendance_select_admin" ON public.attendance;
CREATE POLICY "attendance_select_admin" ON public.attendance
    FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "attendance_insert_own" ON public.attendance;
CREATE POLICY "attendance_insert_own" ON public.attendance
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "attendance_update_own" ON public.attendance;
CREATE POLICY "attendance_update_own" ON public.attendance
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "attendance_update_admin" ON public.attendance;
CREATE POLICY "attendance_update_admin" ON public.attendance
    FOR UPDATE USING (public.is_admin());

-- 7. RLS policy for attendance_logs
DROP POLICY IF EXISTS "attendance_logs_admin" ON public.attendance_logs;
CREATE POLICY "attendance_logs_admin" ON public.attendance_logs
    FOR SELECT USING (public.is_admin());

-- 8. Recreate triggers
DROP TRIGGER IF EXISTS validate_geofence_before_insert ON public.attendance;
CREATE TRIGGER validate_geofence_before_insert
    BEFORE INSERT OR UPDATE ON public.attendance
    FOR EACH ROW EXECUTE FUNCTION public.validate_attendance_geofence();

DROP TRIGGER IF EXISTS update_attendance_updated_at ON public.attendance;
CREATE TRIGGER update_attendance_updated_at
    BEFORE UPDATE ON public.attendance
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 9. Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_attendance_user_id ON public.attendance (user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_check_in_time ON public.attendance (check_in_time DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON public.attendance (status);
CREATE INDEX IF NOT EXISTS idx_attendance_work_status ON public.attendance (work_status);
