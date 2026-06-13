'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useReports } from '@/hooks/useReports';
import { useAuth } from '@/context/AuthContext';
import { SearchInput } from '@/components/ui/SearchInput';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import { Pagination } from '@/components/ui/Pagination';
import { StatsCard } from '@/components/ui/StatsCard';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Table } from '@/components/ui/Table';
import { toast } from '@/components/ui/Toast';
import { Attendance, AttendanceStatus, ShiftType } from '@/types';
import { format } from 'date-fns';
import { getWIBDaysAgo, getWIBDate, formatWIBTime, formatWIBTimeWithSeconds, formatWIBDateDisplay } from '@/lib/timezone';
import { formatDistance } from '@/lib/utils';
import { Download, FileText, CheckCircle, Clock, XCircle, FileDown, AlertTriangle, Sun, Sunset } from 'lucide-react';

const PAGE_SIZE = 50;

export default function ViewerReportsPage() {
  const { profile } = useAuth();
  const { records, loading, fetchReportWithUsers, getStats, error, getShiftLabel } = useReports();

  const [from, setFrom] = useState(() => getWIBDaysAgo(30));
  const [to, setTo] = useState(() => getWIBDate());
  const [status, setStatus] = useState<AttendanceStatus | ''>('');
  const [mockFilter, setMockFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ total: 0, present: 0, late: 0, outside: 0, suspicious: 0, avgDistance: 0 });
  const [exportLoading, setExportLoading] = useState(false);
  const [sortKey, setSortKey] = useState<string>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const load = useCallback(async (f = from, t = to, s = status, p = page, q = search) => {
    const isDriver = profile?.role === 'driver_bebas';
    const result = await fetchReportWithUsers({
      from: f,
      to: t,
      status: s || undefined,
      search: q || undefined,
      excludeOutsideRadius: isDriver,
    }, p, PAGE_SIZE);
    setTotal(result.count);
  }, [fetchReportWithUsers, page, profile?.role]);

  useEffect(() => { load(); }, [load]);

  const filteredRecords = useMemo(() => {
    let recs = mockFilter === 'suspicious'
      ? records.filter((r) => r.is_mocked)
      : records;

    recs = [...recs].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'date':
        case 'time':
          cmp = new Date(a.check_in_time).getTime() - new Date(b.check_in_time).getTime();
          break;
        case 'check_out':
          const aOut = a.check_out_time ? new Date(a.check_out_time).getTime() : 0;
          const bOut = b.check_out_time ? new Date(b.check_out_time).getTime() : 0;
          cmp = aOut - bOut;
          break;
        case 'distance':
          cmp = (a.distance_from_office || 0) - (b.distance_from_office || 0);
          break;
        default:
          cmp = 0;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return recs;
  }, [records, mockFilter, sortKey, sortDir]);

  useEffect(() => {
    const computed = getStats(filteredRecords);
    setStats(computed);
  }, [filteredRecords, getStats]);

  const handleFilter = () => {
    setPage(1);
    load(from, to, status, 1, search);
  };

  const handleReset = () => {
    setFrom(getWIBDaysAgo(30));
    setTo(getWIBDate());
    setStatus('');
    setMockFilter('');
    setSearch('');
    setPage(1);
    setSortKey('date');
    setSortDir('desc');
    load(getWIBDaysAgo(30), getWIBDate(), '', 1, '');
  };

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const exportCSV = () => {
    const headers = ['Employee', 'Date', 'Check-in Time', 'Check-out Time', 'Status', 'Shift', 'Distance', 'Lat', 'Lng', 'Suspicious'];
    const rows = filteredRecords.map((r: any) => [
      r.profiles?.full_name || '',
      formatWIBDateDisplay(r.check_in_time).replace(/ /g, '-'),
      formatWIBTimeWithSeconds(r.check_in_time),
      r.check_out_time ? formatWIBTimeWithSeconds(r.check_out_time) : '',
      r.status,
      getShiftLabel(r.shift_type),
      (r.distance_from_office || 0).toFixed(2) + 'm',
      r.check_in_latitude || '',
      r.check_in_longitude || '',
      r.is_mocked ? 'YES' : 'NO',
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance_report_${from}_to_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filteredRecords.length} records`);
  };

  const exportPDF = async () => {
    setExportLoading(true);
    try {
      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ]);

      const doc = new jsPDF('landscape');
      const title = `Attendance Report (${from} to ${to})`;
      doc.setFontSize(16);
      doc.text(title, 14, 16);
      doc.setFontSize(10);
      doc.text(`Generated: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`, 14, 23);
      doc.text(`Total: ${stats.total} | Present: ${stats.present} | Late: ${stats.late} | Outside: ${stats.outside} | Avg: ${formatDistance(stats.avgDistance)}`, 14, 30);

      const headers = [['Employee', 'Date', 'Check-in', 'Check-out', 'Status', 'Shift', 'Distance', 'Coordinates', 'Suspicious']];
      const rows = filteredRecords.map((r: any) => [
        r.profiles?.full_name || '—',
        formatWIBDateDisplay(r.check_in_time),
        formatWIBTime(r.check_in_time),
        r.check_out_time ? formatWIBTime(r.check_out_time) : '—',
        r.status.replace('_', ' '),
        getShiftLabel(r.shift_type),
        formatDistance(r.distance_from_office || 0),
        `${r.check_in_latitude?.toFixed(4) || '-'}, ${r.check_in_longitude?.toFixed(4) || '-'}`,
        r.is_mocked ? 'YES' : 'NO',
      ]);

      autoTable(doc, {
        head: headers,
        body: rows,
        startY: 36,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [37, 99, 235] },
        alternateRowStyles: { fillColor: [245, 247, 250] },
      });

      doc.save(`attendance_report_${from}_to_${to}.pdf`);
      toast.success(`Exported ${filteredRecords.length} records`);
    } catch (err) {
      console.error('Failed to export PDF:', err);
      toast.error('Failed to export PDF');
    } finally {
      setExportLoading(false);
    }
  };

  const columns = [
    {
      key: 'user',
      header: 'Employee',
      render: (row: any) => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-semibold">
            {(row.profiles?.full_name || '?').charAt(0).toUpperCase()}
          </div>
          <span className="font-medium text-gray-900">{row.profiles?.full_name ?? '—'}</span>
        </div>
      ),
    },
    {
      key: 'date',
      header: 'Date',
      sortable: true,
      render: (row: any) => formatWIBDateDisplay(row.check_in_time),
    },
    {
      key: 'time',
      header: 'Check-in',
      sortable: true,
      render: (row: any) => formatWIBTime(row.check_in_time),
    },
    {
      key: 'check_out',
      header: 'Check-out',
      sortable: true,
      render: (row: any) => row.check_out_time ? formatWIBTime(row.check_out_time) : '—',
    },
    {
      key: 'status',
      header: 'Status',
      render: (row: any) => (
        <div className="flex items-center gap-2">
          <Badge variant={row.status === 'present' ? 'success' : row.status === 'late' ? 'warning' : 'danger'}>
            {row.status.replace('_', ' ')}
          </Badge>
          {row.is_mocked && (
            <Badge variant="danger">Suspicious</Badge>
          )}
        </div>
      ),
    },
    {
      key: 'shift',
      header: 'Shift',
      render: (row: any) => {
        const shiftLabel = getShiftLabel(row.shift_type);
        if (!row.shift_type) return <span className="text-gray-400 text-xs">—</span>;
        return (
          <div className="flex items-center gap-1">
            {row.shift_type === 'morning' ? (
              <Sun className="w-3 h-3 text-yellow-600" />
            ) : (
              <Sunset className="w-3 h-3 text-orange-500" />
            )}
            <span className={`text-xs font-medium ${row.shift_type === 'morning' ? 'text-yellow-700' : 'text-orange-700'}`}>
              {shiftLabel}
            </span>
          </div>
        );
      },
    },
    {
      key: 'distance',
      header: 'Distance',
      sortable: true,
      render: (row: any) => formatDistance(row.distance_from_office || 0),
    },
    {
      key: 'location',
      header: 'Location',
      render: (row: any) => (
        <span className="text-xs text-gray-500">
          {row.check_in_latitude?.toFixed(4) ?? '-'}, {row.check_in_longitude?.toFixed(4) ?? '-'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl shadow-sm border p-5">
        <div className="flex flex-col lg:flex-row gap-3 items-end">
          <div className="w-full lg:w-64">
            <label className="block text-xs font-medium text-gray-500 mb-1">Search Employee</label>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search name..."
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1">Date Range</label>
            <DateRangePicker from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
          </div>
          <div className="w-full lg:w-48">
            <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as AttendanceStatus | '')}
              className="w-full px-3 py-2.5 border rounded-xl text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="" className="text-gray-900 bg-white">All Status</option>
              <option value="present" className="text-gray-900 bg-white">Present</option>
              <option value="late" className="text-gray-900 bg-white">Late</option>
            </select>
          </div>
          <div className="w-full lg:w-48">
            <label className="block text-xs font-medium text-gray-500 mb-1">Kejanggalan Lokasi</label>
            <select
              value={mockFilter}
              onChange={(e) => { setMockFilter(e.target.value); setPage(1); }}
              className="w-full px-3 py-2.5 border rounded-xl text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="" className="text-gray-900 bg-white">Semua Records</option>
              <option value="suspicious" className="text-gray-900 bg-white">Hanya Kejanggalan</option>
            </select>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleFilter}>Apply Filters</Button>
            <Button variant="ghost" onClick={handleReset}>Reset</Button>
          </div>
        </div>
        <div className="flex gap-2 mt-3 pt-3 border-t flex-wrap">
          <Button variant="secondary" onClick={exportCSV}>
            <Download className="w-4 h-4" /> Export CSV ({filteredRecords.length})
          </Button>
          <Button variant="secondary" onClick={exportPDF}>
            <FileDown className="w-4 h-4" /> Export PDF ({filteredRecords.length})
          </Button>
          {filteredRecords.length > 1000 && (
            <span className="flex items-center gap-1 text-xs text-yellow-600 ml-2">
              <AlertTriangle className="w-3 h-3" />
              Large export ({filteredRecords.length} records)
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard icon={<FileText className="w-5 h-5" />} value={stats.total} label="Total Records" color="blue" />
        <StatsCard icon={<CheckCircle className="w-5 h-5" />} value={stats.present} label="Present" color="green" />
        <StatsCard icon={<Clock className="w-5 h-5" />} value={stats.late} label="Late" color="yellow" />
        <StatsCard icon={<AlertTriangle className="w-5 h-5" />} value={stats.suspicious} label="Kejanggalan" color="red" />
      </div>

      <Table
        columns={columns}
        data={filteredRecords}
        loading={loading}
        emptyText="No attendance records found for the selected filters"
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={handleSort}
      />

      <Pagination
        currentPage={page}
        totalPages={Math.ceil(total / PAGE_SIZE)}
        onPageChange={(p) => { setPage(p); load(from, to, status, p, search); }}
      />
    </div>
  );
}
