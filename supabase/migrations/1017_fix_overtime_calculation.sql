-- Migration: 1017_fix_overtime_calculation.sql
-- Fix: Overtime should only count time worked AFTER shift ends,
-- not time from shift end to checkout when user checks in after shift end.

-- Example before fix:
--   Check-in: 20:14 WIB, Check-out: 20:23 WIB, Shift ends: 18:00
--   Lembur = 20:23 - 18:00 = 144 menit ❌ (check-in setelah shift selesai)
-- Example after fix:
--   Lembur = 20:23 - MAX(20:14, 18:00) = 9 menit (< 15 threshold → 0) ✅

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
    overtime_start TIMESTAMP;
    overtime_raw DOUBLE PRECISION;
    is_weekend BOOLEAN;
    shift_date DATE;
    user_role TEXT;
BEGIN
    -- Determine if this is a checkout update
    IF TG_OP = 'UPDATE' AND NEW.check_out_time IS NOT NULL AND OLD.check_out_time IS NULL THEN
        is_checkout := true;
    END IF;

    -- Get user role
    SELECT role INTO user_role FROM public.profiles WHERE id = NEW.user_id;

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

    -- ── driver_bebas: bypass geofence ──────────────────────
    IF user_role = 'driver_bebas' THEN
        NEW.is_valid := true;
        NEW.distance_from_office := 0;

        IF NOT is_checkout THEN
            -- Late check tetap jalan
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
            -- Preserve status from check-in
            NEW.status := OLD.status;

            -- Overtime tetap jalan (sama seperti role lain)
            IF NEW.check_in_time IS NOT NULL THEN
                check_in_wib := NEW.check_in_time AT TIME ZONE 'Asia/Jakarta';
                check_out_wib := NEW.check_out_time AT TIME ZONE 'Asia/Jakarta';
                NEW.work_duration_minutes := EXTRACT(EPOCH FROM (check_out_wib - check_in_wib)) / 60;
                shift_date := check_in_wib::DATE;
                is_weekend := EXTRACT(DOW FROM shift_date) IN (0, 6);

                IF NOT is_weekend THEN
                    SELECT shift_type INTO user_shift
                    FROM user_shift_schedules
                    WHERE user_id = NEW.user_id
                        AND schedule_date = shift_date
                    LIMIT 1;

                    IF user_shift IS NULL THEN
                        SELECT shift_type INTO user_shift FROM public.profiles WHERE id = NEW.user_id;
                    END IF;

                    SELECT end_time INTO shift_end_time
                    FROM shift_config
                    WHERE shift_type = COALESCE(user_shift, 'non_shifting')
                    LIMIT 1;

                    IF shift_end_time IS NOT NULL THEN
                        shift_end_ts := check_out_wib::DATE + shift_end_time;
                        overtime_start := GREATEST(check_in_wib, shift_end_ts);
                        overtime_raw := EXTRACT(EPOCH FROM (check_out_wib - overtime_start)) / 60;

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

        RETURN NEW;
    END IF;

    -- ── Geofence validation (driver_kantor & all other roles) ──
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

                        -- Overtime starts from the later of check-in time and shift end time
                        overtime_start := GREATEST(check_in_wib, shift_end_ts);

                        -- Overtime = checkout time minus overtime_start (in minutes)
                        overtime_raw := EXTRACT(EPOCH FROM (check_out_wib - overtime_start)) / 60;

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
