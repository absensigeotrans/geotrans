-- Migration: Overtime calculation + shift_config table
-- Created: 2026-05-25
-- Purpose:
--   1. Create shift_config table with start/end times per shift type
--   2. Add overtime_minutes and work_duration_minutes to attendance
--   3. Rewrite validate_attendance_geofence to calculate overtime on checkout
--      Rules:
--        - Weekend: no overtime
--        - Minimum 15 minutes excess before counting
--        - Overtime = check_out (WIB) - shift end_time, in minutes

-- ============================================================
-- 1. CREATE shift_config TABLE + SEED DATA
-- ============================================================

CREATE TABLE IF NOT EXISTS shift_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_type VARCHAR(20) NOT NULL UNIQUE CHECK (shift_type IN ('morning', 'afternoon', 'full_time', 'non_shifting')),
    name VARCHAR(50) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    grace_minutes INTEGER DEFAULT 3,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO shift_config (shift_type, name, start_time, end_time, grace_minutes) VALUES
('morning',     'Shift Pagi',    '06:00:00', '14:00:00', 3),
('afternoon',   'Shift Siang',   '10:00:00', '18:00:00', 3),
('full_time',   'Full Time',     '07:00:00', '16:00:00', 3),
('non_shifting', 'Non-Shifting', '07:00:00', '16:00:00', 3)
ON CONFLICT (shift_type) DO UPDATE SET
    name = EXCLUDED.name,
    start_time = EXCLUDED.start_time,
    end_time = EXCLUDED.end_time,
    grace_minutes = EXCLUDED.grace_minutes;

ALTER TABLE shift_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage shift_config" ON shift_config;
CREATE POLICY "Admins can manage shift_config" ON shift_config
    FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "All users can view shift_config" ON shift_config;
CREATE POLICY "All users can view shift_config" ON shift_config
    FOR SELECT TO authenticated USING (true);

-- ============================================================
-- 2. ADD overtime COLUMNS TO attendance
-- ============================================================

ALTER TABLE attendance
    ADD COLUMN IF NOT EXISTS overtime_minutes INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS work_duration_minutes INTEGER;

-- ============================================================
-- 3. REWRITE validate_attendance_geofence WITH OVERTIME
-- ============================================================

CREATE OR REPLACE FUNCTION public.validate_attendance_geofence()
RETURNS TRIGGER AS $$
DECLARE
    office_record RECORD;
    settings_record RECORD;
    calculated_distance NUMERIC;
    lat NUMERIC;
    lon NUMERIC;
    is_checkout BOOLEAN := false;
    check_in_hour INTEGER;
    check_in_minute INTEGER;
    user_shift VARCHAR(20);
    shift_end_time TIME;
    check_in_wib TIMESTAMP;
    check_out_wib TIMESTAMP;
    shift_end_ts TIMESTAMP;
    overtime_raw DOUBLE PRECISION;
    is_weekend BOOLEAN;
    shift_date DATE;
BEGIN
    -- Determine if this is a checkout update
    IF TG_OP = 'UPDATE' AND NEW.check_out_time IS NOT NULL AND OLD.check_out_time IS NULL THEN
        is_checkout := true;
    END IF;

    -- Get coordinates
    IF is_checkout THEN
        lat := NEW.check_out_latitude;
        lon := NEW.check_out_longitude;
    ELSE
        lat := NEW.check_in_latitude;
        lon := NEW.check_in_longitude;
    END IF;

    -- Get active office
    SELECT * INTO office_record
    FROM public.offices
    WHERE is_active = true
    LIMIT 1;

    -- Get settings
    SELECT * INTO settings_record
    FROM public.settings
    LIMIT 1;

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

        IF NOT is_checkout THEN
            -- Check if late - using WIB timezone
            check_in_hour := EXTRACT(HOUR FROM NEW.check_in_time AT TIME ZONE 'Asia/Jakarta');
            check_in_minute := EXTRACT(MINUTE FROM NEW.check_in_time AT TIME ZONE 'Asia/Jakarta');

            IF check_in_hour > COALESCE(settings_record.late_threshold_hour, 9)
               OR (check_in_hour = COALESCE(settings_record.late_threshold_hour, 9)
                   AND check_in_minute >= COALESCE(settings_record.late_threshold_minute, 0))
            THEN
                NEW.status := 'late';
            ELSE
                NEW.status := 'present';
            END IF;
        ELSE
            -- Preserve the original status from check-in
            NEW.status := OLD.status;

            -- ============================================
            -- OVERTIME CALCULATION
            -- ============================================
            IF NEW.check_in_time IS NOT NULL THEN
                check_in_wib := NEW.check_in_time AT TIME ZONE 'Asia/Jakarta';
                check_out_wib := NEW.check_out_time AT TIME ZONE 'Asia/Jakarta';

                -- Work duration (total minutes between check-in and check-out)
                NEW.work_duration_minutes := EXTRACT(EPOCH FROM (check_out_wib - check_in_wib)) / 60;

                -- Check weekend (0 = Sunday, 6 = Saturday)
                shift_date := check_in_wib::DATE;
                is_weekend := EXTRACT(DOW FROM shift_date) IN (0, 6);

                -- Only calculate overtime on weekdays
                IF NOT is_weekend THEN
                    -- Get user's shift for today (prioritas: daily schedule > profile shift_type)
                    SELECT shift_type INTO user_shift
                    FROM user_shift_schedules
                    WHERE user_id = NEW.user_id
                        AND schedule_date = shift_date
                    LIMIT 1;

                    IF user_shift IS NULL THEN
                        SELECT shift_type INTO user_shift FROM public.profiles WHERE id = NEW.user_id;
                    END IF;

                    -- Get shift end time from config
                    SELECT end_time INTO shift_end_time
                    FROM shift_config
                    WHERE shift_type = COALESCE(user_shift, 'non_shifting')
                    LIMIT 1;

                    IF shift_end_time IS NOT NULL THEN
                        -- Construct full timestamp: same day as checkout + end_time
                        shift_end_ts := check_out_wib::DATE + shift_end_time;

                        -- Overtime = checkout time minus scheduled end time (in minutes)
                        overtime_raw := EXTRACT(EPOCH FROM (check_out_wib - shift_end_ts)) / 60;

                        -- Apply minimum threshold: only count if >= 15 minutes
                        IF overtime_raw >= 15 THEN
                            NEW.overtime_minutes := overtime_raw::INTEGER;
                        ELSE
                            NEW.overtime_minutes := 0;
                        END IF;
                    ELSE
                        NEW.overtime_minutes := 0;
                    END IF;
                ELSE
                    NEW.overtime_minutes := 0;
                END IF;
            ELSE
                NEW.overtime_minutes := 0;
                NEW.work_duration_minutes := NULL;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
