'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAttendance } from '@/hooks/useAttendance';
import { useOffices } from '@/hooks/useOffices';
import dynamic from 'next/dynamic';
import { useDashboardAnalytics, Period } from '@/hooks/useDashboardAnalytics';
import { supabase } from '@/lib/supabase';
import { StatsCard } from '@/components/ui/StatsCard';
import { formatDistance } from '@/lib/utils';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks } from 'date-fns';
import {
  getWIBDate,
  getWIBDateObj,
  formatWIBDate,
  formatWIBTime,
  formatWIBDateHeader,
  formatWIBMonth,
} from '@/lib/timezone';
import {
  CheckCircle2,
  Clock,
  Users,
  Building2,
  MapPin,
  TrendingUp,
  TrendingDown,
  Calendar,
  ArrowUpRight,
  ShieldAlert,
  Loader2,
  Award,
  AlertCircle,
  LogOut,
  Navigation,
  RefreshCw,
  SlidersHorizontal,
  ChevronRight,
  Radio,
} from 'lucide-react';
import Link from 'next/link';

const StatusPieChart = dynamic(
  () => import('@/components/admin/charts/AnalyticsCharts').then((m) => m.StatusPieChart),
  { ssr: false }
);
const DailyAttendanceChart = dynamic(
  () => import('@/components/admin/charts/AnalyticsCharts').then((m) => m.DailyAttendanceChart),
  { ssr: false }
);
const LateTrendChart = dynamic(
  () => import('@/components/admin/charts/AnalyticsCharts').then((m) => m.LateTrendChart),
  { ssr: false }
);

interface WeeklyStats {
  totalClockIns: number;
}

interface PeriodComparison {
  presentChange: number;
  lateChange: number;
  totalChange: number;
}

interface TopPerformer {
  name: string;
  employee_id?: string;
  presentDays: number;
  lateDays: number;
  rate: number;
}

interface RecentActivityRecord {
  id: string;
  user_name: string;
  user_id: string;
  employee_id?: string;
  check_in_time: string;
  check_out_time?: string;
  status: string;
  distance: string;
  is_mocked: boolean;
}

export default function AdminDashboard() {
  const { history, fetchHistory } = useAttendance();
  const { offices, fetchOffices } = useOffices();
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats>({
    totalClockIns: 0,
  });
  const [monthlyStats, setMonthlyStats] = useState({
    present: 0,
    late: 0,
    outside: 0,
    suspicious: 0,
  });
  const [weeklySuspicious, setWeeklySuspicious] = useState(0);
  const [recentActivity, setRecentActivity] = useState<RecentActivityRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [periodComparison, setPeriodComparison] = useState<PeriodComparison>({
    presentChange: 0,
    lateChange: 0,
    totalChange: 0,
  });
  const [topPerformers, setTopPerformers] = useState<TopPerformer[]>([]);
  const [bottomPerformers, setBottomPerformers] = useState<TopPerformer[]>([]);

  // Main data fetch function
  const loadData = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchHistory(100), fetchOffices()]);
    setRefreshing(false);
    setLoading(false);
  }, [fetchHistory, fetchOffices]);

  // Initial load and periodic refresh
  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      if (!document.hidden) loadData();
    }, 60000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Compute all derived state from history
  useEffect(() => {
    if (history.length === 0) return;

    const today = getWIBDate();
    const nowWIB = getWIBDateObj();

    const todayRecords = history.filter(
      (h) => formatWIBDate(h.check_in_time) === today
    );

    const weekStart = startOfWeek(nowWIB, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(nowWIB, { weekStartsOn: 1 });
    const weekRecords = history.filter((h) => {
      const d = new Date(h.check_in_time);
      return d >= weekStart && d <= weekEnd;
    });

    const prevWeekStart = subWeeks(weekStart, 1);
    const prevWeekEnd = subWeeks(weekEnd, 1);
    const prevWeekRecords = history.filter((h) => {
      const d = new Date(h.check_in_time);
      return d >= prevWeekStart && d <= prevWeekEnd;
    });

    const monthStart = startOfMonth(nowWIB);
    const monthEnd = endOfMonth(nowWIB);
    const monthRecords = history.filter((h) => {
      const d = new Date(h.check_in_time);
      return d >= monthStart && d <= monthEnd;
    });

    // Stats
    setWeeklyStats({ totalClockIns: weekRecords.length });

    const mPresent = monthRecords.filter((r) => r.status === 'present').length;
    const mLate = monthRecords.filter((r) => r.status === 'late').length;
    const mOutside = monthRecords.filter((r) => r.status === 'outside_radius').length;
    const mSuspicious = monthRecords.filter((r) => r.is_mocked).length;
    setMonthlyStats({
      present: mPresent,
      late: mLate,
      outside: mOutside,
      suspicious: mSuspicious,
    });
    setWeeklySuspicious(weekRecords.filter((r) => r.is_mocked).length);

    const prevWeekPresent = prevWeekRecords.filter((r) => r.status === 'present').length;
    const prevWeekLate = prevWeekRecords.filter((r) => r.status === 'late').length;

    const todayPresentCount = todayRecords.filter((r) => r.status === 'present').length;
    const todayLateCount = todayRecords.filter((r) => r.status === 'late').length;

    setPeriodComparison({
      presentChange:
        prevWeekPresent > 0
          ? Math.round(
              ((todayPresentCount - prevWeekPresent / 7) / (prevWeekPresent / 7)) * 100
            )
          : 0,
      lateChange:
        prevWeekLate > 0
          ? Math.round(
              ((todayLateCount - prevWeekLate / 7) / (prevWeekLate / 7)) * 100
            )
          : 0,
      totalChange:
        prevWeekRecords.length > 0
          ? Math.round(
              ((weekRecords.length - prevWeekRecords.length) / prevWeekRecords.length) * 100
            )
          : 0,
    });

    setRecentActivity(
      todayRecords.slice(0, 10).map((r) => {
        const userName =
          (r as any).profiles?.full_name || (r as any).user_name || 'Karyawan';
        return {
          id: r.id,
          user_name: userName,
          user_id: r.user_id,
          employee_id: (r as any).profiles?.employee_id,
          check_in_time: r.check_in_time,
          check_out_time: r.check_out_time ?? undefined,
          status: r.status,
          distance: formatDistance(r.distance_from_office),
          is_mocked: r.is_mocked || false,
        };
      })
    );

    // Performers
    const userStats: Record<
      string,
      { name: string; employee_id?: string; present: number; late: number; total: number }
    > = {};
    weekRecords.forEach((r) => {
      const uid = r.user_id;
      if (!userStats[uid]) {
        userStats[uid] = {
          name: (r as any).profiles?.full_name || 'Karyawan',
          employee_id: (r as any).profiles?.employee_id,
          present: 0,
          late: 0,
          total: 0,
        };
      }
      userStats[uid].total++;
      if (r.status === 'present') userStats[uid].present++;
      if (r.status === 'late') userStats[uid].late++;
    });

    const performers = Object.entries(userStats)
      .map(([_, stats]) => ({
        name: stats.name,
        employee_id: stats.employee_id,
        presentDays: stats.present,
        lateDays: stats.late,
        rate: stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0,
      }))
      .sort((a, b) => b.rate - a.rate);

    setTopPerformers(performers.slice(0, 5));
    setBottomPerformers([...performers].sort((a, b) => a.rate - b.rate).slice(0, 5));
  }, [history]);

  // Fetch employee count
  const [employeeCount, setEmployeeCount] = useState(0);
  useEffect(() => {
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .not('role', 'eq', 'inactive')
      .not('role', 'eq', 'admin')
      .then(({ count }) => setEmployeeCount(count || 0));
  }, []);

  const today = getWIBDate();
  const todayPresent = useMemo(
    () =>
      history.filter(
        (h) => formatWIBDate(h.check_in_time) === today && h.status === 'present'
      ).length,
    [history, today]
  );
  const todayLate = useMemo(
    () =>
      history.filter(
        (h) => formatWIBDate(h.check_in_time) === today && h.status === 'late'
      ).length,
    [history, today]
  );
  const todayOutside = useMemo(
    () =>
      history.filter(
        (h) =>
          formatWIBDate(h.check_in_time) === today &&
          h.status === 'outside_radius'
      ).length,
    [history, today]
  );

  const analytics = useDashboardAnalytics();

  const periods: { value: Period; label: string }[] = [
    { value: 'today', label: 'Hari Ini' },
    { value: '7d', label: '7 Hari Terakhir' },
    { value: '30d', label: '30 Hari Terakhir' },
    { value: 'custom', label: 'Kustom' },
  ];

  // Helper for trend badge
  const renderTrend = (change: number, inverse = false) => {
    const isPositive = inverse ? change < 0 : change > 0;
    const isNeutral = change === 0;
    const color = isNeutral
      ? 'text-slate-500 bg-slate-100 border-slate-200'
      : isPositive
      ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
      : 'text-rose-700 bg-rose-50 border-rose-200';
    const icon = isNeutral ? null : isPositive ? (
      <TrendingUp className="w-3 h-3" />
    ) : (
      <TrendingDown className="w-3 h-3" />
    );

    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full border ${color}`}
      >
        {icon}
        {change > 0 ? '+' : ''}
        {change}% vs minggu lalu
      </span>
    );
  };

  const totalMonthlyRecorded =
    monthlyStats.present + monthlyStats.late + monthlyStats.outside;

  return (
    <div className="space-y-6 max-w-[1440px] mx-auto">
      {/* Executive Header */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Sistem Operasional Aktif
            </span>
            <span className="text-xs text-slate-400">|</span>
            <span className="text-xs font-medium text-slate-500">
              {formatWIBDateHeader()}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Dashboard Presensi & Kehadiran
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Ringkasan pemantauan presensi pegawai, kedisiplinan, dan verifikasi geofence secara realtime.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <button
            onClick={loadData}
            disabled={refreshing}
            title="Perbarui Data Presensi"
            aria-label="Perbarui Data Presensi"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium shadow-xs transition-colors disabled:opacity-60 cursor-pointer"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`}
            />
            <span>{refreshing ? 'Sinkronisasi...' : 'Segarkan Data'}</span>
          </button>
        </div>
      </div>

      {/* Top 5 KPI Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 sm:gap-4">
        <StatsCard
          icon={<Users className="w-5 h-5" />}
          value={employeeCount}
          label="Total Pegawai"
          subtitle="Pegawai aktif terdaftar"
          color="blue"
        />

        <StatsCard
          icon={<CheckCircle2 className="w-5 h-5" />}
          value={todayPresent}
          label="Hadir Hari Ini"
          subtitle={
            employeeCount > 0
              ? `${Math.round((todayPresent / employeeCount) * 100)}% dari total pegawai`
              : 'Presensi tercatat'
          }
          color="green"
          trend={
            periodComparison.presentChange !== 0
              ? renderTrend(periodComparison.presentChange)
              : undefined
          }
        />

        <StatsCard
          icon={<Clock className="w-5 h-5" />}
          value={todayLate}
          label="Terlambat Hari Ini"
          subtitle="Presensi lewat batas waktu"
          color="yellow"
          trend={
            periodComparison.lateChange !== 0
              ? renderTrend(periodComparison.lateChange, true)
              : undefined
          }
        />

        <StatsCard
          icon={<Navigation className="w-5 h-5" />}
          value={todayOutside}
          label="Luar Radius"
          subtitle="Check-in di luar geofence"
          color="orange"
        />

        <StatsCard
          icon={<ShieldAlert className="w-5 h-5" />}
          value={weeklySuspicious}
          label="Kejanggalan (Minggu)"
          subtitle="Deteksi Fake GPS / Rooted"
          color="red"
        />
      </div>

      {/* Operational Overview Grid: Active Office & Monthly Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Active Office Card */}
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-100">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
                    Kantor & Geofence Utama
                  </h3>
                  <p className="text-xs text-slate-500">Titik acuan validasi lokasi</p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Aktif
              </span>
            </div>

            {offices.length > 0 ? (
              <div className="space-y-3">
                <div>
                  <p className="text-base font-bold text-slate-900">{offices[0].name}</p>
                  <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    Koordinat: {offices[0].latitude.toFixed(6)}, {offices[0].longitude.toFixed(6)}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/70">
                    <span className="text-[11px] font-medium text-slate-500 block">Radius Geofence</span>
                    <span className="text-sm font-bold text-slate-900">
                      {formatDistance(offices[0].geofence_radius)}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/70">
                    <span className="text-[11px] font-medium text-slate-500 block">Total Kantor</span>
                    <span className="text-sm font-bold text-slate-900">
                      {offices.length} Unit Kantor
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                Belum ada kantor yang dikonfigurasi.
              </div>
            )}
          </div>

          <div className="pt-4 mt-4 border-t border-slate-100">
            <Link
              href="/admin/offices"
              className="inline-flex items-center justify-between w-full text-xs font-semibold text-blue-700 hover:text-blue-800 transition-colors"
            >
              <span>Kelola Konfigurasi Kantor & Peta</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Monthly Attendance Matrix */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/90 shadow-xs p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-100">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
                    Rekapitulasi Bulan Berjalan
                  </h3>
                  <p className="text-xs text-slate-500">
                    Periode: {formatWIBMonth()}
                  </p>
                </div>
              </div>
              <span className="text-xs font-medium text-slate-500">
                {weeklyStats.totalClockIns} presensi minggu ini
              </span>
            </div>

            {/* Metric Blocks */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg border border-emerald-100 bg-emerald-50/50">
                <span className="text-xs font-medium text-emerald-800 block">Tepat Waktu</span>
                <span className="text-2xl font-bold text-emerald-900 mt-1 block">
                  {monthlyStats.present}
                </span>
                <span className="text-[11px] text-emerald-700 mt-0.5 block">
                  {totalMonthlyRecorded > 0
                    ? `${Math.round((monthlyStats.present / totalMonthlyRecorded) * 100)}% total`
                    : '0%'}
                </span>
              </div>

              <div className="p-3 rounded-lg border border-amber-100 bg-amber-50/50">
                <span className="text-xs font-medium text-amber-800 block">Terlambat</span>
                <span className="text-2xl font-bold text-amber-900 mt-1 block">
                  {monthlyStats.late}
                </span>
                <span className="text-[11px] text-amber-700 mt-0.5 block">
                  {totalMonthlyRecorded > 0
                    ? `${Math.round((monthlyStats.late / totalMonthlyRecorded) * 100)}% total`
                    : '0%'}
                </span>
              </div>

              <div className="p-3 rounded-lg border border-rose-100 bg-rose-50/50">
                <span className="text-xs font-medium text-rose-800 block">Luar Radius</span>
                <span className="text-2xl font-bold text-rose-900 mt-1 block">
                  {monthlyStats.outside}
                </span>
                <span className="text-[11px] text-rose-700 mt-0.5 block">
                  {totalMonthlyRecorded > 0
                    ? `${Math.round((monthlyStats.outside / totalMonthlyRecorded) * 100)}% total`
                    : '0%'}
                </span>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                <span className="text-xs font-medium text-slate-700 block">Kejanggalan</span>
                <span className="text-2xl font-bold text-slate-900 mt-1 block">
                  {monthlyStats.suspicious}
                </span>
                <span className="text-[11px] text-slate-500 mt-0.5 block">
                  Peringatan keamanan
                </span>
              </div>
            </div>

            {/* Proportion Bar */}
            {totalMonthlyRecorded > 0 && (
              <div className="mt-4 pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                  <span className="font-medium">Distribusi Status Presensi Bulan Ini</span>
                  <span>{totalMonthlyRecorded} Rekaman Tercatat</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex">
                  <div
                    style={{
                      width: `${(monthlyStats.present / totalMonthlyRecorded) * 100}%`,
                    }}
                    className="bg-emerald-500 h-full"
                    title={`Tepat Waktu: ${monthlyStats.present}`}
                  />
                  <div
                    style={{
                      width: `${(monthlyStats.late / totalMonthlyRecorded) * 100}%`,
                    }}
                    className="bg-amber-400 h-full"
                    title={`Terlambat: ${monthlyStats.late}`}
                  />
                  <div
                    style={{
                      width: `${(monthlyStats.outside / totalMonthlyRecorded) * 100}%`,
                    }}
                    className="bg-rose-500 h-full"
                    title={`Luar Radius: ${monthlyStats.outside}`}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Data teragregasi otomatis dari database absensi
            </span>
            <Link
              href="/admin/monthly-recap"
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-800 transition-colors"
            >
              <span>Lihat Rekap Bulanan Lengkap</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Discipline & Performance Rankings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top Performers */}
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100">
                <Award className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
                  Kedisiplinan Tertinggi (Minggu Ini)
                </h3>
                <p className="text-xs text-slate-500">Pegawai paling tepat waktu</p>
              </div>
            </div>
            <Link
              href="/admin/performance"
              className="text-xs font-medium text-blue-700 hover:text-blue-800 inline-flex items-center gap-0.5"
            >
              Semua <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {topPerformers.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              Belum ada data presensi untuk dianalisis minggu ini
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {topPerformers.map((p, i) => (
                <div
                  key={i}
                  className="py-2.5 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-[11px] shrink-0">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{p.name}</p>
                      <p className="text-[11px] text-slate-400">
                        {p.employee_id ? `ID: ${p.employee_id}` : 'Pegawai'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className="text-slate-500 text-[11px]">
                      {p.presentDays} Hadir / {p.lateDays} Telat
                    </span>
                    <span className="px-2 py-0.5 rounded-md font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200">
                      {p.rate}% Tepat Waktu
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Needs Attention */}
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-100">
                <AlertCircle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
                  Perlu Perhatian (Keterlambatan Sering)
                </h3>
                <p className="text-xs text-slate-500">Evaluasi kehadiran pegawai minggu ini</p>
              </div>
            </div>
            <Link
              href="/admin/performance"
              className="text-xs font-medium text-blue-700 hover:text-blue-800 inline-flex items-center gap-0.5"
            >
              Semua <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {bottomPerformers.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              Belum ada data presensi yang memerlukan perhatian khusus
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {bottomPerformers.map((p, i) => (
                <div
                  key={i}
                  className="py-2.5 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-5 h-5 rounded-md bg-rose-50 text-rose-700 font-bold flex items-center justify-center text-[11px] shrink-0 border border-rose-100">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{p.name}</p>
                      <p className="text-[11px] text-slate-400">
                        {p.employee_id ? `ID: ${p.employee_id}` : 'Pegawai'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className="text-slate-500 text-[11px]">
                      {p.presentDays} Hadir / {p.lateDays} Telat
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-md font-semibold border ${
                        p.rate < 70
                          ? 'text-rose-800 bg-rose-50 border-rose-200'
                          : 'text-amber-800 bg-amber-50 border-amber-200'
                      }`}
                    >
                      {p.rate}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Analytics Charts with Segmented Control */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-slate-200/80">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Analisis & Tren Presensi
            </h2>
            <p className="text-xs text-slate-500">
              Visualisasi tren kehadiran, keterlambatan, dan distribusi status
            </p>
          </div>

          {/* Period Filter Tabs */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {periods.map((p) => (
              <button
                key={p.value}
                onClick={() => analytics.setPeriod(p.value)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  analytics.period === p.value
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
                }`}
              >
                {p.label}
              </button>
            ))}

            {analytics.period === 'custom' && (
              <div className="flex items-center gap-1.5 ml-1 bg-white p-1 rounded-lg border border-slate-200/80">
                <input
                  type="date"
                  value={analytics.customStart}
                  onChange={(e) => analytics.setCustomStart(e.target.value)}
                  className="px-2 py-1 text-xs border border-slate-200 rounded text-slate-800"
                />
                <span className="text-xs text-slate-400">s/d</span>
                <input
                  type="date"
                  value={analytics.customEnd}
                  onChange={(e) => analytics.setCustomEnd(e.target.value)}
                  className="px-2 py-1 text-xs border border-slate-200 rounded text-slate-800"
                />
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <StatusPieChart
            data={analytics.data}
            loading={analytics.loading}
            error={analytics.error}
          />
          <DailyAttendanceChart
            data={analytics.data}
            loading={analytics.loading}
            error={analytics.error}
          />
        </div>

        <LateTrendChart
          data={analytics.data}
          loading={analytics.loading}
          error={analytics.error}
        />
      </div>

      {/* Live Recent Activity Feed */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-100">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
                Aktivitas Presensi Hari Ini
              </h3>
              <p className="text-xs text-slate-500">
                Menampilkan {recentActivity.length} rekaman presensi terbaru
              </p>
            </div>
          </div>

          <Link
            href="/admin/reports"
            className="text-xs font-semibold text-blue-700 hover:text-blue-800 inline-flex items-center gap-1 self-start sm:self-auto"
          >
            <span>Buka Laporan Presensi Harian</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {recentActivity.length === 0 ? (
          <div className="p-10 text-center text-slate-400">
            <Radio className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-medium text-slate-600">Belum ada aktivitas presensi hari ini</p>
            <p className="text-xs text-slate-400 mt-1">
              Catatan check-in pegawai akan muncul secara live di sini saat mereka melakukan absensi.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {recentActivity.map((record) => {
              const initials = record.user_name
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')
                .toUpperCase() || 'P';

              const isPresent = record.status === 'present';
              const isLate = record.status === 'late';
              const isOutside = record.status === 'outside_radius';

              return (
                <div
                  key={record.id}
                  className="px-5 py-3.5 hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* User Avatar Initials */}
                    <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-xs shrink-0 border border-slate-200">
                      {initials}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {record.user_name}
                        </p>
                        {record.employee_id && (
                          <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-medium rounded">
                            {record.employee_id}
                          </span>
                        )}
                        {record.is_mocked && (
                          <span className="px-2 py-0.5 bg-rose-100 text-rose-800 text-[10px] font-bold rounded-full border border-rose-200 flex items-center gap-1">
                            <ShieldAlert className="w-3 h-3" />
                            Fake GPS Terdeteksi
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-slate-500 mt-1 flex-wrap">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          Masuk: <strong className="text-slate-700">{formatWIBTime(record.check_in_time)}</strong>
                        </span>

                        {record.check_out_time && (
                          <span className="inline-flex items-center gap-1">
                            <LogOut className="w-3.5 h-3.5 text-slate-400" />
                            Keluar: <strong className="text-slate-700">{formatWIBTime(record.check_out_time)}</strong>
                          </span>
                        )}

                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          Jarak: <strong className="text-slate-700">{record.distance}</strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="self-start sm:self-auto shrink-0">
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${
                        isPresent
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : isLate
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : isOutside
                          ? 'bg-orange-50 text-orange-800 border-orange-200'
                          : 'bg-rose-50 text-rose-800 border-rose-200'
                      }`}
                    >
                      {isPresent && 'Hadir Tepat Waktu'}
                      {isLate && 'Terlambat'}
                      {isOutside && 'Luar Radius'}
                      {!isPresent && !isLate && !isOutside && record.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}