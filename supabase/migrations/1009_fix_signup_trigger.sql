-- Fix signup bug: handle empty shift_type and drop stale CHECK constraints

-- 1. Drop stale CHECK constraints from old migrations that may still be active
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_shift_type_check;

-- 2. Update handle_new_user trigger to handle empty strings properly
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_role TEXT;
    v_shift_type TEXT;
BEGIN
    IF NEW.raw_user_meta_data IS NULL THEN
        RETURN NEW;
    END IF;

    -- Handle role: default to 'juru_parkir' if empty or null
    v_role := NULLIF(NEW.raw_user_meta_data->>'role', '');
    IF v_role IS NULL THEN
        v_role := 'juru_parkir';
    END IF;

    -- Handle shift_type: default to 'non_shifting' if empty or null
    v_shift_type := NULLIF(NEW.raw_user_meta_data->>'shift_type', '');
    IF v_shift_type IS NULL THEN
        v_shift_type := 'non_shifting';
    END IF;

    INSERT INTO public.profiles (id, email, full_name, role, employee_id, nik, shift_type, is_active)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), NEW.email),
        v_role,
        NULLIF(NEW.raw_user_meta_data->>'employee_id', ''),
        NULLIF(NEW.raw_user_meta_data->>'nik', ''),
        v_shift_type,
        true
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
