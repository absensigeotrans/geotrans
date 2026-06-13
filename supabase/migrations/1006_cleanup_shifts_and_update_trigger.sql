-- Migration: Cleanup Legacy Shifts & Update Late Thresholds
-- Created: 2026-05-21
-- Purpose:
--   1. Drop legacy shifts & user_shifts tables
--   2. Rewrite attendance trigger with 3 work types:
--      - Non-Shifting (Full Time): 07:00-16:00, late > 07:03
--      - Shift Pagi: 06:00-14:00, late > 06:03
--      - Shift Siang: 10:00-18:00, late > 10:03
--   3. Driver: non-shifting rules, bebas radius
--   4. Grace period: 3 menit (fixed)

-- ============================================================
-- BAGIAN A: Hapus tabel legacy
-- ============================================================

-- Drop triggers yang refer ke shifts
DROP TRIGGER IF EXISTS update_shifts_updated_at ON public.shifts;

-- Drop RLS policies untuk shifts & user_shifts
DROP POLICY IF EXISTS "shifts_admin" ON public.shifts;
DROP POLICY IF EXISTS "shifts_view" ON public.shifts;
DROP POLICY IF EXISTS "user_shifts_select" ON public.user_shifts;
DROP POLICY IF EXISTS "user_shifts_admin" ON public.user_shifts;

-- Drop shift_id dari attendance (FK ke shifts yang akan dihapus)
ALTER TABLE public.attendance DROP COLUMN IF EXISTS shift_id;

-- Drop tabel legacy
DROP TABLE IF EXISTS public.user_shifts CASCADE;
DROP TABLE IF EXISTS public.shifts CASCADE;

-- ============================================================
-- BAGIAN B: Rewrite trigger validate_attendance_geofence()
-- ============================================================

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

    -- Viewer & Admin tidak boleh absen
    IF user_role IN ('viewer', 'admin', 'inactive') THEN
        RAISE EXCEPTION 'Absensi ditolak: Role % tidak diizinkan untuk melakukan absensi', user_role;
    END IF;

    -- Get the date for shift lookup
    shift_date := DATE(NEW.check_in_time);

    -- Check if weekend (0 = Sunday, 6 = Saturday)
    is_weekend := EXTRACT(DOW FROM shift_date) IN (0, 6);

    -- Get user's shift for today (prioritas: daily schedule > profile shift_type)
    SELECT shift_type INTO user_shift
    FROM user_shift_schedules
    WHERE user_id = NEW.user_id
        AND schedule_date = shift_date
    LIMIT 1;

    -- Jika tidak ada daily schedule, cek profiles.shift_type
    IF user_shift IS NULL THEN
        SELECT shift_type INTO user_shift FROM public.profiles WHERE id = NEW.user_id;
    END IF;

    -- Determine late threshold berdasarkan shift type
    IF user_shift = 'morning' THEN
        late_threshold := '06:03:00'::time;
    ELSIF user_shift = 'afternoon' THEN
        late_threshold := '10:03:00'::time;
    ELSE
        -- Non-shifting (Full Time): 07:00-16:00, late > 07:03
        late_threshold := '07:03:00'::time;
    END IF;

    -- Driver: bebas radius (tidak wajib dalam geofence)
    IF user_role = 'driver' THEN
        NEW.is_valid := true;
        NEW.distance_from_office := 0;

        -- Tetap kena late check non-shifting
        IF NOT is_checkout THEN
            IF is_weekend THEN
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

        -- REJECT kalau di luar radius
        IF calculated_distance > office_record.geofence_radius THEN
            RAISE EXCEPTION 'Absensi ditolak: Role % wajib absen di dalam radius kantor. Jarak Anda: %.0f meter (maksimal: % meter)',
                user_role, calculated_distance, office_record.geofence_radius;
        END IF;

        NEW.is_valid := true;

        -- Check if late (skip on weekend)
        IF NOT is_checkout THEN
            IF is_weekend THEN
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

    -- Default fallback
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- BAGIAN C: Update get_dashboard_analytics()
-- ============================================================

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
          EXTRACT(EPOCH FROM (check_in_time::TIME - INTERVAL '7 hours')) / 60
        ) FILTER (WHERE check_in_time::TIME > '07:00:00'),
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
