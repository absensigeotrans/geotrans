-- Migration: 1037_announcements_and_fcm_tokens.sql
-- Description: Create tables and functions for 1-way announcements, read receipts, and FCM tokens.

-- 1. Create announcements table
CREATE TABLE IF NOT EXISTS public.announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'important', 'urgent')),
    target_type TEXT NOT NULL DEFAULT 'ALL' CHECK (target_type IN ('ALL', 'DEPARTMENT', 'USERS')),
    target_values JSONB DEFAULT '[]'::jsonb,
    author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create announcement_reads table (Read receipts tracking)
CREATE TABLE IF NOT EXISTS public.announcement_reads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    announcement_id UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (announcement_id, user_id)
);

-- 3. Create user_fcm_tokens table
CREATE TABLE IF NOT EXISTS public.user_fcm_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    fcm_token TEXT NOT NULL,
    device_type TEXT DEFAULT 'android',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, fcm_token)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON public.announcements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcement_reads_user_id ON public.announcement_reads(user_id);
CREATE INDEX IF NOT EXISTS idx_announcement_reads_announcement_id ON public.announcement_reads(announcement_id);
CREATE INDEX IF NOT EXISTS idx_user_fcm_tokens_user_id ON public.user_fcm_tokens(user_id);

-- Enable RLS
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_fcm_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies for announcements
-- Admins can do everything
CREATE POLICY "Admins full access on announcements" ON public.announcements
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

-- All authenticated users can read announcements
CREATE POLICY "Users view targeted announcements" ON public.announcements
    FOR SELECT TO authenticated
    USING (
        expires_at IS NULL OR expires_at > NOW()
    );

-- RLS Policies for announcement_reads
CREATE POLICY "Users can insert their own read status" ON public.announcement_reads
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users and admins view read status" ON public.announcement_reads
    FOR SELECT TO authenticated
    USING (
        auth.uid() = user_id OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

-- RLS Policies for user_fcm_tokens
CREATE POLICY "Users manage their own fcm tokens" ON public.user_fcm_tokens
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Helper RPC function: Get announcements for current user with read status
CREATE OR REPLACE FUNCTION public.get_user_announcements()
RETURNS TABLE (
    id UUID,
    title TEXT,
    body TEXT,
    priority TEXT,
    target_type TEXT,
    target_values JSONB,
    author_id UUID,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    is_read BOOLEAN,
    read_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_user_dept TEXT;
BEGIN
    SELECT department INTO v_user_dept FROM public.profiles WHERE id = v_user_id;

    RETURN QUERY
    SELECT 
        a.id,
        a.title,
        a.body,
        a.priority,
        a.target_type,
        a.target_values,
        a.author_id,
        a.expires_at,
        a.created_at,
        (ar.id IS NOT NULL) AS is_read,
        ar.read_at
    FROM public.announcements a
    LEFT JOIN public.announcement_reads ar 
        ON a.id = ar.announcement_id AND ar.user_id = v_user_id
    WHERE (a.expires_at IS NULL OR a.expires_at > NOW())
      AND (
          a.target_type = 'ALL'
          OR (a.target_type = 'DEPARTMENT' AND a.target_values ? COALESCE(v_user_dept, ''))
          OR (a.target_type = 'USERS' AND a.target_values ? v_user_id::text)
      )
    ORDER BY a.created_at DESC;
END;
$$;

-- Helper RPC function: Mark announcement as read
CREATE OR REPLACE FUNCTION public.mark_announcement_read(p_announcement_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.announcement_reads (announcement_id, user_id, read_at)
    VALUES (p_announcement_id, auth.uid(), NOW())
    ON CONFLICT (announcement_id, user_id) 
    DO UPDATE SET read_at = NOW();
END;
$$;

-- Helper RPC function: Upsert user FCM token
CREATE OR REPLACE FUNCTION public.save_user_fcm_token(p_fcm_token TEXT, p_device_type TEXT DEFAULT 'android')
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.user_fcm_tokens (user_id, fcm_token, device_type, updated_at)
    VALUES (auth.uid(), p_fcm_token, p_device_type, NOW())
    ON CONFLICT (user_id, fcm_token)
    DO UPDATE SET updated_at = NOW(), device_type = p_device_type;
END;
$$;
