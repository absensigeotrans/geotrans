-- Migration: 1023_anomaly_detection.sql
-- Adds anomaly detection: duplicate check-in, no-checkout yesterday,
-- duplicate coordinates, is_mocked enforcement, and composite index.

-- 1. Add anomaly_flags column to attendance table
ALTER TABLE public.attendance
ADD COLUMN IF NOT EXISTS anomaly_flags JSONB DEFAULT '{}';

-- 2. Create composite index for per-user time-series queries
CREATE INDEX IF NOT EXISTS idx_attendance_user_time
ON public.attendance (user_id, check_in_time DESC);

-- 3. Update trigger function with anomaly detection logic
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
    has_duplicate BOOLEAN;
    no_checkout_yesterday BOOLEAN;
    same_coords BOOLEAN;
    anomaly_json JSONB := '{}';
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

    -- Get office: prefer NEW.office_id, fallback to first active
    IF NEW.office_id IS NOT NULL THEN
        SELECT * INTO office_record FROM public.offices WHERE id = NEW.office_id;
    END IF;

    IF office_record.id IS NULL THEN
        SELECT * INTO office_record
        FROM public.offices
        WHERE is_active = true
        ORDER BY created_at DESC
        LIMIT 1;
    END IF;

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

    -- ── ANOMALY DETECTION (check-in only) ──────────────────────
    IF NOT is_checkout THEN
        -- Reset anomaly flags for re-validation
        anomaly_json := '{}';

        -- 1. Auto-invalidate if is_mocked=true
        IF NEW.is_mocked THEN
            NEW.is_valid := false;
            anomaly_json := anomaly_json || '{"fake_gps": true}';
        END IF;

        -- 2. Duplicate check-in: already has a record today without checkout
        has_duplicate := false;
        SELECT true INTO has_duplicate FROM public.attendance
        WHERE user_id = NEW.user_id
            AND check_in_time::date = NEW.check_in_time::date
            AND check_out_time IS NULL
            AND id IS DISTINCT FROM NEW.id
        LIMIT 1;

        IF has_duplicate THEN
            anomaly_json := anomaly_json || '{"duplicate_checkin": true}';
        END IF;

        -- 3. Missing checkout from yesterday
        no_checkout_yesterday := false;
        SELECT true INTO no_checkout_yesterday FROM public.attendance
        WHERE user_id = NEW.user_id
            AND check_in_time::date = (NEW.check_in_time::date - INTERVAL '1 day')
            AND check_out_time IS NULL
        LIMIT 1;

        IF no_checkout_yesterday THEN
            anomaly_json := anomaly_json || '{"missing_checkout": true}';
        END IF;

        -- 4. Duplicate GPS coordinates with other users in last 5 minutes
        IF lat IS NOT NULL AND lon IS NOT NULL THEN
            same_coords := false;
            SELECT true INTO same_coords FROM public.attendance
            WHERE check_in_latitude = lat
                AND check_in_longitude = lon
                AND user_id != NEW.user_id
                AND check_in_time > NEW.check_in_time - INTERVAL '5 minutes'
            LIMIT 1;

            IF same_coords THEN
                anomaly_json := anomaly_json || '{"duplicate_coordinates": true}';
            END IF;
        END IF;

        NEW.anomaly_flags := anomaly_json;
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

            -- Overtime tetap jalan
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
        IF NEW.is_mocked THEN
            NEW.is_valid := false;
        ELSE
            NEW.is_valid := true;
        END IF;

        IF NOT is_checkout THEN
            -- Check if late
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
            NEW.status := OLD.status;

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
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
