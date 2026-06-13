-- Migration: 1025_secure_rls_and_triggers.sql
-- Purpose: Close critical security vulnerabilities discovered in code review.
-- 1. Prevent role escalation via profiles table
-- 2. Prevent employees from manipulating their own attendance records
-- 3. Prevent employees from bypassing leave request approval

-- ============================================================
-- 1. PROTECT PROFILES TABLE - Prevent Role Escalation
-- ============================================================
-- Problem: Any authenticated user can update their own profile row,
-- including sensitive columns like "role", "is_owner", "can_manage_accounts".
-- This, combined with the sync_profile_role_to_auth trigger, allows
-- a regular employee to instantly become an Admin.

CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS TRIGGER AS $$
BEGIN
    -- Block any change to privileged columns by non-admins
    IF NOT public.is_admin() THEN
        -- If role is changing, block it
        IF OLD.role IS DISTINCT FROM NEW.role THEN
            RAISE EXCEPTION 'Akses ditolak: Tidak dapat mengubah role pengguna.';
        END IF;
        -- If is_owner is changing, block it
        IF OLD.is_owner IS DISTINCT FROM NEW.is_owner THEN
            RAISE EXCEPTION 'Akses ditolak: Tidak dapat mengubah status is_owner.';
        END IF;
        -- If can_manage_accounts is changing, block it
        IF OLD.can_manage_accounts IS DISTINCT FROM NEW.can_manage_accounts THEN
            RAISE EXCEPTION 'Akses ditolak: Tidak dapat mengubah hak kelola akun.';
        END IF;
        -- If is_viewer is changing, block it
        IF OLD.is_viewer IS DISTINCT FROM NEW.is_viewer THEN
            RAISE EXCEPTION 'Akses ditolak: Tidak dapat mengubah status is_viewer.';
        END IF;
        -- If is_active is changing, block it (admin should manage this)
        IF OLD.is_active IS DISTINCT FROM NEW.is_active THEN
            RAISE EXCEPTION 'Akses ditolak: Tidak dapat mengubah status is_active.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS prevent_role_escalation ON public.profiles;
CREATE TRIGGER prevent_role_escalation
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_role_escalation();

-- ============================================================
-- 2. PROTECT ATTENDANCE TABLE - Prevent Attendance Manipulation
-- ============================================================
-- Problem: Employees can freely UPDATE any column of their own attendance rows.
-- An employee who checked in at 10:00 (late) can change check_in_time to 08:00,
-- change status to 'present', and falsify their location data.

CREATE OR REPLACE FUNCTION public.secure_attendance_update()
RETURNS TRIGGER AS $$
BEGIN
    -- Only enforce restrictions on non-admin users
    IF NOT public.is_admin() THEN
        -- Block changes to check-in time
        IF OLD.check_in_time IS DISTINCT FROM NEW.check_in_time THEN
            RAISE EXCEPTION 'Akses ditolak: Waktu check-in tidak dapat diubah.';
        END IF;
        -- Block changes to check-in location
        IF OLD.check_in_latitude IS DISTINCT FROM NEW.check_in_latitude OR
           OLD.check_in_longitude IS DISTINCT FROM NEW.check_in_longitude THEN
            RAISE EXCEPTION 'Akses ditolak: Lokasi check-in tidak dapat diubah.';
        END IF;
        -- Block changes to attendance status
        IF OLD.status IS DISTINCT FROM NEW.status THEN
            RAISE EXCEPTION 'Akses ditolak: Status absensi tidak dapat diubah secara manual.';
        END IF;
        -- Block changes to validity flag
        IF OLD.is_valid IS DISTINCT FROM NEW.is_valid THEN
            RAISE EXCEPTION 'Akses ditolak: Validitas absensi tidak dapat diubah secara manual.';
        END IF;
        -- Block changes to is_mocked flag
        IF OLD.is_mocked IS DISTINCT FROM NEW.is_mocked THEN
            RAISE EXCEPTION 'Akses ditolak: Flag is_mocked tidak dapat diubah.';
        END IF;
        -- Block changing check_out_time if it has already been set
        -- (Employees should only be able to check out once)
        IF OLD.check_out_time IS NOT NULL AND OLD.check_out_time IS DISTINCT FROM NEW.check_out_time THEN
            RAISE EXCEPTION 'Akses ditolak: Waktu check-out sudah tercatat dan tidak dapat diubah lagi.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS secure_attendance_update ON public.attendance;
CREATE TRIGGER secure_attendance_update
    BEFORE UPDATE ON public.attendance
    FOR EACH ROW
    EXECUTE FUNCTION public.secure_attendance_update();

-- ============================================================
-- 3. PROTECT LEAVE REQUESTS TABLE - Prevent Approval Bypass
-- ============================================================
-- Problem: Employees can INSERT a leave request with status='approved',
-- or UPDATE a pending request to change status='approved' without Admin review.

CREATE OR REPLACE FUNCTION public.secure_leave_requests()
RETURNS TRIGGER AS $$
BEGIN
    -- On INSERT: force status to 'pending' for non-admins
    IF TG_OP = 'INSERT' THEN
        IF NOT public.is_admin() THEN
            NEW.status := 'pending';
            NEW.approved_by := NULL;
            NEW.approved_at := NULL;
            NEW.admin_notes := NULL;
        END IF;
    END IF;

    -- On UPDATE: block non-admins from changing approval-related columns
    IF TG_OP = 'UPDATE' THEN
        IF NOT public.is_admin() THEN
            -- Block status changes (only admin can approve/reject)
            IF OLD.status IS DISTINCT FROM NEW.status THEN
                -- Allow cancellation of a pending request by the user themselves
                IF OLD.status = 'pending' AND NEW.status = 'cancelled' THEN
                    -- This is allowed - employee can cancel their own pending request
                    NULL;
                ELSE
                    RAISE EXCEPTION 'Akses ditolak: Status cuti hanya dapat diubah oleh Admin.';
                END IF;
            END IF;
            -- Block changes to admin-only fields
            IF OLD.approved_by IS DISTINCT FROM NEW.approved_by THEN
                RAISE EXCEPTION 'Akses ditolak: Kolom approved_by hanya dapat diubah oleh Admin.';
            END IF;
            IF OLD.approved_at IS DISTINCT FROM NEW.approved_at THEN
                RAISE EXCEPTION 'Akses ditolak: Kolom approved_at hanya dapat diubah oleh Admin.';
            END IF;
            IF OLD.admin_notes IS DISTINCT FROM NEW.admin_notes THEN
                RAISE EXCEPTION 'Akses ditolak: Catatan Admin hanya dapat diisi oleh Admin.';
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS secure_leave_requests ON public.leave_requests;
CREATE TRIGGER secure_leave_requests
    BEFORE INSERT OR UPDATE ON public.leave_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.secure_leave_requests();

-- ============================================================
-- Done
-- Apply this migration with: npx supabase db push
-- ============================================================
