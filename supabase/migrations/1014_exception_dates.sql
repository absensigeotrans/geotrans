-- Migration: Create global and per-user exception dates
-- Created: 2026-05-26
-- Purpose:
--   Allow admin to mark specific dates as "holiday" or "day off"
--   so they are excluded from attendance calculations (treated like weekends).
--   Supports both global (all employees) and per-user (individual off days).

-- Global exception dates (applies to all employees)
CREATE TABLE IF NOT EXISTS global_exception_dates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    date DATE NOT NULL,
    reason TEXT,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_global_exception_dates_date ON global_exception_dates(date);

-- Per-user exception dates (individual off days)
CREATE TABLE IF NOT EXISTS user_exception_dates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) NOT NULL,
    date DATE NOT NULL,
    reason TEXT,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_exception_dates_user_date ON user_exception_dates(user_id, date);

-- Enable RLS
ALTER TABLE global_exception_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_exception_dates ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admin all access global_exception_dates"
    ON global_exception_dates
    FOR ALL
    USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admin all access user_exception_dates"
    ON user_exception_dates
    FOR ALL
    USING (auth.jwt() ->> 'role' = 'admin');

-- Authenticated users can read
CREATE POLICY "Authenticated can read global_exception_dates"
    ON global_exception_dates
    FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated can read user_exception_dates"
    ON user_exception_dates
    FOR SELECT
    USING (auth.role() = 'authenticated');
