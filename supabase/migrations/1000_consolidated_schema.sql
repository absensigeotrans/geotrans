-- Consolidated Migration: 999_consolidated_schema.sql
-- This migration consolidates all previous migrations into a single, clean schema.

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enums
DO $$ BEGIN
    CREATE TYPE attendance_status AS ENUM ('present', 'late', 'outside_radius');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE leave_type_enum AS ENUM ('cuti_tahunan', 'cuti_sakit', 'cuti_darurat', 'izin_tidak_hadir', 'cuti', 'izin', 'sakit', 'annual', 'sick', 'emergency', 'unpaid');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE leave_status_enum AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE user_role_enum AS ENUM ('employee', 'admin', 'driver', 'juru_parkir', 'ob', 'viewer', 'inactive');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Tables

-- 1. Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    employee_id TEXT UNIQUE,
    nik TEXT,
    email TEXT,
    role TEXT DEFAULT 'juru_parkir',
    device_id TEXT,
    shift_type TEXT DEFAULT 'non_shifting',
    is_active BOOLEAN DEFAULT true,
    is_owner BOOLEAN DEFAULT false,
    is_viewer BOOLEAN DEFAULT false,
    can_manage_accounts BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Shifts
CREATE TABLE IF NOT EXISTS public.shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    grace_period_minutes INTEGER DEFAULT 15,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Offices
CREATE TABLE IF NOT EXISTS public.offices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    geofence_radius INTEGER DEFAULT 100,
    address TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. User Shifts
CREATE TABLE IF NOT EXISTS public.user_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    shift_id UUID REFERENCES public.shifts(id) ON DELETE SET NULL,
    office_id UUID REFERENCES public.offices(id) ON DELETE SET NULL,
    effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Attendance
CREATE TABLE IF NOT EXISTS public.attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    shift_id UUID REFERENCES public.shifts(id) ON DELETE SET NULL,
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
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Leave Requests
CREATE TABLE IF NOT EXISTS public.leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    leave_type TEXT, -- Mixed types from different migrations
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_days INTEGER,
    reason TEXT,
    status TEXT DEFAULT 'pending',
    approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    admin_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Settings
CREATE TABLE IF NOT EXISTS public.settings (
    id TEXT PRIMARY KEY DEFAULT 'app_settings',
    office_name TEXT DEFAULT 'Kantor Pusat Pertamina',
    latitude DOUBLE PRECISION DEFAULT -6.2297,
    longitude DOUBLE PRECISION DEFAULT 106.8295,
    radius_meters INTEGER DEFAULT 100,
    late_threshold_hour INTEGER DEFAULT 9,
    late_threshold_minute INTEGER DEFAULT 0,
    default_geofence_radius INTEGER DEFAULT 100,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Attendance Logs
CREATE TABLE IF NOT EXISTS public.attendance_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attendance_id UUID REFERENCES public.attendance(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    details JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Functions

-- 1. is_admin() - No RLS Recursion
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM auth.users
        WHERE id = auth.uid()
        AND raw_user_meta_data->>'role' = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. handle_new_user()
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.raw_user_meta_data IS NULL THEN
        RETURN NEW;
    END IF;

    INSERT INTO public.profiles (id, email, full_name, role, employee_id, nik, shift_type, is_active)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        COALESCE(NEW.raw_user_meta_data->>'role', 'juru_parkir'),
        NEW.raw_user_meta_data->>'employee_id',
        NEW.raw_user_meta_data->>'nik',
        COALESCE(NEW.raw_user_meta_data->>'shift_type', 'non_shifting'),
        true
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. calculate_distance()
CREATE OR REPLACE FUNCTION public.calculate_distance(lat1 DOUBLE PRECISION, lon1 DOUBLE PRECISION, lat2 DOUBLE PRECISION, lon2 DOUBLE PRECISION)
RETURNS DOUBLE PRECISION AS $$
DECLARE
    R DOUBLE PRECISION := 6371000; -- Earth radius in meters
    dLat DOUBLE PRECISION;
    dLon DOUBLE PRECISION;
    a DOUBLE PRECISION;
    c DOUBLE PRECISION;
BEGIN
    IF lat1 IS NULL OR lon1 IS NULL OR lat2 IS NULL OR lon2 IS NULL THEN
        RETURN 0;
    END IF;
    dLat := RADIANS(lat2 - lat1);
    dLon := RADIANS(lon2 - lon1);
    a := SIN(dLat / 2) * SIN(dLat / 2) +
        COS(RADIANS(lat1)) * COS(RADIANS(lat2)) *
        SIN(dLon / 2) * SIN(dLon / 2);
    c := 2 * ATAN2(SQRT(a), SQRT(1 - a));
    RETURN R * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 4. validate_attendance_geofence()
CREATE OR REPLACE FUNCTION public.validate_attendance_geofence()
RETURNS TRIGGER AS $$
DECLARE
    office_record RECORD;
    settings_record RECORD;
    calculated_distance DOUBLE PRECISION;
    is_checkout BOOLEAN;
    lat DOUBLE PRECISION;
    lon DOUBLE PRECISION;
BEGIN
    -- Determine if this is a checkout
    is_checkout := TG_OP = 'UPDATE' AND NEW.check_out_time IS NOT NULL AND OLD.check_out_time IS NULL;

    -- Get office location
    IF NEW.office_id IS NOT NULL THEN
        SELECT * INTO office_record FROM public.offices WHERE id = NEW.office_id;
    END IF;
    
    IF office_record IS NULL THEN
        SELECT * INTO office_record FROM public.offices LIMIT 1;
    END IF;

    -- Get settings
    SELECT * INTO settings_record FROM public.settings WHERE id = 'app_settings';

    -- Use correct columns
    IF is_checkout THEN
        lat := NEW.check_out_latitude;
        lon := NEW.check_out_longitude;
    ELSE
        lat := NEW.check_in_latitude;
        lon := NEW.check_in_longitude;
    END IF;

    -- Calculate distance
    IF office_record.id IS NOT NULL AND lat IS NOT NULL AND lon IS NOT NULL THEN
        calculated_distance := public.calculate_distance(lat, lon, office_record.latitude, office_record.longitude);
        NEW.distance_from_office := calculated_distance;
    ELSE
        calculated_distance := 0;
    END IF;

    -- Validate geofence
    IF office_record.id IS NOT NULL AND calculated_distance > office_record.geofence_radius THEN
        NEW.is_valid := false;
        NEW.status := 'outside_radius';
    ELSE
        NEW.is_valid := true;
        
        -- Check if late
        IF NOT is_checkout THEN
            IF EXTRACT(HOUR FROM NEW.check_in_time) > COALESCE(settings_record.late_threshold_hour, 9)
               OR (EXTRACT(HOUR FROM NEW.check_in_time) = COALESCE(settings_record.late_threshold_hour, 9)
                   AND EXTRACT(MINUTE FROM NEW.check_in_time) >= COALESCE(settings_record.late_threshold_minute, 0))
            THEN
                NEW.status := 'late';
            ELSE
                NEW.status := 'present';
            END IF;
        ELSE
            NEW.status := 'present';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. update_updated_at_column()
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. get_dashboard_analytics()
CREATE OR REPLACE FUNCTION public.get_dashboard_analytics(start_date DATE, end_date DATE)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  WITH status_dist AS (
    SELECT
      COALESCE(SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END), 0) AS present,
      COALESCE(SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END), 0) AS late,
      COALESCE(SUM(CASE WHEN status = 'outside_radius' THEN 1 ELSE 0 END), 0) AS outside
    FROM attendance
    WHERE check_in_time >= start_date
      AND check_in_time < (end_date + INTERVAL '1 day')
  ),
  daily_attendance AS (
    SELECT
      check_in_time::DATE AS date,
      COUNT(*) AS total,
      COALESCE(SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END), 0) AS present,
      COALESCE(SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END), 0) AS late,
      COALESCE(SUM(CASE WHEN status = 'outside_radius' THEN 1 ELSE 0 END), 0) AS outside
    FROM attendance
    WHERE check_in_time >= start_date
      AND check_in_time < (end_date + INTERVAL '1 day')
    GROUP BY check_in_time::DATE
    ORDER BY check_in_time::DATE
  ),
  late_trend AS (
    SELECT
      check_in_time::DATE AS date,
      COUNT(*) AS late_count,
      COALESCE(
        AVG(
          EXTRACT(EPOCH FROM (check_in_time::TIME - INTERVAL '9 hours')) / 60
        ) FILTER (WHERE check_in_time::TIME > '09:00:00'),
        0
      )::INTEGER AS avg_late_minutes
    FROM attendance
    WHERE status = 'late'
      AND check_in_time >= start_date
      AND check_in_time < (end_date + INTERVAL '1 day')
    GROUP BY check_in_time::DATE
    ORDER BY check_in_time::DATE
  )
  SELECT JSON_BUILD_OBJECT(
    'statusDistribution', (
      SELECT JSON_BUILD_OBJECT(
        'present', present,
        'late', late,
        'outside', outside
      ) FROM status_dist
    ),
    'dailyAttendance', (
      SELECT COALESCE(JSON_AGG(
        JSON_BUILD_OBJECT(
          'date', date,
          'total', total,
          'present', present,
          'late', late,
          'outside', outside
        ) ORDER BY date
      ), '[]'::JSON) FROM daily_attendance
    ),
    'lateTrend', (
      SELECT COALESCE(JSON_AGG(
        JSON_BUILD_OBJECT(
          'date', date,
          'lateCount', late_count,
          'avgLateMinutes', avg_late_minutes
        ) ORDER BY date
      ), '[]'::JSON) FROM late_trend
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- RLS Policies

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;

-- 1. Profiles
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;
CREATE POLICY "profiles_select_admin" ON public.profiles FOR SELECT USING (public.is_admin());
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
CREATE POLICY "profiles_update_admin" ON public.profiles FOR UPDATE USING (public.is_admin());
DROP POLICY IF EXISTS "profiles_insert_admin" ON public.profiles;
CREATE POLICY "profiles_insert_admin" ON public.profiles FOR INSERT WITH CHECK (public.is_admin());

-- 2. Attendance
DROP POLICY IF EXISTS "attendance_select_own" ON public.attendance;
CREATE POLICY "attendance_select_own" ON public.attendance FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "attendance_select_admin" ON public.attendance;
CREATE POLICY "attendance_select_admin" ON public.attendance FOR SELECT USING (public.is_admin());
DROP POLICY IF EXISTS "attendance_insert_own" ON public.attendance;
CREATE POLICY "attendance_insert_own" ON public.attendance FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "attendance_update_own" ON public.attendance;
CREATE POLICY "attendance_update_own" ON public.attendance FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "attendance_update_admin" ON public.attendance;
CREATE POLICY "attendance_update_admin" ON public.attendance FOR UPDATE USING (public.is_admin());

-- 3. Leave Requests
DROP POLICY IF EXISTS "leave_requests_select_own" ON public.leave_requests;
CREATE POLICY "leave_requests_select_own" ON public.leave_requests FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "leave_requests_select_admin" ON public.leave_requests;
CREATE POLICY "leave_requests_select_admin" ON public.leave_requests FOR SELECT USING (public.is_admin());
DROP POLICY IF EXISTS "leave_requests_insert_own" ON public.leave_requests;
CREATE POLICY "leave_requests_insert_own" ON public.leave_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "leave_requests_update_own" ON public.leave_requests;
CREATE POLICY "leave_requests_update_own" ON public.leave_requests FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "leave_requests_update_admin" ON public.leave_requests;
CREATE POLICY "leave_requests_update_admin" ON public.leave_requests FOR UPDATE USING (public.is_admin());

-- 4. Admin Only Tables
DROP POLICY IF EXISTS "offices_admin" ON public.offices;
CREATE POLICY "offices_admin" ON public.offices FOR ALL USING (public.is_admin());
DROP POLICY IF EXISTS "shifts_admin" ON public.shifts;
CREATE POLICY "shifts_admin" ON public.shifts FOR ALL USING (public.is_admin());
DROP POLICY IF EXISTS "settings_admin" ON public.settings;
CREATE POLICY "settings_admin" ON public.settings FOR ALL USING (public.is_admin());
DROP POLICY IF EXISTS "attendance_logs_admin" ON public.attendance_logs;
CREATE POLICY "attendance_logs_admin" ON public.attendance_logs FOR SELECT USING (public.is_admin());

-- 5. Anyone can view settings (for geofence checks)
DROP POLICY IF EXISTS "settings_view" ON public.settings;
CREATE POLICY "settings_view" ON public.settings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "offices_view" ON public.offices;
CREATE POLICY "offices_view" ON public.offices FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "shifts_view" ON public.shifts;
CREATE POLICY "shifts_view" ON public.shifts FOR SELECT TO authenticated USING (true);

-- 6. User Shifts
DROP POLICY IF EXISTS "user_shifts_select" ON public.user_shifts;
CREATE POLICY "user_shifts_select" ON public.user_shifts FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
DROP POLICY IF EXISTS "user_shifts_admin" ON public.user_shifts;
CREATE POLICY "user_shifts_admin" ON public.user_shifts FOR ALL USING (public.is_admin());

-- Triggers

-- 1. handle_new_user
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. validate_attendance_geofence
DROP TRIGGER IF EXISTS validate_geofence_before_insert ON public.attendance;
CREATE TRIGGER validate_geofence_before_insert
    BEFORE INSERT OR UPDATE ON public.attendance
    FOR EACH ROW EXECUTE FUNCTION public.validate_attendance_geofence();

-- 3. update_updated_at_column
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_offices_updated_at ON public.offices;
CREATE TRIGGER update_offices_updated_at BEFORE UPDATE ON public.offices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_attendance_updated_at ON public.attendance;
CREATE TRIGGER update_attendance_updated_at BEFORE UPDATE ON public.attendance FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_leave_requests_updated_at ON public.leave_requests;
CREATE TRIGGER update_leave_requests_updated_at BEFORE UPDATE ON public.leave_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_shifts_updated_at ON public.shifts;
CREATE TRIGGER update_shifts_updated_at BEFORE UPDATE ON public.shifts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_settings_updated_at ON public.settings;
CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON public.settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed Data

-- Shifts
INSERT INTO public.shifts (name, code, start_time, end_time, grace_period_minutes, is_active) VALUES
('Shift Pagi', 'SHIFT_PAGI', '08:00:00', '16:00:00', 15, true),
('Shift Sore', 'SHIFT_SORE', '16:00:00', '00:00:00', 15, true),
('Shift Malam', 'SHIFT_MALAM', '00:00:00', '08:00:00', 15, true),
('Non-Shifting', 'NON_SHIFTING', '08:30:00', '17:30:00', 30, true)
ON CONFLICT (code) DO NOTHING;

-- Office
INSERT INTO public.offices (name, latitude, longitude, geofence_radius, address, is_active) VALUES
('Kantor Pusat PTK Jakarta', -6.2088, 106.8456, 100, 'Jakarta, Indonesia', true)
ON CONFLICT DO NOTHING;

-- Settings
INSERT INTO public.settings (id, late_threshold_hour, late_threshold_minute, default_geofence_radius) VALUES
('app_settings', 9, 0, 100)
ON CONFLICT (id) DO NOTHING;
