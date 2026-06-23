'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Attendance, Profile } from '@/types';
import { getWIBDaysAgo, getWIBDate } from '@/lib/timezone';

export type Period = '7d' | '30d' | 'custom';

export interface EmployeeStat {
  id: string;
  fullName: string;
  present: number;
  late: number;
  outside: number;
  absent: number;
  workingDays: number;
  attendanceRate: number;
  lateRate: number;
  totalWorkMinutes: number;
  totalOvertimeMinutes: number;
}

function countWorkingDays(start: Date, end: Date): number {
  let count = 0;
  const d = new Date(start);
  while (d <= end) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

interface UseAttendanceRateReturn {
  stats: EmployeeStat[];
  loading: boolean;
  error: string | null;
  period: Period;
  setPeriod: (p: Period) => void;
  customStart: string;
  setCustomStart: (s: string) => void;
  customEnd: string;
  setCustomEnd: (s: string) => void;
  avgRate: number;
  mostLate: EmployeeStat | null;
  bestAttendee: EmployeeStat | null;
  totalAbsent: number;
}

export function useAttendanceRate(): UseAttendanceRateReturn {
  const [stats, setStats] = useState<EmployeeStat[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>('30d');
  const [customStart, setCustomStart] = useState(() => getWIBDaysAgo(30));
  const [customEnd, setCustomEnd] = useState(() => getWIBDate());
  const mountedRef = useRef(true);

  const compute = useCallback(async (from: string, to: string) => {
    setLoading(true);
    setError(null);
    try {
      const { data: employees, error: empErr } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('role', ['viewer', 'driver_bebas', 'driver_kantor', 'juru_parkir', 'ob'])
        .order('full_name');

      if (empErr) throw empErr;
      if (!mountedRef.current) return;

      const empList = (employees || []) as Pick<Profile, 'id' | 'full_name'>[];

      if (empList.length === 0) {
        setStats([]);
        return;
      }

      const toDate = new Date(to);
      toDate.setDate(toDate.getDate() + 1);
      const toISO = toDate.toISOString();

      const { data: attendance, error: attErr } = await supabase
        .from('attendance')
        .select('user_id, status, work_duration_minutes, overtime_minutes')
        .gte('check_in_time', from)
        .lt('check_in_time', toISO);

      if (attErr) throw attErr;
      if (!mountedRef.current) return;

      const records = (attendance || []) as Pick<Attendance, 'user_id' | 'status' | 'work_duration_minutes' | 'overtime_minutes'>[];

      const workingDays = countWorkingDays(new Date(from), new Date(to));

      const userAttendance: Record<string, { present: number; late: number; outside: number; totalWorkMinutes: number; totalOvertimeMinutes: number }> = {};
      for (const rec of records) {
        if (!userAttendance[rec.user_id]) {
          userAttendance[rec.user_id] = { present: 0, late: 0, outside: 0, totalWorkMinutes: 0, totalOvertimeMinutes: 0 };
        }
        if (rec.status === 'present') userAttendance[rec.user_id].present++;
        else if (rec.status === 'late') userAttendance[rec.user_id].late++;
        else if (rec.status === 'outside_radius') userAttendance[rec.user_id].outside++;

        userAttendance[rec.user_id].totalWorkMinutes += (rec.work_duration_minutes || 0);
        userAttendance[rec.user_id].totalOvertimeMinutes += (rec.overtime_minutes || 0);
      }

      const computed: EmployeeStat[] = empList.map((emp) => {
        const ua = userAttendance[emp.id] || { present: 0, late: 0, outside: 0, totalWorkMinutes: 0, totalOvertimeMinutes: 0 };
        const daysPresent = ua.present + ua.late;
        const absent = Math.max(0, workingDays - daysPresent);
        const attendanceRate = workingDays > 0
          ? Math.round((daysPresent / workingDays) * 100)
          : 0;
        const lateRate = daysPresent > 0
          ? Math.round((ua.late / daysPresent) * 100)
          : 0;
        return {
          id: emp.id,
          fullName: emp.full_name,
          present: ua.present,
          late: ua.late,
          outside: ua.outside,
          absent,
          workingDays,
          attendanceRate,
          lateRate,
          totalWorkMinutes: ua.totalWorkMinutes,
          totalOvertimeMinutes: ua.totalOvertimeMinutes,
        };
      });

      computed.sort((a, b) => a.attendanceRate - b.attendanceRate);

      if (mountedRef.current) {
        setStats(computed);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to compute stats');
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  const load = useCallback(async () => {
    let from: string;
    let to: string;
    if (period === '7d') {
      from = getWIBDaysAgo(7);
      to = getWIBDate();
    } else if (period === '30d') {
      from = getWIBDaysAgo(30);
      to = getWIBDate();
    } else {
      from = customStart;
      to = customEnd;
    }
    await compute(from, to);
  }, [period, customStart, customEnd, compute]);

  // [FIX] Bungkus load() di dalam fungsi async lokal agar ESLint tidak
  // menganggap setState dipanggil secara sinkron dari body effect.
  // `load` sudah di-memoize dengan useCallback sehingga hanya re-run
  // ketika period atau tanggal kustom berubah, tidak setiap render.
  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    const run = async () => {
      if (!cancelled) {
        await load();
      }
    };
    run();

    return () => {
      cancelled = true;
      mountedRef.current = false;
    };
  }, [load]);

  const avgRate = stats.length > 0
    ? Math.round(stats.reduce((s, e) => s + e.attendanceRate, 0) / stats.length)
    : 0;

  const mostLate = stats.length > 0
    ? stats.reduce((a, b) => (a.late > b.late ? a : b))
    : null;

  const bestAttendee = stats.length > 0
    ? stats.reduce((a, b) => (a.attendanceRate > b.attendanceRate ? a : b))
    : null;

  const totalAbsent = stats.reduce((s, e) => s + e.absent, 0);

  return {
    stats,
    loading,
    error,
    period,
    setPeriod,
    customStart,
    setCustomStart,
    customEnd,
    setCustomEnd,
    avgRate,
    mostLate,
    bestAttendee,
    totalAbsent,
  };
}
