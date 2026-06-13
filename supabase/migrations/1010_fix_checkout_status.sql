-- Fix checkout status bug: preserve original status (late/present) from check-in
-- Previously, checkout always overwrote status to 'present'

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
        
        -- Check if late - using WIB timezone
        IF NOT is_checkout THEN
            -- Extract hour and minute in WIB timezone
            check_in_hour := EXTRACT(HOUR FROM NEW.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta');
            check_in_minute := EXTRACT(MINUTE FROM NEW.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta');
            
            IF check_in_hour > COALESCE(settings_record.late_threshold_hour, 9)
               OR (check_in_hour = COALESCE(settings_record.late_threshold_hour, 9)
                   AND check_in_minute >= COALESCE(settings_record.late_threshold_minute, 0))
            THEN
                NEW.status := 'late';
            ELSE
                NEW.status := 'present';
            END IF;
        ELSE
            -- FIX: Preserve the original status from check-in (late/present)
            NEW.status := OLD.status;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
