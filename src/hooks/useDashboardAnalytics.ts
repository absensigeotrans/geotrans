'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import { supabase } from '@/lib/supabase';
import { getWIBDate, getWIBDaysAgo } from '@/lib/timezone';

export interface StatusDistribution {
  present: number;
  late: number;
  outside: number;
}

export interface DailyAttendance {
  date: string;
  total: number;
  present: number;
  late: number;
  outside: number;
}

export interface LateTrend {
  date: string;
  lateCount: number;
  avgLateMinutes: number;
}

export interface DashboardAnalytics {
  statusDistribution: StatusDistribution;
  dailyAttendance: DailyAttendance[];
  lateTrend: LateTrend[];
}

export type Period = 'today' | '7d' | '30d' | 'custom';

export function useDashboardAnalytics() {
  const [period, setPeriod] = useState<Period>('7d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const dateRange = useMemo(() => {
    const end = getWIBDate();
    if (period === 'today') return { start: end, end };
    if (period === '7d') return { start: getWIBDaysAgo(6), end };
    if (period === '30d') return { start: getWIBDaysAgo(29), end };
    return { start: customStart || end, end: customEnd || end };
  }, [period, customStart, customEnd]);

  const swrKey = `dashboard-analytics-${dateRange.start}-${dateRange.end}`;

  const { data, error, isLoading, mutate } = useSWR<DashboardAnalytics>(
    swrKey,
    async () => {
      const { data: result, error: rpcError } = await supabase
        .rpc('get_dashboard_analytics', { start_date: dateRange.start, end_date: dateRange.end });

      if (rpcError) throw rpcError;
      return result as DashboardAnalytics;
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
      keepPreviousData: true,
    },
  );

  return {
    data: data ?? null,
    loading: isLoading,
    error: error ? (error instanceof Error ? error.message : 'Failed to fetch analytics') : null,
    period,
    setPeriod,
    customStart,
    setCustomStart,
    customEnd,
    setCustomEnd,
    refresh: () => mutate(),
  };
}
