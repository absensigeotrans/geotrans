-- Migration: Daily Shift Schedules + Dynamic Late Threshold
-- Created: 2026-05-19
-- Purpose:
--   1. Table untuk jadwal shift harian Juru Parkir
--   2. Dynamic late threshold berdasarkan shift:
--      - Morning: > 07:00 = late
--      - Afternoon: > 11:00 = late
--      - Weekend: exempt dari late check

-- 1. Table untuk jadwal shift harian
CREATE TABLE IF NOT EXISTS user_shift_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    schedule_date DATE NOT NULL,
    shift_type VARCHAR(20) NOT NULL CHECK (shift_type IN ('morning', 'afternoon')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, schedule_date)
);

-- Index untuk performa query
CREATE INDEX IF NOT EXISTS idx_shift_schedules_user_date 
    ON user_shift_schedules(user_id, schedule_date);

-- 2. Enable RLS
ALTER TABLE user_shift_schedules ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view own shift schedules" ON user_shift_schedules;
CREATE POLICY "Users can view own shift schedules" ON user_shift_schedules
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own shift schedules" ON user_shift_schedules;
CREATE POLICY "Users can insert own shift schedules" ON user_shift_schedules
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own shift schedules" ON user_shift_schedules;
CREATE POLICY "Users can update own shift schedules" ON user_shift_schedules
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all shift schedules" ON user_shift_schedules;
CREATE POLICY "Admins can view all shift schedules" ON user_shift_schedules
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- 3. Update trigger validate_attendance_geofence() dengan dynamic late threshold
CREATE OR REPLACE FUNCTION public.validate_attendance_geofence()
RETURNS TRIGGER AS $$
DECLARE
    office_record RECORD;
    user_role TEXT;
    user_shift VARCHAR(20);
    calculated_distance DOUBLE PRECISION;
    is_checkout BOOLEAN;
    lat DOUBLE PRECISION;
    lon DOUBLE PRECISION;
    late_threshold TIME;
    is_weekend BOOLEAN;
    shift_date DATE;
BEGIN
    -- Get user role
    SELECT role INTO user_role FROM public.profiles WHERE id = NEW.user_id;
    
    -- Driver boleh di luar radius (tetap valid)
    IF user_role = 'driver' THEN
        NEW.is_valid := true;
        NEW.status := 'present';
        RETURN NEW;
    END IF;
    
    -- Viewer & Admin tidak boleh absen
    IF user_role IN ('viewer', 'admin', 'inactive') THEN
        RAISE EXCEPTION 'Absensi ditolak: Role % tidak diizinkan untuk melakukan absensi', user_role;
    END IF;
    
    -- Get the date for shift lookup
    shift_date := DATE(NEW.check_in_time);
    
    -- Check if weekend (0 = Sunday, 6 = Saturday)
    is_weekend := EXTRACT(DOW FROM shift_date) IN (0, 6);
    
    -- Get user's shift for today
    SELECT shift_type INTO user_shift
    FROM user_shift_schedules
    WHERE user_id = NEW.user_id 
        AND schedule_date = shift_date
    LIMIT 1;
    
    -- Juru Parkir & OB: WAJIB di dalam radius (REJECT kalau di luar)
    IF user_role IN ('juru_parkir', 'ob') THEN
        is_checkout := TG_OP = 'UPDATE' AND NEW.check_out_time IS NOT NULL AND OLD.check_out_time IS NULL;
        
        IF NEW.office_id IS NOT NULL THEN
            SELECT * INTO office_record FROM public.offices WHERE id = NEW.office_id;
        END IF;
        
        IF office_record IS NULL THEN
            SELECT * INTO office_record FROM public.offices LIMIT 1;
        END IF;
        
        IF is_checkout THEN
            lat := NEW.check_out_latitude;
            lon := NEW.check_out_longitude;
        ELSE
            lat := NEW.check_in_latitude;
            lon := NEW.check_in_longitude;
        END IF;
        
        IF office_record.id IS NOT NULL AND lat IS NOT NULL AND lon IS NOT NULL THEN
            calculated_distance := public.calculate_distance(lat, lon, office_record.latitude, office_record.longitude);
            NEW.distance_from_office := calculated_distance;
        ELSE
            calculated_distance := 0;
        END IF;
        
        IF calculated_distance > office_record.geofence_radius THEN
            RAISE EXCEPTION 'Absensi ditolak: Role % wajib absen di dalam radius kantor. Jarak Anda: %.0f meter (maksimal: % meter)', 
                user_role, calculated_distance, office_record.geofence_radius;
        END IF;
        
        NEW.is_valid := true;
        
        -- Determine late threshold based on shift
        IF user_shift IS NULL OR user_shift = 'morning' THEN
            late_threshold := '07:00:00'::time;
        ELSIF user_shift = 'afternoon' THEN
            late_threshold := '11:00:00'::time;
        ELSE
            late_threshold := '07:00:00'::time;
        END IF;
        
        -- Check if late (skip on weekend)
        IF NOT is_checkout THEN
            IF is_weekend THEN
                -- Weekend: always present, no late check
                NEW.status := 'present';
            ELSIF NEW.check_in_time::time > late_threshold THEN
                NEW.status := 'late';
            ELSE
                NEW.status := 'present';
            END IF;
        ELSE
            NEW.status := 'present';
        END IF;
        
        RETURN NEW;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;