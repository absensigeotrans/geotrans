-- Migration: Add submit_forgot_password_request stored procedure for anonymous password reset requests
-- Created: 2026-06-13

CREATE OR REPLACE FUNCTION public.submit_forgot_password_request(
    p_email TEXT,
    p_new_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with postgres privileges to read profiles and insert to password_change_requests
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- 1. Find user_id by email (case-insensitive)
    SELECT id INTO v_user_id
    FROM public.profiles
    WHERE LOWER(email) = LOWER(p_email)
    LIMIT 1;

    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Alamat email tidak terdaftar.'
        );
    END IF;

    -- 2. Insert the request into password_change_requests with status 'pending'
    INSERT INTO public.password_change_requests (user_id, new_password, status)
    VALUES (v_user_id, p_new_password, 'pending');

    RETURN jsonb_build_object(
        'success', true
    );
END;
$$;

-- Grant execution permissions to anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.submit_forgot_password_request(TEXT, TEXT) TO anon, authenticated;
