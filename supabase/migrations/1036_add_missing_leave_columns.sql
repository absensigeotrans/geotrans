-- Migration: Add missing leave columns admin_note and responded_at
-- Created: 2026-08-03

ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS admin_note TEXT;
ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS responded_at TIMESTAMPTZ;
