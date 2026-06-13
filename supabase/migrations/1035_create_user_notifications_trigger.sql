-- Migration: Create user_notifications table and its triggers for automated notification creation
-- Created: 2026-06-13

CREATE TABLE IF NOT EXISTS public.user_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

-- Policies for user_notifications
DROP POLICY IF EXISTS "user_notifications_select_own" ON public.user_notifications;
CREATE POLICY "user_notifications_select_own" ON public.user_notifications
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_notifications_update_own" ON public.user_notifications;
CREATE POLICY "user_notifications_update_own" ON public.user_notifications
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_notifications_delete_own" ON public.user_notifications;
CREATE POLICY "user_notifications_delete_own" ON public.user_notifications
    FOR DELETE USING (auth.uid() = user_id);

-- Trigger for leave_requests
CREATE OR REPLACE FUNCTION public.notify_leave_request_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status != NEW.status THEN
        IF NEW.status = 'approved' THEN
            INSERT INTO public.user_notifications (user_id, title, message)
            VALUES (
                NEW.user_id,
                '✅ Pengajuan Cuti Disetujui',
                'Pengajuan cuti Anda dari tanggal ' || to_char(NEW.start_date, 'DD-MM-YYYY') || ' s/d ' || to_char(NEW.end_date, 'DD-MM-YYYY') || ' telah disetujui oleh Admin.'
            );
        ELSIF NEW.status = 'rejected' THEN
            INSERT INTO public.user_notifications (user_id, title, message)
            VALUES (
                NEW.user_id,
                '❌ Pengajuan Cuti Ditolak',
                'Pengajuan cuti Anda dari tanggal ' || to_char(NEW.start_date, 'DD-MM-YYYY') || ' s/d ' || to_char(NEW.end_date, 'DD-MM-YYYY') || ' telah ditolak oleh Admin.' || COALESCE(' Catatan: ' || NEW.admin_note, '')
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS notify_leave_request_status_change ON public.leave_requests;
CREATE TRIGGER notify_leave_request_status_change
    AFTER UPDATE OF status ON public.leave_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_leave_request_status_change();

-- Trigger for driver_role_requests
CREATE OR REPLACE FUNCTION public.notify_driver_role_request_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status != NEW.status THEN
        IF NEW.status = 'approved' THEN
            INSERT INTO public.user_notifications (user_id, title, message)
            VALUES (
                NEW.user_id,
                '✅ Pengajuan Ganti Jenis Driver Disetujui',
                'Pengajuan ganti jenis driver Anda menjadi ' || 
                (CASE WHEN NEW.to_role = 'driver_bebas' THEN 'Driver Bebas' ELSE 'Driver Kantor' END) || 
                ' telah disetujui oleh Admin.'
            );
        ELSIF NEW.status = 'rejected' THEN
            INSERT INTO public.user_notifications (user_id, title, message)
            VALUES (
                NEW.user_id,
                '❌ Pengajuan Ganti Jenis Driver Ditolak',
                'Pengajuan ganti jenis driver Anda telah ditolak oleh Admin.' || COALESCE(' Catatan: ' || NEW.admin_notes, '')
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS notify_driver_role_request_status_change ON public.driver_role_requests;
CREATE TRIGGER notify_driver_role_request_status_change
    AFTER UPDATE OF status ON public.driver_role_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_driver_role_request_status_change();
