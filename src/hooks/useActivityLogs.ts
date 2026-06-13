import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { AttendanceLog } from '@/types';

export function useActivityLogs() {
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async (
    page = 1,
    limit = 50,
    from?: string,
    to?: string
  ) => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('attendance_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range((page - 1) * limit, page * limit - 1);

      if (from) {
        query = query.gte('created_at', from);
      }
      if (to) {
        const toDate = new Date(to);
        toDate.setDate(toDate.getDate() + 1);
        query = query.lt('created_at', toDate.toISOString());
      }

      const { data, error: fetchError, count } = await query;
      if (fetchError) throw fetchError;

      setLogs(data as AttendanceLog[] || []);
      return { data: data as AttendanceLog[], count: count || 0 };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch logs';
      setError(msg);
      return { data: [], count: 0 };
    } finally {
      setLoading(false);
    }
  }, []);

  return { logs, loading, error, fetchLogs };
}