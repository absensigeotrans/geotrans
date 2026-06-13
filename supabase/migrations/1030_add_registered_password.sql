-- Migration: Add registered_password to profiles and update handle_new_user trigger
-- Created: 2026-06-12

-- 1. Add registered_password column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS registered_password TEXT;

-- 2. Update handle_new_user() trigger function to capture raw password from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_role TEXT;
    v_shift_type TEXT;
    v_emp_id TEXT;
    v_reg_password TEXT;
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

    v_emp_id := NULLIF(NEW.raw_user_meta_data->>'employee_id', '');
    v_reg_password := NULLIF(NEW.raw_user_meta_data->>'registered_password', '');

    -- Raise clean custom exception if employee_id already exists to prevent generic DB crash message
    IF v_emp_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.profiles WHERE employee_id = v_emp_id
    ) THEN
        RAISE EXCEPTION 'NIK/ID Karyawan (%) sudah terdaftar. Silakan hubungi Admin.', v_emp_id;
    END IF;

    INSERT INTO public.profiles (id, email, full_name, role, employee_id, nik, shift_type, registered_password, is_active)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), NEW.email),
        v_role,
        v_emp_id,
        NULLIF(NEW.raw_user_meta_data->>'nik', ''),
        v_shift_type,
        v_reg_password,
        true
    )
    ON CONFLICT (id) DO UPDATE
    SET registered_password = EXCLUDED.registered_password;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
