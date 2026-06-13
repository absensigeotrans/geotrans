'use client';

import {
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import type { PieLabelRenderProps } from 'recharts';
import { ChartCard } from '@/components/admin/ChartCard';
import { formatWIBChartTick, formatWIBChartLabel } from '@/lib/timezone';
import type { DashboardAnalytics } from '@/hooks/useDashboardAnalytics';

const PIE_COLORS = ['#22c55e', '#eab308', '#ef4444'];

interface AnalyticsChartsProps {
  data: DashboardAnalytics | null;
  loading: boolean;
  error: string | null;
}

export function StatusPieChart({ data, loading, error }: AnalyticsChartsProps) {
  return (
    <ChartCard title="Status Distribution" subtitle="Present vs Late vs Outside Radius" loading={loading} error={error}>
      {data ? (
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie
              data={[
                { name: 'Present', value: data.statusDistribution.present },
                { name: 'Late', value: data.statusDistribution.late },
                { name: 'Outside', value: data.statusDistribution.outside },
              ]}
              cx="50%" cy="50%" innerRadius={55} outerRadius={90}
              dataKey="value"
              label={(entry: PieLabelRenderProps) =>
                `${entry.name ?? ''} ${((entry.percent ?? 0) * 100).toFixed(0)}%`}
            >
              {PIE_COLORS.map((color, idx) => <Cell key={idx} fill={color} />)}
            </Pie>
            <Tooltip formatter={(value) => [value ?? 0, 'Records']} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex items-center justify-center h-48 text-gray-400 text-sm">No data for this period</div>
      )}
    </ChartCard>
  );
}

export function DailyAttendanceChart({ data, loading, error }: AnalyticsChartsProps) {
  return (
    <ChartCard title="Daily Attendance" subtitle="Per-day breakdown for selected period" loading={loading} error={error}>
      {data && data.dailyAttendance.length > 0 ? (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data.dailyAttendance}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tickFormatter={(d) => formatWIBChartTick(d)} tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip labelFormatter={(d) => formatWIBChartLabel(d)} />
            <Legend />
            <Bar dataKey="present" name="Present" stackId="a" fill="#22c55e" />
            <Bar dataKey="late" name="Late" stackId="a" fill="#eab308" />
            <Bar dataKey="outside" name="Outside" stackId="a" fill="#ef4444" />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex items-center justify-center h-48 text-gray-400 text-sm">No attendance records for this period</div>
      )}
    </ChartCard>
  );
}

export function LateTrendChart({ data, loading, error }: AnalyticsChartsProps) {
  return (
    <ChartCard title="Late Trend" subtitle="Daily late attendance count" loading={loading} error={error}>
      {data && data.lateTrend.length > 0 ? (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data.lateTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tickFormatter={(d) => formatWIBChartTick(d)} tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip labelFormatter={(d) => formatWIBChartLabel(d)} />
            <Legend />
            <Line type="monotone" dataKey="lateCount" name="Late Count" stroke="#eab308" strokeWidth={2} dot={{ fill: '#eab308', r: 3 }} />
            {data.lateTrend.some((d) => d.avgLateMinutes > 0) && (
              <Line type="monotone" dataKey="avgLateMinutes" name="Avg Late (min)" stroke="#f97316" strokeWidth={2} dot={{ fill: '#f97316', r: 3 }} strokeDasharray="5 5" />
            )}
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex items-center justify-center h-48 text-gray-400 text-sm">No late records for this period</div>
      )}
    </ChartCard>
  );
}
