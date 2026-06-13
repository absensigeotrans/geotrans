import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Attendance, AttendanceStatus, ShiftType } from '@/types';
import { getWIBDateRange } from '@/lib/timezone';

async function enrichWithShiftType(records: any[]): Promise<any[]> {
  if (records.length === 0) return [];

  const userIds = [...new Set(records.map((r) => r.user_id))];
  const dates = [
    ...new Set(
      records.map((r) =>
        new Date(r.check_in_time).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
      )
    ),
  ];

  if (dates.length === 0) {
    return records.map((r) => ({ ...r, shift_type: r.profiles?.shift_type }));
  }

  const minDate = dates.reduce((a, b) => (a < b ? a : b));
  const maxDate = dates.reduce((a, b) => (a > b ? a : b));

  const { data: allShifts } = await supabase
    .from('user_shift_schedules')
    .select('user_id, schedule_date, shift_type')
    .in('user_id', userIds)
    .gte('schedule_date', minDate)
    .lte('schedule_date', maxDate);

  const shiftMap = new Map<string, string>();
  for (const s of allShifts || []) {
    shiftMap.set(`${s.user_id}|${s.schedule_date}`, (s as any).shift_type);
  }

  return records.map((record) => {
    const checkInDate = new Date(record.check_in_time).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
    const shiftType = shiftMap.get(`${record.user_id}|${checkInDate}`) || record.profiles?.shift_type;
    return { ...record, shift_type: shiftType };
  });
}

interface ReportFilters {
  from?: string;
  to?: string;
  status?: AttendanceStatus;
  search?: string;
  isMocked?: boolean;
  excludeOutsideRadius?: boolean; // For driver role - they don't use geofencing
}

interface AttendanceWithProfile {
   id: string;
   user_id: string;
   shift_id?: string;
   office_id?: string;
   check_in_time: string;
   check_in_latitude: number;
   check_in_longitude: number;
   check_in_location_data?: Record<string, unknown>;
   check_out_time?: string | null;
   check_out_latitude?: number | null;
   check_out_longitude?: number | null;
   check_out_location_data?: Record<string, unknown>;
   is_valid: boolean;
   is_mocked: boolean;
   distance_from_office: number;
   status: AttendanceStatus;
   created_at: string;
   updated_at: string;
   shift_type?: ShiftType | null;
   overtime_minutes?: number | null;
   work_duration_minutes?: number | null;
   work_status?: string; // WFH, WFO, DINAS, Lainnya
   profiles?: {
     full_name: string;
     email?: string;
     employee_id?: string;
     nik?: string;
     role?: string;
   };
 }

export function useReports() {
  const [records, setRecords] = useState<AttendanceWithProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async (
    filters: ReportFilters = {},
    page = 1,
    limit = 50
  ) => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('attendance')
        .select(`
          *,
          profiles:user_id (
            id,
            full_name,
            email,
            employee_id,
            nik,
            role,
            shift_type
          )
        `, { count: 'exact' })
        .order('check_in_time', { ascending: false })
        .range((page - 1) * limit, page * limit - 1);

      if (filters.from) {
        const { start } = getWIBDateRange(filters.from);
        query = query.gte('check_in_time', start);
      }
      if (filters.to) {
        const { end } = getWIBDateRange(filters.to);
        query = query.lte('check_in_time', end);
      }
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      if (filters.isMocked !== undefined) {
        query = query.eq('is_mocked', filters.isMocked);
      }
      if (filters.excludeOutsideRadius) {
        query = query.neq('status', 'outside_radius');
      }

      if (filters.search) {
        // Step 1: Pre-fetch profile IDs that match the search string
        const { data: searchProfiles, error: pError } = await supabase
          .from('profiles')
          .select('id')
          .or(`full_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,employee_id.ilike.%${filters.search}%`);
        
        if (pError) throw pError;

        if (searchProfiles && searchProfiles.length > 0) {
          const profileIds = searchProfiles.map(p => p.id);
          query = query.in('user_id', profileIds);
        } else {
          // No profiles found for search term, return empty list
          setRecords([]);
          return { data: [], count: 0 };
        }
      }

      const { data, error: fetchError, count } = await query;
      if (fetchError) throw fetchError;

      // Step 2: Enrich with shift type via single batch query
      const result = await enrichWithShiftType(data || []);

      setRecords(result as AttendanceWithProfile[]);
      return { data: result as AttendanceWithProfile[], count: count || 0 };
    } catch (err: any) {
      console.error('Report fetch error:', err);
      const msg = err?.message || 'Failed to fetch report';
      setError(msg);
      return { data: [], count: 0 };
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchReportWithUsers = useCallback(async (
    filters: ReportFilters = {},
    page = 1,
    limit = 50
  ) => {
    // Re-use fetchReport which now includes profiles
    return fetchReport(filters, page, limit);
  }, [fetchReport]);

  // Fetch ALL records without pagination (for exports)
  const fetchAllRecords = useCallback(async (
    filters: ReportFilters = {}
  ) => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('attendance')
        .select(`
          *,
          profiles:user_id (
            id,
            full_name,
            email,
            employee_id,
            nik,
            role,
            shift_type
          )
        `)
        .order('check_in_time', { ascending: false });

      if (filters.from) {
        const { start } = getWIBDateRange(filters.from);
        query = query.gte('check_in_time', start);
      }
      if (filters.to) {
        const { end } = getWIBDateRange(filters.to);
        query = query.lte('check_in_time', end);
      }
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      if (filters.isMocked !== undefined) {
        query = query.eq('is_mocked', filters.isMocked);
      }
      if (filters.excludeOutsideRadius) {
        query = query.neq('status', 'outside_radius');
      }

      if (filters.search) {
        const { data: searchProfiles, error: pError } = await supabase
          .from('profiles')
          .select('id')
          .or(`full_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,employee_id.ilike.%${filters.search}%`);
        
        if (pError) throw pError;

        if (searchProfiles && searchProfiles.length > 0) {
          const profileIds = searchProfiles.map(p => p.id);
          query = query.in('user_id', profileIds);
        } else {
          setRecords([]);
          return { data: [], count: 0 };
        }
      }

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;

      const result = await enrichWithShiftType(data || []);

      setRecords(result as AttendanceWithProfile[]);
      return { data: result as AttendanceWithProfile[], count: result.length };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch all records';
      setError(msg);
      return { data: [], count: 0 };
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch dashboard summary data
  const fetchDashboardData = useCallback(async (days = 30) => {
    setLoading(true);
    setError(null);
    try {
      const fromWIB = new Date();
      fromWIB.setDate(fromWIB.getDate() - days);
      const fromDateStr = fromWIB.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
      const { start: fromISO } = getWIBDateRange(fromDateStr);

      const { data, error: fetchError } = await supabase
        .from('attendance')
        .select(`
          *,
          profiles:user_id (
            id,
            full_name,
            email,
            employee_id,
            nik,
            role
          )
        `)
        .gte('check_in_time', fromISO)
        .order('check_in_time', { ascending: false });

      if (fetchError) throw fetchError;

      const result = data as AttendanceWithProfile[] || [];
      setRecords(result);
      return { data: result, count: result.length };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch dashboard data';
      setError(msg);
      return { data: [], count: 0 };
    } finally {
      setLoading(false);
    }
  }, []);


  const getStats = useCallback((data: AttendanceWithProfile[]) => {
    const total = data.length;
    const present = data.filter((r) => r.status === 'present').length;
    const late = data.filter((r) => r.status === 'late').length;
    // Note: outside_radius still tracked internally but not displayed in UI
    const outside = data.filter((r) => r.status === 'outside_radius').length;
    const suspicious = data.filter((r) => r.is_mocked).length;
    const avgDistance = total > 0
      ? data.reduce((sum, r) => sum + (r.distance_from_office || 0), 0) / total
      : 0;

    // UI displays only: total, present, late, suspicious, avgDistance
    return { total, present, late, outside, suspicious, avgDistance };
  }, []);

  // Get employee-wise summary
  const getEmployeeSummary = useCallback((data: AttendanceWithProfile[]) => {
    const summary: Record<string, {
      name: string;
      employee_id?: string;
      total: number;
      present: number;
      late: number;
      absent: number; // calculated - not from records
      suspicious: number;
      shifts?: Record<string, number>; // shift type counts
    }> = {};

    data.forEach((record) => {
      const uid = record.user_id;
      if (!summary[uid]) {
        summary[uid] = {
          name: record.profiles?.full_name || 'Unknown',
          employee_id: record.profiles?.employee_id,
          total: 0,
          present: 0,
          late: 0,
          absent: 0,
          suspicious: 0,
          shifts: {},
        };
      }
      summary[uid].total++;
      if (record.status === 'present') summary[uid].present++;
      if (record.status === 'late') summary[uid].late++;
      if (record.is_mocked) summary[uid].suspicious++;

      // Track shift distribution
      const shiftType = (record as any).shift_type || 'default';
      summary[uid].shifts![shiftType] = (summary[uid].shifts![shiftType] || 0) + 1;
    });

    // Note: absent is calculated based on working days vs attendance records
    return Object.entries(summary).map(([uid, stats]) => ({
      user_id: uid,
      ...stats,
      // Rate calculation: only present counts, late is separate
      rate: stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0,
    })).sort((a, b) => b.rate - a.rate);
  }, []);

  // Get shift label from shift type
  const getShiftLabel = (shiftType: string | undefined | null): string => {
    const map: Record<string, string> = {
      morning: 'Pagi',
      afternoon: 'Siang',
      full_time: 'Full Time',
      non_shifting: 'Non-Shifting',
    };
    return shiftType && map[shiftType] ? map[shiftType] : '—';
  };

  // Delete all attendance records for a specific date
  const deleteByDate = useCallback(async (date: string) => {
    setLoading(true);
    setError(null);
    try {
      const { start, end } = getWIBDateRange(date);


       const { error: deleteError, data: deletedData } = await supabase
          .from('attendance')
          .delete()
          .gte('check_in_time', start)
          .lte('check_in_time', end)
          .select('id');

       if (deleteError) {
         throw deleteError;
       }

      // Clear local records since data changed
      setRecords([]);
      return { success: true, message: `Berhasil menghapus ${deletedData?.length || 0} data untuk ${date}`, count: deletedData?.length || 0 };
    } catch (err: any) {
      const msg = err?.message || err?.details || 'Failed to delete records';
      console.error('deleteByDate catch error:', msg);
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    records,
    loading,
    error,
    fetchReport,
    fetchReportWithUsers,
    fetchAllRecords,
    fetchDashboardData,
    getStats,
    getEmployeeSummary,
    getShiftLabel,
    deleteByDate,
  };
}