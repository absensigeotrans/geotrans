-- Migration: 1027_fix_shift_late_validation.sql
-- Created: 2026-06-08
-- Purpose:
--   Perbaiki validasi keterlambatan (late) pada trigger validate_attendance_geofence()
--   agar menggunakan shift_config.start_time + grace_minutes secara dinamis,
--   bukan settings.late_threshold_hour yang hardcoded (default 09:00).
--
--   Bug sebelumnya:
--     - Karyawan Shift Pagi (mulai 06:00) absen pukul 08:00 → dianggap "present" (harusnya "late")
--     - Karyawan Shift Siang (mulai 10:00) absen pukul 09:30 → dianggap "late" (harusnya "present")
--
--   Solusi:
--     - Ambil start_time + grace_minutes dari shift_config berdasarkan shift aktif karyawan
--     - Bandingkan jam check-in (WIB) dengan late_cutoff = start_time + grace_minutes
--     - Prioritas shift: user_shift_schedules (daily) > profiles.shift_type > fallback 'non_shifting'

CREATE OR REPLACE FUNCTION public.validate_attendance_geofence()
RETURNS TRIGGER AS $$
DECLARE
    office_record RECORD;
    calculated_distance NUMERIC;
    lat NUMERIC;
    lon NUMERIC;
    is_checkout BOOLEAN := false;
    user_shift VARCHAR(20);
    shift_start_time TIME;
    shift_end_time TIME;
    shift_grace_minutes INTEGER;
    late_cutoff TIME;
    check_in_wib TIMESTAMP;
    check_out_wib TIMESTAMP;
    check_in_time_wib TIME;
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

    -- Calculate distance
    IF office_record.id IS NOT NULL AND lat IS NOT NULL AND lon IS NOT NULL THEN
        calculated_distance := public.calculate_distance(lat, lon, office_record.latitude, office_record.longitude);
        NEW.distance_from_office := calculated_distance;
    ELSE
        calculated_distance := 0;
    END IF;

    -- ── Helper: Resolve user shift (daily schedule > profile > fallback) ──
    -- Used for both late check and overtime calculation
    IF NOT is_checkout THEN
        shift_date := DATE(NEW.check_in_time AT TIME ZONE 'Asia/Jakarta');
    ELSE
        shift_date := DATE(NEW.check_in_time AT TIME ZONE 'Asia/Jakarta');
    END IF;

    SELECT shift_type INTO user_shift
    FROM user_shift_schedules
    WHERE user_id = NEW.user_id
        AND schedule_date = shift_date
    LIMIT 1;

    IF user_shift IS NULL THEN
        SELECT shift_type INTO user_shift FROM public.profiles WHERE id = NEW.user_id;
    END IF;

    -- Get shift config: start_time, end_time, grace_minutes
    SELECT start_time, end_time, grace_minutes
    INTO shift_start_time, shift_end_time, shift_grace_minutes
    FROM shift_config
    WHERE shift_type = COALESCE(user_shift, 'non_shifting')
    LIMIT 1;

    -- Fallback defaults jika shift_config tidak ditemukan
    IF shift_start_time IS NULL THEN
        shift_start_time   := '07:00:00'::TIME;
        shift_end_time     := '16:00:00'::TIME;
        shift_grace_minutes := 3;
    END IF;

    -- late_cutoff = start_time + grace_minutes (misal: 06:00 + 3 menit = 06:03:00)
    late_cutoff := shift_start_time + (COALESCE(shift_grace_minutes, 3) * INTERVAL '1 minute');

    -- ── driver_bebas: bypass geofence ──────────────────────
    IF user_role = 'driver_bebas' THEN
        NEW.is_valid := true;
        NEW.distance_from_office := 0;

        IF NOT is_checkout THEN
            -- Check late berdasarkan shift dinamis
            check_in_time_wib := (NEW.check_in_time AT TIME ZONE 'Asia/Jakarta')::TIME;
            is_weekend := EXTRACT(DOW FROM shift_date) IN (0, 6);

            IF is_weekend THEN
                NEW.status := 'present';
            ELSIF check_in_time_wib > late_cutoff THEN
                NEW.status := 'late';
            ELSE
                NEW.status := 'present';
            END IF;
        ELSE
            -- Preserve status from check-in
            NEW.status := OLD.status;

            -- Overtime calculation
            IF NEW.check_in_time IS NOT NULL THEN
                check_in_wib  := NEW.check_in_time AT TIME ZONE 'Asia/Jakarta';
                check_out_wib := NEW.check_out_time AT TIME ZONE 'Asia/Jakarta';
                NEW.work_duration_minutes := EXTRACT(EPOCH FROM (check_out_wib - check_in_wib)) / 60;
                is_weekend := EXTRACT(DOW FROM shift_date) IN (0, 6);

                IF NOT is_weekend AND shift_end_time IS NOT NULL THEN
                    shift_end_ts   := check_out_wib::DATE + shift_end_time;
                    overtime_start := GREATEST(check_in_wib, shift_end_ts);
                    overtime_raw   := EXTRACT(EPOCH FROM (check_out_wib - overtime_start)) / 60;

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
                NEW.work_duration_minutes := NULL;
            END IF;
        END IF;

        RETURN NEW;
    END IF;

    -- ── Geofence validation (driver_kantor & all other roles) ──
    IF office_record.id IS NOT NULL AND calculated_distance > office_record.geofence_radius THEN
        -- Block check-out if outside the geofence radius
        IF is_checkout THEN
            RAISE EXCEPTION 'Check-out gagal: Anda berada di luar radius area kantor (% meter dari batas)', round((calculated_distance - office_record.geofence_radius)::numeric, 2);
        END IF;
        NEW.is_valid := false;
        NEW.status := 'outside_radius';
    ELSE
        NEW.is_valid := true;

        IF NOT is_checkout THEN
            -- ── PERBAIKAN BUG: Late check berdasarkan shift dinamis ──
            check_in_time_wib := (NEW.check_in_time AT TIME ZONE 'Asia/Jakarta')::TIME;
            is_weekend := EXTRACT(DOW FROM shift_date) IN (0, 6);

            IF is_weekend THEN
                -- Weekend: tidak ada pengecekan keterlambatan
                NEW.status := 'present';
            ELSIF check_in_time_wib > late_cutoff THEN
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
                check_in_wib  := NEW.check_in_time AT TIME ZONE 'Asia/Jakarta';
                check_out_wib := NEW.check_out_time AT TIME ZONE 'Asia/Jakarta';

                -- Work duration (total minutes between check-in and check-out)
                NEW.work_duration_minutes := EXTRACT(EPOCH FROM (check_out_wib - check_in_wib)) / 60;

                -- Check weekend (0 = Sunday, 6 = Saturday)
                is_weekend := EXTRACT(DOW FROM shift_date) IN (0, 6);

                -- Only calculate overtime on weekdays
                IF NOT is_weekend AND shift_end_time IS NOT NULL THEN
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
                NEW.work_duration_minutes := NULL;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
