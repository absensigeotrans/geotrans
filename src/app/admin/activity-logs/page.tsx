'use client';

import { useEffect, useState } from 'react';
import { useActivityLogs } from '@/hooks/useActivityLogs';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import { Pagination } from '@/components/ui/Pagination';
import { StatsCard } from '@/components/ui/StatsCard';
import { Table } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Activity, Database, Clock } from 'lucide-react';
import { AttendanceLog } from '@/types';
import { getWIBDaysAgo, getWIBDate, formatWIBDateDisplay, formatWIBTimeWithSeconds } from '@/lib/timezone';

const PAGE_SIZE = 50;

export default function ActivityLogsPage() {
  const { logs, loading, error, fetchLogs } = useActivityLogs();
  const [from, setFrom] = useState(() => getWIBDaysAgo(7));
  const [to, setTo] = useState(() => getWIBDate());
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const load = async () => {
      const result = await fetchLogs(page, PAGE_SIZE, from, to);
      setTotal(result.count);
    };
    load();
  }, [fetchLogs, page, from, to]);

  const handleFilter = () => {
    setPage(1);
    const result = fetchLogs(1, PAGE_SIZE, from, to);
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      clock_in: 'Clock In',
      clock_out: 'Clock Out',
      update: 'Updated',
      create: 'Created',
      delete: 'Deleted',
    };
    return labels[action] || action;
  };

  const getActionBadge = (action: string) => {
    if (action.includes('in')) return <Badge variant="success">{getActionLabel(action)}</Badge>;
    if (action.includes('out')) return <Badge variant="info">{getActionLabel(action)}</Badge>;
    return <Badge variant="default">{getActionLabel(action)}</Badge>;
  };

  const columns = [
    {
      key: 'created_at',
      header: 'Timestamp',
      sortable: true,
      render: (row: AttendanceLog) => (
        <div>
          <p className="text-sm font-medium">{formatWIBDateDisplay(row.created_at)}</p>
          <p className="text-xs text-gray-500">{formatWIBTimeWithSeconds(row.created_at)}</p>
        </div>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      render: (row: AttendanceLog) => getActionBadge(row.action),
    },
    {
      key: 'attendance_id',
      header: 'Attendance ID',
      render: (row: AttendanceLog) => (
        <span className="text-xs font-mono text-gray-500">{row.attendance_id.slice(0, 8)}...</span>
      ),
    },
    {
      key: 'details',
      header: 'Details',
      render: (row: AttendanceLog) => {
        try {
          const d = row.details as Record<string, unknown>;
          return (
            <div className="text-xs text-gray-600 space-y-0.5">
              {Object.entries(d).map(([k, v]) => (
                <p key={k}><span className="font-medium">{k}:</span> {String(v)}</p>
              ))}
            </div>
          );
        } catch {
          return <span className="text-xs text-gray-400">—</span>;
        }
      },
    },
  ];

  return (
    <div className="space-y-5">
      {/* Filter */}
      <div className="bg-white rounded-xl shadow-sm border p-4 flex flex-col sm:flex-row gap-3 items-end">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-500 mb-1">Date Range</label>
          <DateRangePicker from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
        </div>
        <button
          onClick={handleFilter}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Apply
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatsCard icon={<Activity className="w-5 h-5" />} value={total} label="Total Logs" color="blue" />
        <StatsCard icon={<Clock className="w-5 h-5" />} value={logs.filter(l => l.action === 'clock_in').length} label="Clock-ins" color="green" />
        <StatsCard icon={<Clock className="w-5 h-5" />} value={logs.filter(l => l.action === 'clock_out').length} label="Clock-outs" color="purple" />
      </div>

      {/* Table */}
      <Table
        columns={columns}
        data={logs}
        loading={loading}
        emptyText="No activity logs found for the selected date range"
        sortKey="created_at"
        sortDir="desc"
      />

      <Pagination
        currentPage={page}
        totalPages={Math.ceil(total / PAGE_SIZE)}
        onPageChange={(p) => setPage(p)}
      />

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          Error loading logs: {error}
        </div>
      )}
    </div>
  );
}