-- Migration: Create driver_role_requests table and its RLS policies & triggers
-- Created: 2026-06-12

CREATE TABLE IF NOT EXISTS public.driver_role_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    from_role TEXT NOT NULL CHECK (from_role IN ('driver_bebas', 'driver_kantor')),
    to_role TEXT NOT NULL CHECK (to_role IN ('driver_bebas', 'driver_kantor')),
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    admin_notes TEXT,
    approved_by UUID REFERENCES public.profiles(id),
    approved_at TIMESTAMPTZ,
    rejected_by UUID REFERENCES public.profiles(id),
    rejected_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.driver_role_requests ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "driver_role_requests_select_own" ON public.driver_role_requests;
CREATE POLICY "driver_role_requests_select_own" ON public.driver_role_requests
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "driver_role_requests_insert_own" ON public.driver_role_requests;
CREATE POLICY "driver_role_requests_insert_own" ON public.driver_role_requests
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "driver_role_requests_delete_own" ON public.driver_role_requests;
CREATE POLICY "driver_role_requests_delete_own" ON public.driver_role_requests
    FOR DELETE USING (auth.uid() = user_id AND status = 'pending');

DROP POLICY IF EXISTS "driver_role_requests_admin_all" ON public.driver_role_requests;
CREATE POLICY "driver_role_requests_admin_all" ON public.driver_role_requests
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Trigger
CREATE OR REPLACE FUNCTION public.handle_driver_role_approval()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status = 'pending' AND NEW.status = 'approved' THEN
        UPDATE public.profiles
        SET role = NEW.to_role,
            updated_at = NOW()
        WHERE id = NEW.user_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS handle_driver_role_approval ON public.driver_role_requests;
CREATE TRIGGER handle_driver_role_approval
    AFTER UPDATE OF status ON public.driver_role_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_driver_role_approval();
