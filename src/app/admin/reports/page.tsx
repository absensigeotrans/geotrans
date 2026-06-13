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
import { getWIBDaysAgo, getWIBDate, formatWIBTime, formatWIBDate, formatWIBTimeWithSeconds, formatWIBDateDisplay, formatWIBDateHeader } from '@/lib/timezone';
import { formatDistance } from '@/lib/utils';
import { Download, FileText, CheckCircle, Clock, XCircle, FileDown, AlertTriangle, Database, Sun, Sunset, Trash2, Calendar, Timer, FileSpreadsheet, Minus, ChevronDown, ChevronUp } from 'lucide-react';

const PAGE_SIZE = 100;

function formatDuration(minutes: number | null): string {
  if (!minutes || minutes <= 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

export default function ReportsPage() {
  const { profile } = useAuth();
  const { records, loading, fetchReportWithUsers, getStats, error, getShiftLabel, deleteByDate } = useReports();

  const [from, setFrom] = useState(() => getWIBDaysAgo(30));
  const [to, setTo] = useState(() => getWIBDate());
  const [status, setStatus] = useState<AttendanceStatus | ''>('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [mockFilter, setMockFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ total: 0, present: 0, late: 0, outside: 0, suspicious: 0, avgDistance: 0, totalOvertime: 0 });
  const [exportLoading, setExportLoading] = useState(false);
  // Sorting state
  const [sortKey, setSortKey] = useState<string>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteDate, setDeleteDate] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Grouped cards and expanded states
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});

  const load = useCallback(async (f = from, t = to, s = status, p = page, q = search) => {
    // driver_bebas doesn't use geofencing, so exclude 'outside_radius' status
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

  // Compute filtered records
  const filteredRecords = useMemo(() => {
    let recs = mockFilter === 'suspicious'
      ? records.filter((r) => r.is_mocked)
      : records;

    // Apply role filter
    if (roleFilter === 'driver') {
      recs = recs.filter((r) => r.profiles?.role === 'driver_bebas' || r.profiles?.role === 'driver_kantor');
    } else if (roleFilter === 'ob') {
      recs = recs.filter((r) => r.profiles?.role === 'ob');
    } else if (roleFilter === 'juru_parkir') {
      recs = recs.filter((r) => r.profiles?.role === 'juru_parkir');
    }

    // Apply sorting
    recs = [...recs].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'date':
          cmp = new Date(a.check_in_time).getTime() - new Date(b.check_in_time).getTime();
          break;
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
  }, [records, mockFilter, roleFilter, sortKey, sortDir]);

  // Update stats when filtered records change
  useEffect(() => {
    const computed = getStats(filteredRecords);
    const totalOvertime = filteredRecords.reduce((s, r) => s + (r.overtime_minutes || 0), 0);
    setStats({ ...computed, totalOvertime });
  }, [filteredRecords, getStats]);

  // Group filtered records by date
  const groupedByDate = useMemo(() => {
    const groups: Record<string, any[]> = {};
    filteredRecords.forEach((record) => {
      const dateKey = formatWIBDate(record.check_in_time);
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(record);
    });

    // Sort dates descending
    return Object.keys(groups)
      .sort((a, b) => b.localeCompare(a))
      .reduce<Record<string, any[]>>((acc, key) => {
        acc[key] = groups[key];
        return acc;
      }, {});
  }, [filteredRecords]);

  // Auto-expand the first date card by default
  useEffect(() => {
    const dates = Object.keys(groupedByDate);
    if (dates.length > 0) {
      setExpandedDates((prev) => {
        if (Object.keys(prev).length > 0) return prev;
        return { [dates[0]]: true };
      });
    }
  }, [groupedByDate]);

  const handleExpandAll = () => {
    const allExpanded: Record<string, boolean> = {};
    Object.keys(groupedByDate).forEach((dateKey) => {
      allExpanded[dateKey] = true;
    });
    setExpandedDates(allExpanded);
  };

  const handleCollapseAll = () => {
    setExpandedDates({});
  };

  const handleFilter = () => {
    setPage(1);
    load(from, to, status, 1, search);
  };

  const handleReset = () => {
    setFrom(getWIBDaysAgo(30));
    setTo(getWIBDate());
    setStatus('');
    setRoleFilter('');
    setMockFilter('');
    setSearch('');
    setPage(1);
    setSortKey('date');
    setSortDir('desc');
    load(getWIBDaysAgo(30), getWIBDate(), '', 1, '');
  };

  // Handle sort
  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  // CSV Export of currently displayed records
  const exportCSV = () => {
    const headers = ['Employee', 'Date', 'Check-in Time', 'Check-out Time', 'Jam Kerja', 'Lembur', 'Status', 'Shift', 'Distance', 'Role', 'Work Status', 'Suspicious'];
     const rows = filteredRecords.map((r: any) => [
       r.profiles?.full_name || '',
       formatWIBDateDisplay(r.check_in_time).replace(/ /g, '-'),
       formatWIBTimeWithSeconds(r.check_in_time),
       r.check_out_time ? formatWIBTimeWithSeconds(r.check_out_time) : '',
       formatDuration(r.work_duration_minutes),
       formatDuration(r.overtime_minutes),
       r.status,
       getShiftLabel(r.shift_type),
       (r.distance_from_office || 0).toFixed(2) + 'm',
       (r.profiles?.role || '').replace(/_/g, ' '),
       r.work_status ?? '-',
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

    const headers = [['Employee', 'Check-in', 'Check-out', 'Jam Kerja', 'Lembur', 'Status', 'Shift', 'Distance', 'Role', 'Work Status', 'Suspicious']];
    
    // Group records by date for PDF export
    const grouped: Record<string, any[]> = {};
    filteredRecords.forEach((r: any) => {
      const dateKey = formatWIBDate(r.check_in_time);
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(r);
    });

    const rows: any[] = [];
    Object.keys(grouped).sort((a, b) => b.localeCompare(a)).forEach((dateKey) => {
      // Add section sub-header row for date
      rows.push([
        {
          content: formatWIBDateHeader(dateKey),
          colSpan: 11,
          styles: { fillColor: [239, 246, 255], fontStyle: 'bold', textColor: [29, 78, 216], halign: 'left' }
        }
      ]);
      
      // Add records for that date
      grouped[dateKey].forEach((r: any) => {
        rows.push([
          r.profiles?.full_name || '—',
          formatWIBTime(r.check_in_time),
          r.check_out_time ? formatWIBTime(r.check_out_time) : '—',
          formatDuration(r.work_duration_minutes),
          formatDuration(r.overtime_minutes),
          r.status.replace('_', ' '),
          getShiftLabel(r.shift_type),
          formatDistance(r.distance_from_office || 0),
          (r.profiles?.role || '—').replace(/_/g, ' '),
          r.work_status ?? '—',
          r.is_mocked ? 'YES' : 'NO',
        ]);
      });
    });

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
  };

  const exportXLSX = async () => {
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Admin';
    const ws = wb.addWorksheet('Attendance Report');

    const statusDisplay: Record<string, string> = {
      present: 'Hadir',
      late: 'Terlambat',
      outside_radius: 'Luar Area',
    };

    ws.columns = [
      { width: 22 }, // Employee
      { width: 14 }, // Check-in
      { width: 14 }, // Check-out
      { width: 14 }, // Jam Kerja
      { width: 14 }, // Lembur
      { width: 14 }, // Status
      { width: 14 }, // Shift
      { width: 14 }, // Distance
      { width: 14 }, // Role
      { width: 14 }, // Work Status
      { width: 14 }, // Suspicious
    ];

    const borderThin = {
      top: { style: 'thin' as const, color: { argb: 'E5E7EB' } },
      left: { style: 'thin' as const, color: { argb: 'E5E7EB' } },
      bottom: { style: 'thin' as const, color: { argb: 'E5E7EB' } },
      right: { style: 'thin' as const, color: { argb: 'E5E7EB' } },
    };

    const r1 = ws.addRow([`Attendance Report (${from} to ${to})`]);
    ws.mergeCells(1, 1, 1, 11);
    r1.font = { bold: true, size: 14, color: { argb: 'FFFFFF' } };
    r1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '2563EB' } };
    r1.alignment = { vertical: 'middle', horizontal: 'left' };
    r1.height = 32;

    const r2 = ws.addRow([`Generated: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`]);
    ws.mergeCells(2, 1, 2, 11);
    r2.font = { size: 11, italic: true, color: { argb: '6B7280' } };
    r2.height = 22;

    ws.addRow([]);

    const headerRow = ws.addRow([
      'Employee', 'Check-in', 'Check-out', 'Jam Kerja', 'Lembur',
      'Status', 'Shift', 'Distance', 'Role', 'Work Status', 'Suspicious',
    ]);
    headerRow.font = { bold: true, color: { argb: 'FFFFFF' }, size: 11 };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '2563EB' } };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.height = 24;
    headerRow.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });

    // Group records by date for XLSX export
    const grouped: Record<string, any[]> = {};
    filteredRecords.forEach((r: any) => {
      const dateKey = formatWIBDate(r.check_in_time);
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(r);
    });

    Object.keys(grouped).sort((a, b) => b.localeCompare(a)).forEach((dateKey) => {
      // 1. Add date group header row
      const dateHeaderRow = ws.addRow([formatWIBDateHeader(dateKey)]);
      ws.mergeCells(dateHeaderRow.number, 1, dateHeaderRow.number, 11);
      dateHeaderRow.font = { bold: true, size: 11, color: { argb: '1D4ED8' } };
      dateHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'EFF6FF' } };
      dateHeaderRow.alignment = { vertical: 'middle', horizontal: 'left' };
      dateHeaderRow.height = 26;
      
      dateHeaderRow.eachCell((cell) => {
        cell.border = borderThin;
      });

      // 2. Add employee rows
      grouped[dateKey].forEach((r: any) => {
        const statusColor: Record<string, { bg: string; fg: string }> = {
          present: { bg: 'DCFCE7', fg: '166534' },
          late: { bg: 'FFEDD5', fg: '9A3412' },
          outside_radius: { bg: 'DBEAFE', fg: '1E40AF' },
        };
        const colors = statusColor[r.status] || { bg: 'F3F4F6', fg: '374151' };

        const row = ws.addRow([
          r.profiles?.full_name || '',
          formatWIBTime(r.check_in_time),
          r.check_out_time ? formatWIBTime(r.check_out_time) : '',
          formatDuration(r.work_duration_minutes ?? null),
          formatDuration(r.overtime_minutes ?? null),
          statusDisplay[r.status] || r.status,
          getShiftLabel(r.shift_type),
          formatDistance(r.distance_from_office || 0),
          (r.profiles?.role || '').replace(/_/g, ' '),
          r.work_status ?? '-',
          r.is_mocked ? 'YES' : 'NO',
        ]);

        row.getCell(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.bg } };
        row.getCell(6).font = { color: { argb: colors.fg } };
        row.getCell(11).font = r.is_mocked ? { color: { argb: 'DC2626' }, bold: true } : {};

        row.eachCell((cell) => {
          cell.border = borderThin;
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });

        row.height = 20;
      });
    });

    ws.addRow([]);
    const sr = ws.addRow([`Total: ${filteredRecords.length} records`]);
    ws.mergeCells(sr.number, 1, sr.number, 11);
    sr.font = { italic: true, size: 10, color: { argb: '6B7280' } };

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance_report_${from}_to_${to}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filteredRecords.length} records`);
  };

  // Open delete modal
  const openDeleteModal = () => {
    setDeleteDate(getWIBDate());
    setShowDeleteModal(true);
  };

  // Handle delete by date
  const handleDeleteByDate = async () => {
    if (!deleteDate) {
      toast.error('Pilih tanggal terlebih dahulu');
      return;
    }
    setDeleting(true);
    const result = await deleteByDate(deleteDate);
    setDeleting(false);

    if (result.success) {
      setShowDeleteModal(false);
      // Refresh data
      load(from, to, status, 1, search);
      // Show success with count
      if (result.count === 0) {
        toast.info('Tidak ada data kehadiran untuk tanggal tersebut');
      } else {
        toast.success(result.message || `Berhasil menghapus ${result.count} data`);
      }
    } else {
      toast.error(result.error || 'Gagal menghapus data');
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
      key: 'work_duration',
      header: 'Jam Kerja',
      render: (row: any) => formatDuration(row.work_duration_minutes),
    },
    {
      key: 'overtime',
      header: 'Lembur',
      sortable: true,
      render: (row: any) => (
        <span className={row.overtime_minutes > 0 ? 'text-orange-600 font-medium' : 'text-gray-400'}>
          {formatDuration(row.overtime_minutes)}
        </span>
      ),
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

        const iconMap: Record<string, [typeof Sun, string]> = {
          morning: [Sun, 'text-yellow-600'],
          afternoon: [Sunset, 'text-orange-500'],
          full_time: [Clock, 'text-blue-600'],
          non_shifting: [Minus, 'text-gray-400'],
        };
        const [Icon, color] = iconMap[row.shift_type] || [Sun, 'text-gray-400'];

        const colorMap: Record<string, string> = {
          morning: 'text-yellow-700',
          afternoon: 'text-orange-700',
          full_time: 'text-blue-700',
          non_shifting: 'text-gray-500',
        };

        return (
          <div className="flex items-center gap-1">
            <Icon className={`w-3 h-3 ${color}`} />
            <span className={`text-xs font-medium ${colorMap[row.shift_type] || 'text-gray-500'}`}>
              {shiftLabel}
            </span>
          </div>
        );
      },
    },
    {
      key: 'work_status',
      header: 'Work Status',
      render: (row: any) => {
        const ws = row.work_status || '—';
        const map: Record<string, string> = {
          WFO: 'text-blue-700 bg-blue-100',
          WFH: 'text-green-700 bg-green-100',
          DINAS: 'text-purple-700 bg-purple-100',
          LAINNYA: 'text-gray-700 bg-gray-100',
        };
        return (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${map[ws] || 'text-gray-700 bg-gray-100'}`}>
            {ws}
          </span>
        );
      },
    },
    {
      key: 'role',
      header: 'Role',
      render: (row: any) => {
        const role = row.profiles?.role || '—';
        const map: Record<string, string> = {
          admin: 'text-blue-700 bg-blue-100',
          karyawan: 'text-gray-700 bg-gray-100',
          driver_bebas: 'text-green-700 bg-green-100',
          driver_kantor: 'text-green-700 bg-green-100',
          juru_parkir: 'text-orange-700 bg-orange-100',
        };
        return (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${map[role] || 'text-gray-700 bg-gray-100'}`}>
            {role.replace(/_/g, ' ')}
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border p-5">
        <div className="flex flex-col lg:flex-row gap-3 items-end">
          {/* Search Input */}
          <div className="w-full lg:w-64">
            <label className="block text-xs font-medium text-gray-500 mb-1">Search Employee</label>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search name..."
            />
          </div>
          {/* Date Range */}
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1">Date Range</label>
            <DateRangePicker from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
          </div>
          {/* Status Filter */}
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
          {/* Role Filter */}
          <div className="w-full lg:w-48">
            <label className="block text-xs font-medium text-gray-500 mb-1">Role</label>
            <select
              value={roleFilter}
              onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
              className="w-full px-3 py-2.5 border rounded-xl text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="" className="text-gray-900 bg-white">All Roles</option>
              <option value="driver" className="text-gray-900 bg-white">Driver</option>
              <option value="ob" className="text-gray-900 bg-white">OB</option>
              <option value="juru_parkir" className="text-gray-900 bg-white">Juru Parkir</option>
            </select>
          </div>
          {/* Location Anomaly Filter */}
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
          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button onClick={handleFilter}>Apply Filters</Button>
            <Button variant="ghost" onClick={handleReset}>Reset</Button>
          </div>
        </div>
        {/* Export Buttons Row */}
        <div className="flex gap-2 mt-3 pt-3 border-t flex-wrap">
          <Button variant="secondary" onClick={exportCSV}>
            <Download className="w-4 h-4" /> Export CSV ({filteredRecords.length})
          </Button>
          <Button variant="secondary" onClick={exportPDF}>
            <FileDown className="w-4 h-4" /> Export PDF ({filteredRecords.length})
          </Button>
          <Button variant="secondary" onClick={exportXLSX}>
            <FileSpreadsheet className="w-4 h-4" /> Export XLSX ({filteredRecords.length})
          </Button>
          {filteredRecords.length > 1000 && (
            <span className="flex items-center gap-1 text-xs text-yellow-600 ml-2">
              <AlertTriangle className="w-3 h-3" />
              Large export ({filteredRecords.length} records)
            </span>
          )}
          {/* Delete Button */}
          <div className="ml-auto">
            <Button variant="danger" onClick={openDeleteModal}>
              <Trash2 className="w-4 h-4" /> Hapus Data
            </Button>
          </div>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard icon={<FileText className="w-5 h-5" />} value={stats.total} label="Total Records" color="blue" />
        <StatsCard icon={<CheckCircle className="w-5 h-5" />} value={stats.present} label="Present" color="green" />
        <StatsCard icon={<Clock className="w-5 h-5" />} value={stats.late} label="Late" color="yellow" />
        <StatsCard icon={<AlertTriangle className="w-5 h-5" />} value={stats.suspicious} label="Kejanggalan" color="red" />
        <StatsCard icon={<Timer className="w-5 h-5" />} value={formatDuration(stats.totalOvertime)} label="Total Lembur" color="orange" />
      </div>

      {/* Expand/Collapse All Controls */}
      {!loading && Object.keys(groupedByDate).length > 0 && (
        <div className="flex justify-end gap-2 text-xs">
          <Button variant="ghost" size="sm" onClick={handleExpandAll} className="h-8">
            Expand All
          </Button>
          <Button variant="ghost" size="sm" onClick={handleCollapseAll} className="h-8">
            Collapse All
          </Button>
        </div>
      )}

      {/* Grouped Day Cards */}
      {loading ? (
        <div className="flex items-center justify-center py-20 bg-white rounded-xl border">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : Object.keys(groupedByDate).length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center text-gray-500">
          No attendance records found for the selected filters
        </div>
      ) : (
        <div className="space-y-4">
          {Object.keys(groupedByDate).map((dateKey) => {
            const dayRecords = groupedByDate[dateKey];
            const isExpanded = !!expandedDates[dateKey];
            
            // Calculate stats for this day
            const dayStats = dayRecords.reduce((acc, r) => {
              acc.total++;
              if (r.status === 'present') acc.present++;
              if (r.status === 'late') acc.late++;
              if (r.status === 'outside_radius') acc.outside++;
              if (r.is_mocked) acc.suspicious++;
              return acc;
            }, { total: 0, present: 0, late: 0, outside: 0, suspicious: 0 });

            // Columns without redundant Date column
            const cardColumns = columns.filter((col) => col.key !== 'date');

            return (
              <div key={dateKey} className="bg-white rounded-xl border shadow-sm overflow-hidden transition-all duration-200">
                {/* Header */}
                <button
                  onClick={() => setExpandedDates(prev => ({ ...prev, [dateKey]: !prev[dateKey] }))}
                  className="w-full px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-gray-800 text-lg">
                      {formatWIBDateHeader(dayRecords[0].check_in_time)}
                    </span>
                    <div className="flex flex-wrap gap-1.5 items-center">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 border">
                        {dayStats.total} Total
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-100">
                        {dayStats.present} Hadir
                      </span>
                      {dayStats.late > 0 && (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-yellow-50 text-yellow-700 border border-yellow-100">
                          {dayStats.late} Terlambat
                        </span>
                      )}
                      {dayStats.outside > 0 && (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                          {dayStats.outside} Luar Radius
                        </span>
                      )}
                      {dayStats.suspicious > 0 && (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-100">
                          {dayStats.suspicious} Kejanggalan
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-auto sm:ml-0">
                    <span className="text-xs text-gray-400 font-medium">
                      {isExpanded ? 'Tutup Detail' : 'Lihat Detail'}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-gray-500" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-500" />
                    )}
                  </div>
                </button>

                {/* Body (Table) */}
                {isExpanded && (
                  <div className="border-t">
                    <Table
                      columns={cardColumns}
                      data={dayRecords}
                      loading={false}
                      emptyText="Tidak ada data untuk tanggal ini"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={handleSort}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      <Pagination
        currentPage={page}
        totalPages={Math.ceil(total / PAGE_SIZE)}
        onPageChange={(p) => { setPage(p); load(from, to, status, p, search); }}
      />

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="bg-red-600 px-6 py-4 flex items-center gap-3">
              <Trash2 className="w-5 h-5 text-white" />
              <h3 className="text-lg font-semibold text-white">Hapus Data Kehadiran</h3>
            </div>
            <div className="p-6">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-1">Peringatan! Aksi ini tidak dapat dibatalkan.</h4>
                  <p className="text-sm text-gray-600">
                    Semua data kehadiran pada tanggal yang dipilih akan dihapus secara permanen.
                  </p>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Pilih Tanggal
                </label>
                <input
                  type="date"
                  value={deleteDate}
                  onChange={(e) => setDeleteDate(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  max={getWIBDate()}
                />
              </div>

              {deleteDate && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
                  <p className="text-sm text-yellow-800">
                    <strong>Catatan:</strong> Data kehadiran untuk tanggal{' '}
                    <strong>{formatWIBDateDisplay(deleteDate + 'T00:00:00')}</strong>{' '}
                    akan dihapus secara permanen.
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  variant="ghost"
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1"
                  disabled={deleting}
                >
                  Batal
                </Button>
                <Button
                  variant="danger"
                  onClick={handleDeleteByDate}
                  className="flex-1"
                  disabled={!deleteDate || deleting}
                >
                  {deleting ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Menghapus...
                    </span>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Hapus Permanen
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}