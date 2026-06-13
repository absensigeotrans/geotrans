'use client';

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Attendance } from '@/types';
import { getWIBStartOfDay, getWIBEndOfDay } from '@/lib/timezone';

interface UseAttendanceReturn {
  todayAttendance: Attendance | null;
  history: Attendance[];
  loading: boolean;
  error: string | null;
  clockIn: (latitude: number, longitude: number) => Promise<{ success: boolean; error?: string }>;
  clockOut: (attendanceId: string) => Promise<{ success: boolean; error?: string }>;
  fetchTodayAttendance: () => Promise<void>;
  fetchHistory: (limit?: number) => Promise<void>;
}

export function useAttendance(): UseAttendanceReturn {
  const [todayAttendance, setTodayAttendance] = useState<Attendance | null>(null);
  const [history, setHistory] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTodayAttendance = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const todayStart = getWIBStartOfDay();
      const { data, error: fetchError } = await supabase
        .from('attendance')
        .select('*')
        .gte('check_in_time', todayStart)
        .order('check_in_time', { ascending: false })
        .limit(1)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Fetch today attendance error details:', {
          code: fetchError.code,
          message: fetchError.message,
          details: fetchError.details,
          hint: fetchError.hint
        });
        throw fetchError;
      }

      setTodayAttendance((data as Attendance | null) ?? null);
    } catch (err) {
      console.error('Fetch attendance error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch attendance');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchHistory = useCallback(async (limit = 100) => {
    setLoading(true);
    setError(null);

    try {
      // Fetch attendance with user profile info
      const { data, error: fetchError } = await supabase
        .from('attendance')
        .select(`
          *,
          profiles:user_id (
            id,
            full_name,
            employee_id,
            nik
          )
        `)
        .order('check_in_time', { ascending: false })
        .limit(limit);

      if (fetchError) {
        console.error('Fetch history error details:', {
          code: fetchError.code,
          message: fetchError.message,
          details: fetchError.details,
          hint: fetchError.hint
        });
        throw fetchError;
      }

      setHistory((data as Attendance[]) || []);
    } catch (err) {
      console.error('History fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch history');
    } finally {
      setLoading(false);
    }
  }, []);

  const clockIn = useCallback(async (latitude: number, longitude: number) => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: insertError } = await supabase
        .from('attendance')
        .insert([{
          check_in_time: new Date().toISOString(),
          check_in_latitude: latitude,
          check_in_longitude: longitude,
          distance_from_office: 0,
          is_valid: true,
          is_mocked: false,
        }])
        .select()
        .single();

      if (insertError) {
        console.error('Clock in error details:', {
          code: insertError.code,
          message: insertError.message,
          details: insertError.details,
          hint: insertError.hint
        });
        throw insertError;
      }

      setTodayAttendance(data as Attendance);
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to clock in';
      setError(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  }, []);

  const clockOut = useCallback(async (attendanceId: string) => {
    setLoading(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('attendance')
        .update({ check_out_time: new Date().toISOString() })
        .eq('id', attendanceId);

      if (updateError) {
        console.error('Clock out error details:', {
          code: updateError.code,
          message: updateError.message,
          details: updateError.details,
          hint: updateError.hint
        });
        throw updateError;
      }

      await fetchTodayAttendance();
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to clock out';
      setError(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  }, [fetchTodayAttendance]);

  return {
    todayAttendance,
    history,
    loading,
    error,
    clockIn,
    clockOut,
    fetchTodayAttendance,
    fetchHistory,
  };
}
