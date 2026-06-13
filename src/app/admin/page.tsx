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
import { getWIBDate, getWIBDateObj, formatWIBDate, formatWIBTime, formatWIBDateHeader, formatWIBMonth } from '@/lib/timezone';
import {
  CheckCircle, Clock, XCircle, Users, Building2, MapPin,
  TrendingUp, Calendar, ArrowUpRight, AlertTriangle,
  RefreshCw, TrendingDown, Award, AlertCircle, LogOut, Navigation,
  UserCheck, UserX,
} from 'lucide-react';
import Link from 'next/link';

const StatusPieChart = dynamic(() => import('@/components/admin/charts/AnalyticsCharts').then((m) => m.StatusPieChart), { ssr: false });
const DailyAttendanceChart = dynamic(() => import('@/components/admin/charts/AnalyticsCharts').then((m) => m.DailyAttendanceChart), { ssr: false });
const LateTrendChart = dynamic(() => import('@/components/admin/charts/AnalyticsCharts').then((m) => m.LateTrendChart), { ssr: false });

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
  const [monthlyStats, setMonthlyStats] = useState({ present: 0, late: 0, outside: 0, suspicious: 0 });
  const [weeklySuspicious, setWeeklySuspicious] = useState(0);
  const [recentActivity, setRecentActivity] = useState<RecentActivityRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [periodComparison, setPeriodComparison] = useState<PeriodComparison>({ presentChange: 0, lateChange: 0, totalChange: 0 });
  const [topPerformers, setTopPerformers] = useState<TopPerformer[]>([]);
  const [bottomPerformers, setBottomPerformers] = useState<TopPerformer[]>([]);
  const [employeeSummary, setEmployeeSummary] = useState<TopPerformer[]>([]);

  // Main data fetch function
  const loadData = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      fetchHistory(100),
      fetchOffices(),
    ]);
    setRefreshing(false);
    setLoading(false);
  }, [fetchHistory, fetchOffices]);

  // Initial load + auto-refresh every 30 seconds
  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      if (!document.hidden) loadData();
    }, 60000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Compute all derived state from history in a single pass
  useEffect(() => {
    if (history.length === 0) return;

    const today = getWIBDate();
    const nowWIB = getWIBDateObj();

    const todayRecords = history.filter((h) => formatWIBDate(h.check_in_time) === today);

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

    // -- Stats --
    setWeeklyStats({ totalClockIns: weekRecords.length });

    const mPresent = monthRecords.filter((r) => r.status === 'present').length;
    const mLate = monthRecords.filter((r) => r.status === 'late').length;
    const mOutside = monthRecords.filter((r) => r.status === 'outside_radius').length;
    const mSuspicious = monthRecords.filter((r) => r.is_mocked).length;
    setMonthlyStats({ present: mPresent, late: mLate, outside: mOutside, suspicious: mSuspicious });
    setWeeklySuspicious(weekRecords.filter((r) => r.is_mocked).length);

    const prevWeekPresent = prevWeekRecords.filter((r) => r.status === 'present').length;
    const prevWeekLate = prevWeekRecords.filter((r) => r.status === 'late').length;

    const todayPresentCount = todayRecords.filter((r) => r.status === 'present').length;
    const todayLateCount = todayRecords.filter((r) => r.status === 'late').length;

    setPeriodComparison({
      presentChange: prevWeekPresent > 0 ? Math.round(((todayPresentCount - prevWeekPresent / 7) / (prevWeekPresent / 7)) * 100) : 0,
      lateChange: prevWeekLate > 0 ? Math.round(((todayLateCount - prevWeekLate / 7) / (prevWeekLate / 7)) * 100) : 0,
      totalChange: prevWeekRecords.length > 0 ? Math.round(((weekRecords.length - prevWeekRecords.length) / prevWeekRecords.length) * 100) : 0,
    });

    setRecentActivity(
      todayRecords.slice(0, 10).map((r) => {
        const userName = (r as any).profiles?.full_name || (r as any).user_name || 'Unknown';
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

    // -- Performers (reuses weekRecords) --
    const userStats: Record<string, { name: string; employee_id?: string; present: number; late: number; total: number }> = {};
    weekRecords.forEach((r) => {
      const uid = r.user_id;
      if (!userStats[uid]) {
        userStats[uid] = {
          name: (r as any).profiles?.full_name || 'Unknown',
          employee_id: (r as any).profiles?.employee_id,
          present: 0,
          late: 0,
          total: 0
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
    supabase.from('profiles').select('id', { count: 'exact', head: true })
      .not('role', 'eq', 'inactive')
      .not('role', 'eq', 'admin')
      .then(({ count }) => setEmployeeCount(count || 0));
  }, []);

  const today = getWIBDate();
  const todayPresent = useMemo(() => history.filter((h) => formatWIBDate(h.check_in_time) === today && h.status === 'present').length, [history, today]);
  const todayLate = useMemo(() => history.filter((h) => formatWIBDate(h.check_in_time) === today && h.status === 'late').length, [history, today]);
  const todayOutside = useMemo(() => history.filter((h) => formatWIBDate(h.check_in_time) === today && h.status === 'outside_radius').length, [history, today]);

  const analytics = useDashboardAnalytics();

  const periods: { value: Period; label: string }[] = [
    { value: 'today', label: 'Today' },
    { value: '7d', label: '7 Days' },
    { value: '30d', label: '30 Days' },
    { value: 'custom', label: 'Custom' },
  ];

  const renderPeriodFilter = () => (
    <div className="flex items-center gap-2 flex-wrap">
      {periods.map((p) => (
        <button
          key={p.value}
          onClick={() => analytics.setPeriod(p.value)}
          className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-all ${
            analytics.period === p.value
              ? 'bg-gradient-red-blue text-white shadow-md'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {p.label}
        </button>
      ))}
      {analytics.period === 'custom' && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={analytics.customStart}
            onChange={(e) => analytics.setCustomStart(e.target.value)}
            className="px-2 py-1.5 text-sm border rounded-lg"
          />
          <span className="text-gray-400">to</span>
          <input
            type="date"
            value={analytics.customEnd}
            onChange={(e) => analytics.setCustomEnd(e.target.value)}
            className="px-2 py-1.5 text-sm border rounded-lg"
          />
        </div>
      )}
    </div>
  );

  // Helper to render trend indicator
  const renderTrend = (change: number, inverse = false) => {
    const isPositive = inverse ? change < 0 : change > 0;
    const isNeutral = change === 0;
    const color = isNeutral ? 'text-gray-500' : isPositive ? 'text-green-600' : 'text-red-600';
    const icon = isNeutral ? null : isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />;

    return (
      <span className={`flex items-center gap-0.5 text-xs font-medium ${color}`}>
        {icon}
        {change > 0 ? '+' : ''}{change}%
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header with Refresh Button */}
      <div className="flex items-center justify-between">
        <div className="relative">
          {/* Gradient accent bar */}
          <div className="absolute -left-4 top-0 bottom-0 w-1 bg-gradient-red-blue rounded-full" />
          <div className="pl-4">
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {formatWIBDateHeader()}
            </p>
          </div>
        </div>
        <button
          onClick={loadData}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-red-blue text-white rounded-lg hover:opacity-90 transition-all shadow-md disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Today's Stats with Period Comparison */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatsCard
          icon={<CheckCircle className="w-6 h-6" />}
          value={todayPresent}
          label="Present Today"
          color="green"
          trend={periodComparison.presentChange !== 0 ? renderTrend(periodComparison.presentChange) : undefined}
        />
        <StatsCard
          icon={<Clock className="w-6 h-6" />}
          value={todayLate}
          label="Late Today"
          color="yellow"
          trend={periodComparison.lateChange !== 0 ? renderTrend(periodComparison.lateChange, true) : undefined}
        />
        <StatsCard
          icon={<Users className="w-6 h-6" />}
          value={employeeCount}
          label="Total Employees"
          color="blue"
        />
      </div>

      {/* This Week Stats */}
      <div className="grid grid-cols-2 gap-4">
        <StatsCard
          icon={<TrendingUp className="w-6 h-6" />}
          value={weeklyStats.totalClockIns}
          label="Clock-ins This Week"
          color="blue"
        />
        <StatsCard
          icon={<AlertTriangle className="w-6 h-6" />}
          value={weeklySuspicious}
          label="Kejanggalan (Week)"
          color="red"
        />
      </div>

      {/* Quick Actions + Office Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Active Office */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-5 relative overflow-hidden group">
          {/* Gradient accent */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-red-blue opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-600" />
            Active Office
          </h3>
          {offices.length > 0 ? (
            <div className="space-y-2">
              <p className="font-medium text-gray-900">{offices[0].name}</p>
              <p className="text-sm text-gray-500">
                {offices[0].latitude.toFixed(6)}, {offices[0].longitude.toFixed(6)}
              </p>
              <p className="text-sm text-gray-500">
                Radius: {formatDistance(offices[0].geofence_radius)}
              </p>
            </div>
          ) : (
            <p className="text-yellow-600 bg-yellow-50 p-3 rounded-lg text-sm">
              No office configured.{" "}
              <Link href="/admin/offices" className="underline font-medium">Add one now</Link>
            </p>
          )}
        </div>

        {/* This Month Summary */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-5 relative overflow-hidden group">
          {/* Gradient accent */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-red-blue opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            This Month ({formatWIBMonth()})
          </h3>
          <div className="grid grid-cols-4 gap-3 text-center">
            <div className="bg-green-50 rounded-lg p-3">
              <p className="text-xl font-bold text-green-700">{monthlyStats.present}</p>
              <p className="text-xs text-green-600">Present</p>
            </div>
            <div className="bg-yellow-50 rounded-lg p-3">
              <p className="text-xl font-bold text-yellow-700">{monthlyStats.late}</p>
              <p className="text-xs text-yellow-600">Late</p>
            </div>
            <div className="bg-red-50 rounded-lg p-3">
              <p className="text-xl font-bold text-red-700">{monthlyStats.outside}</p>
              <p className="text-xs text-red-600">Outside</p>
            </div>
            <div className="bg-orange-50 rounded-lg p-3">
              <p className="text-xl font-bold text-orange-700">{monthlyStats.suspicious}</p>
              <p className="text-xs text-orange-600">Kejanggalan</p>
            </div>
          </div>
        </div>
      </div>

      {/* Top & Bottom Performers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top Performers */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-5 relative overflow-hidden group">
          {/* Gradient accent */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-red-blue opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Award className="w-5 h-5 text-green-600" />
            Top Performers (This Week)
          </h3>
          {topPerformers.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">No data yet</p>
          ) : (
            <div className="space-y-2">
              {topPerformers.map((p, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-green-100 text-green-700 text-xs font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                    <span className="text-sm font-medium text-gray-900">{p.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500">{p.presentDays}P / {p.lateDays}L</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                      {p.rate}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bottom Performers */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-5 relative overflow-hidden group">
          {/* Gradient accent */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-red-blue opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            Needs Attention (This Week)
          </h3>
          {bottomPerformers.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">No data yet</p>
          ) : (
            <div className="space-y-2">
              {bottomPerformers.map((p, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-red-100 text-red-700 text-xs font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                    <span className="text-sm font-medium text-gray-900">{p.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500">{p.presentDays}P / {p.lateDays}L</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      p.rate < 70 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {p.rate}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Dashboard Analytics */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold bg-gradient-red-blue bg-clip-text text-transparent">Analytics</h2>
          {renderPeriodFilter()}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <StatusPieChart data={analytics.data} loading={analytics.loading} error={analytics.error} />
          <DailyAttendanceChart data={analytics.data} loading={analytics.loading} error={analytics.error} />
        </div>

        <LateTrendChart data={analytics.data} loading={analytics.loading} error={analytics.error} />
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden relative">
        {/* Gradient accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-red-blue" />
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Navigation className="w-5 h-5 text-blue-600" />
            Today&apos;s Activity
            <span className="ml-2 px-2 py-0.5 bg-gradient-red-blue text-white text-xs rounded-full shadow-sm">
              {recentActivity.length} records
            </span>
          </h3>
          <Link
            href="/admin/reports"
            className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium"
          >
            View Reports <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>
        {recentActivity.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No attendance records today
          </div>
        ) : (
          <div className="divide-y">
            {recentActivity.map((record) => (
              <div key={record.id} className="px-5 py-3 hover:bg-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  {/* Avatar */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 ${
                    record.status === 'present' ? 'bg-green-100 text-green-700' :
                    record.status === 'late' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {record.user_name.charAt(0).toUpperCase()}
                  </div>
                  {/* Info */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900 truncate">{record.user_name}</p>
                      {record.is_mocked && (
                        <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-xs rounded font-medium">
                          Suspicious
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatWIBTime(record.check_in_time)}
                      </span>
                      {record.check_out_time && (
                        <span className="flex items-center gap-1">
                          <LogOut className="w-3 h-3" />
                          {formatWIBTime(record.check_out_time)}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {record.distance}
                      </span>
                    </div>
                  </div>
                </div>
                {/* Status Badge */}
                <span className={`
                  px-2 py-0.5 rounded-full text-xs font-medium shrink-0
                  ${record.status === 'present' ? 'bg-green-100 text-green-700' :
                    record.status === 'late' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'}
                `}>
                  {record.status.replace('_', ' ')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}