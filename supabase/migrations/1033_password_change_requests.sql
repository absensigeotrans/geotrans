-- Migration: Create password_change_requests table and security policies
-- Created: 2026-06-12

CREATE TABLE IF NOT EXISTS public.password_change_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    new_password TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    admin_notes TEXT,
    approved_by UUID REFERENCES public.profiles(id),
    approved_at TIMESTAMPTZ,
    rejected_by UUID REFERENCES public.profiles(id),
    rejected_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.password_change_requests ENABLE ROW LEVEL SECURITY;

-- 1. Karyawan hanya bisa melihat pengajuannya sendiri
DROP POLICY IF EXISTS "password_requests_select_own" ON public.password_change_requests;
CREATE POLICY "password_requests_select_own" ON public.password_change_requests
    FOR SELECT USING (auth.uid() = user_id);

-- 2. Karyawan hanya bisa mengajukan untuk dirinya sendiri
DROP POLICY IF EXISTS "password_requests_insert_own" ON public.password_change_requests;
CREATE POLICY "password_requests_insert_own" ON public.password_change_requests
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 3. Admin memiliki akses penuh
DROP POLICY IF EXISTS "password_requests_admin_all" ON public.password_change_requests;
CREATE POLICY "password_requests_admin_all" ON public.password_change_requests
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );
