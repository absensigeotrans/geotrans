import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { AttendanceStatus, ShiftType } from '@/types';
import { getWIBDateRange } from '@/lib/timezone';

// ─────────────────────────────────────────────────────────────────────────────
// Tipe
// ─────────────────────────────────────────────────────────────────────────────

interface ReportFilters {
  from?: string;
  to?: string;
  status?: AttendanceStatus;
  search?: string;
  isMocked?: boolean;
  excludeOutsideRadius?: boolean; // Untuk role driver — tidak menggunakan geofencing
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

// ─────────────────────────────────────────────────────────────────────────────
// Konstanta
// ─────────────────────────────────────────────────────────────────────────────

/** String SELECT kolom profiles yang digunakan di semua query absensi. */
const PROFILES_SELECT = `
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
` as const;

// ─────────────────────────────────────────────────────────────────────────────
// Helper: terapkan filter tanggal, status, isMocked, excludeOutsideRadius
// ─────────────────────────────────────────────────────────────────────────────
function applyBaseFilters(query: any, filters: ReportFilters): any {
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
  return query;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: cari profile ID berdasarkan kata kunci pencarian.
// Mengembalikan array ID jika ditemukan, null jika tidak ada hasil
// (sinyal agar fungsi pemanggil langsung mengembalikan data kosong).
// ─────────────────────────────────────────────────────────────────────────────
async function resolveSearchProfileIds(search: string): Promise<string[] | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .or(
      `full_name.ilike.%${search}%,` +
      `email.ilike.%${search}%,` +
      `employee_id.ilike.%${search}%`
    );

  if (error) throw error;
  if (!data || data.length === 0) return null;
  return data.map((p) => p.id);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: perkaya data absensi dengan tipe shift aktual dari jadwal harian
// ─────────────────────────────────────────────────────────────────────────────
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
    const checkInDate = new Date(record.check_in_time).toLocaleDateString('en-CA', {
      timeZone: 'Asia/Jakarta',
    });
    const shiftType =
      shiftMap.get(`${record.user_id}|${checkInDate}`) || record.profiles?.shift_type;
    return { ...record, shift_type: shiftType };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook utama
// ─────────────────────────────────────────────────────────────────────────────

export function useReports() {
  const [records, setRecords] = useState<AttendanceWithProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Fetch dengan paginasi (untuk tampilan tabel laporan) ──────────────────
  const fetchReport = useCallback(async (
    filters: ReportFilters = {},
    page = 1,
    limit = 50
  ) => {
    setLoading(true);
    setError(null);
    try {
      // Selesaikan pencarian nama terlebih dahulu agar tidak ada query ganda
      let resolvedProfileIds: string[] | null = null;
      if (filters.search) {
        resolvedProfileIds = await resolveSearchProfileIds(filters.search);
        if (!resolvedProfileIds) {
          setRecords([]);
          return { data: [], count: 0 };
        }
      }

      let query = supabase
        .from('attendance')
        .select(PROFILES_SELECT, { count: 'exact' })
        .order('check_in_time', { ascending: false })
        .range((page - 1) * limit, page * limit - 1);

      query = applyBaseFilters(query, filters);

      if (resolvedProfileIds) {
        query = query.in('user_id', resolvedProfileIds);
      }

      const { data, error: fetchError, count } = await query;
      if (fetchError) throw fetchError;

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

  // ── Wrapper tipis — dipertahankan agar tidak ada breaking change di UI ────
  const fetchReportWithUsers = useCallback(async (
    filters: ReportFilters = {},
    page = 1,
    limit = 50
  ) => {
    return fetchReport(filters, page, limit);
  }, [fetchReport]);

  // ── Fetch SEMUA record tanpa paginasi (untuk ekspor Excel/PDF/CSV) ─────────
  const fetchAllRecords = useCallback(async (
    filters: ReportFilters = {}
  ) => {
    setLoading(true);
    setError(null);
    try {
      let resolvedProfileIds: string[] | null = null;
      if (filters.search) {
        resolvedProfileIds = await resolveSearchProfileIds(filters.search);
        if (!resolvedProfileIds) {
          setRecords([]);
          return { data: [], count: 0 };
        }
      }

      let query = supabase
        .from('attendance')
        .select(PROFILES_SELECT)
        .order('check_in_time', { ascending: false });

      query = applyBaseFilters(query, filters);

      if (resolvedProfileIds) {
        query = query.in('user_id', resolvedProfileIds);
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

  // ── Fetch ringkasan dashboard (N hari terakhir) ───────────────────────────
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

      const result = (data as AttendanceWithProfile[]) || [];
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

  // ── Statistik ringkas dari kumpulan data ──────────────────────────────────
  const getStats = useCallback((data: AttendanceWithProfile[]) => {
    const total = data.length;
    const present = data.filter((r) => r.status === 'present').length;
    const late = data.filter((r) => r.status === 'late').length;
    // outside_radius tetap dilacak secara internal meski tidak ditampilkan di UI
    const outside = data.filter((r) => r.status === 'outside_radius').length;
    const suspicious = data.filter((r) => r.is_mocked).length;
    const avgDistance =
      total > 0
        ? data.reduce((sum, r) => sum + (r.distance_from_office || 0), 0) / total
        : 0;

    return { total, present, late, outside, suspicious, avgDistance };
  }, []);

  // ── Rekapitulasi per karyawan ─────────────────────────────────────────────
  const getEmployeeSummary = useCallback((data: AttendanceWithProfile[]) => {
    const summary: Record<
      string,
      {
        name: string;
        employee_id?: string;
        total: number;
        present: number;
        late: number;
        absent: number; // dihitung — bukan dari record DB
        suspicious: number;
        shifts?: Record<string, number>; // distribusi tipe shift
      }
    > = {};

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

      const shiftType = (record as any).shift_type || 'default';
      summary[uid].shifts![shiftType] = (summary[uid].shifts![shiftType] || 0) + 1;
    });

    // Kalkulasi rate: hanya status "present" yang dihitung sebagai kehadiran penuh
    return Object.entries(summary)
      .map(([uid, stats]) => ({
        user_id: uid,
        ...stats,
        rate: stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0,
      }))
      .sort((a, b) => b.rate - a.rate);
  }, []);

  // ── Label tipe shift untuk tampilan UI ───────────────────────────────────
  const getShiftLabel = (shiftType: string | undefined | null): string => {
    const map: Record<string, string> = {
      morning: 'Pagi',
      afternoon: 'Siang',
      full_time: 'Full Time',
      non_shifting: 'Non-Shifting',
    };
    return shiftType && map[shiftType] ? map[shiftType] : '—';
  };

  // ── Hapus data absensi berdasarkan tanggal (opsional per karyawan) ────────
  const deleteByDate = useCallback(async (date: string, userId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const { start, end } = getWIBDateRange(date);

      let query = supabase
        .from('attendance')
        .delete()
        .gte('check_in_time', start)
        .lte('check_in_time', end);

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { error: deleteError, data: deletedData } = await query.select('id');
      if (deleteError) throw deleteError;

      setRecords([]);
      return {
        success: true,
        message: userId
          ? `Berhasil menghapus data absensi pegawai untuk tanggal ${date}`
          : `Berhasil menghapus ${deletedData?.length || 0} data untuk ${date}`,
        count: deletedData?.length || 0,
      };
    } catch (err: any) {
      const msg = err?.message || err?.details || 'Failed to delete records';
      console.error('deleteByDate catch error:', msg);
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Simpan absensi manual (Insert atau Update) ────────────────────────────
  const saveManualAttendance = useCallback(async (data: Partial<AttendanceWithProfile>) => {
    // Ponytail: Do not toggle global hook loading so the table UI doesn't freeze/flicker
    setError(null);
    try {
      const payload: any = {
        user_id: data.user_id,
        check_in_time: data.check_in_time,
        check_out_time: data.check_out_time || null,
        status: data.status,
        work_status: data.work_status,
        is_valid: true,
        is_mocked: false,
        distance_from_office: 0,
      };

      if (data.id) {
        // Update record yang sudah ada
        const { error: updateError } = await supabase
          .from('attendance')
          .update(payload)
          .eq('id', data.id);
        if (updateError) throw updateError;
        return { success: true, message: 'Berhasil mengubah data absensi' };
      } else {
        // Insert record baru — koordinat diberi nilai 0 untuk entri manual admin
        payload.check_in_latitude = 0;
        payload.check_in_longitude = 0;

        const { error: insertError } = await supabase.from('attendance').insert(payload);
        if (insertError) throw insertError;
        return { success: true, message: 'Berhasil menambahkan data absensi manual' };
      }
    } catch (err: any) {
      const msg = err?.message || 'Gagal menyimpan data absensi';
      console.error('saveManualAttendance catch error:', msg);
      setError(msg);
      return { success: false, error: msg };
    }
  }, []);

  // ── Hapus satu record absensi berdasarkan ID ──────────────────────────────
  const deleteRecord = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const { error: deleteError } = await supabase
        .from('attendance')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      return { success: true, message: 'Berhasil menghapus data absensi' };
    } catch (err: any) {
      const msg = err?.message || err?.details || 'Failed to delete record';
      console.error('deleteRecord catch error:', msg);
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
    deleteRecord,
    saveManualAttendance,
  };
}