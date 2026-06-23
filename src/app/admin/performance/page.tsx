'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { StatsCard } from '@/components/ui/StatsCard';
import { Button } from '@/components/ui/Button';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import { SearchInput } from '@/components/ui/SearchInput';
import { Table } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { toast } from '@/components/ui/Toast';
import { getWIBDaysAgo, getWIBDate, getWIBDateRange, formatWIBDate, formatWIBTime, formatWIBDateDisplay } from '@/lib/timezone';
import { Award, Clock, Timer, Users, Download, FileSpreadsheet, FileDown, Briefcase } from 'lucide-react';

interface EmployeePerformance {
  id: string;
  name: string;
  employee_id: string;
  nik: string;
  role: string;
  totalWorkMinutes: number;
  totalOvertimeMinutes: number;
  presentDays: number;
  avgWorkingMinutes: number;
  records: any[];
}

function formatDuration(minutes: number | null): string {
  if (minutes === null || minutes === undefined || minutes <= 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}j ${m}m`;
}

function formatDurationLong(minutes: number | null): string {
  if (minutes === null || minutes === undefined || minutes <= 0) return '0 jam';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h} jam`;
  return `${h} jam ${m} menit`;
}

const formatRole = (role: string) => {
  const map: Record<string, string> = {
    admin: 'Admin',
    ob: 'OB',
    driver_bebas: 'Driver Bebas',
    driver_kantor: 'Driver Kantor',
    juru_parkir: 'Juru Parkir',
  };
  return map[role] || role.replace(/_/g, ' ');
};

export default function PerformancePage() {
  const [from, setFrom] = useState(() => getWIBDaysAgo(30));
  const [to, setTo] = useState(() => getWIBDate());
  const [loading, setLoading] = useState(false);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [sortKey, setSortKey] = useState<string>('totalWorkMinutes');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeePerformance | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch profiles (excluding admin and inactive)
      const { data: profilesData, error: profileErr } = await supabase
        .from('profiles')
        .select('id, full_name, employee_id, nik, role')
        .not('role', 'in', '("admin","inactive")')
        .order('full_name');

      if (profileErr) throw profileErr;

      // 2. Fetch attendance
      const { start } = getWIBDateRange(from);
      const { end } = getWIBDateRange(to);

      const { data: attendanceData, error: attErr } = await supabase
        .from('attendance')
        .select('id, user_id, check_in_time, check_out_time, work_duration_minutes, overtime_minutes, status, is_mocked')
        .gte('check_in_time', start)
        .lte('check_in_time', end)
        .order('check_in_time', { ascending: false });

      if (attErr) throw attErr;

      setProfiles(profilesData || []);
      setAttendance(attendanceData || []);
    } catch (err: any) {
      console.error('Error fetching performance data:', err);
      setError(err?.message || 'Gagal memuat data performa');
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Aggregate attendance data per employee
  const aggregatedData = useMemo(() => {
    if (profiles.length === 0) return [];

    const attByUser: Record<string, any[]> = {};
    attendance.forEach((rec) => {
      if (!attByUser[rec.user_id]) {
        attByUser[rec.user_id] = [];
      }
      attByUser[rec.user_id].push(rec);
    });

    return profiles.map((p) => {
      const userAtt = attByUser[p.id] || [];
      
      let totalWorkMinutes = 0;
      let totalOvertimeMinutes = 0;
      const uniqueDays = new Set<string>();

      userAtt.forEach((r) => {
        totalWorkMinutes += (r.work_duration_minutes || 0);
        totalOvertimeMinutes += (r.overtime_minutes || 0);
        uniqueDays.add(formatWIBDate(r.check_in_time));
      });

      const presentDays = uniqueDays.size;
      const avgWorkingMinutes = presentDays > 0 ? Math.round(totalWorkMinutes / presentDays) : 0;

      return {
        id: p.id,
        name: p.full_name,
        employee_id: p.employee_id || '—',
        nik: p.nik || '—',
        role: p.role,
        totalWorkMinutes,
        totalOvertimeMinutes,
        presentDays,
        avgWorkingMinutes,
        records: userAtt.sort((a, b) => new Date(b.check_in_time).getTime() - new Date(a.check_in_time).getTime()),
      };
    });
  }, [profiles, attendance]);

  // Apply filters and sorting
  const filteredData = useMemo(() => {
    let result = aggregatedData;

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.nik.toLowerCase().includes(q) ||
          item.employee_id.toLowerCase().includes(q)
      );
    }

    // Role filter
    if (roleFilter) {
      if (roleFilter === 'driver') {
        result = result.filter((item) => item.role === 'driver_bebas' || item.role === 'driver_kantor');
      } else {
        result = result.filter((item) => item.role === roleFilter);
      }
    }

    // Sort
    result = [...result].sort((a, b) => {
      const valA = (a as any)[sortKey];
      const valB = (b as any)[sortKey];

      if (typeof valA === 'string') {
        return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }

      return sortDir === 'asc' ? valA - valB : valB - valA;
    });

    return result;
  }, [aggregatedData, search, roleFilter, sortKey, sortDir]);

  // General summary statistics
  const stats = useMemo(() => {
    let totalWorkMinutes = 0;
    let totalOvertimeMinutes = 0;
    let activeEmployees = 0;
    let sumAvgMinutes = 0;

    aggregatedData.forEach((emp) => {
      totalWorkMinutes += emp.totalWorkMinutes;
      totalOvertimeMinutes += emp.totalOvertimeMinutes;
      if (emp.presentDays > 0) {
        activeEmployees++;
        sumAvgMinutes += emp.avgWorkingMinutes;
      }
    });

    const avgWorkingMinutes = activeEmployees > 0 ? Math.round(sumAvgMinutes / activeEmployees) : 0;

    return {
      totalWorkMinutes,
      totalOvertimeMinutes,
      activeEmployees,
      avgWorkingMinutes,
    };
  }, [aggregatedData]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const handleReset = () => {
    setFrom(getWIBDaysAgo(30));
    setTo(getWIBDate());
    setSearch('');
    setRoleFilter('');
    setSortKey('totalWorkMinutes');
    setSortDir('desc');
  };

  const getStatusBadge = (status: string, isMocked: boolean) => {
    if (isMocked) {
      return (
        <div className="flex gap-1 flex-wrap">
          <Badge variant="danger">{status.replace('_', ' ')}</Badge>
          <Badge variant="danger">Suspicious</Badge>
        </div>
      );
    }
    const variant = status === 'present' ? 'success' : status === 'late' ? 'warning' : 'danger';
    return <Badge variant={variant}>{status.replace('_', ' ')}</Badge>;
  };

  // Export functions
  const exportCSV = () => {
    const headers = ['Nama Karyawan', 'ID Karyawan', 'NIK', 'Role', 'Hari Hadir', 'Total Jam Kerja', 'Total Jam Lembur', 'Rerata Jam Kerja/Hari'];
    const rows = filteredData.map((emp) => [
      emp.name,
      emp.employee_id,
      emp.nik,
      formatRole(emp.role),
      emp.presentDays,
      formatDurationLong(emp.totalWorkMinutes),
      formatDurationLong(emp.totalOvertimeMinutes),
      formatDurationLong(emp.avgWorkingMinutes),
    ]);
    
    const csvContent = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
      
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `laporan_performa_karyawan_${from}_to_${to}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Laporan CSV berhasil diunduh');
  };

  const exportPDF = async () => {
    try {
      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ]);
      
      const doc = new jsPDF('landscape');
      doc.setFontSize(16);
      doc.text('Laporan Performa Karyawan', 14, 16);
      doc.setFontSize(10);
      doc.text(`Periode: ${formatWIBDateDisplay(from)} s/d ${formatWIBDateDisplay(to)}`, 14, 23);
      doc.text(`Generated: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`, 14, 30);
      
      const headers = [['Nama Karyawan', 'ID Karyawan', 'NIK', 'Role', 'Hari Hadir', 'Total Jam Kerja', 'Total Jam Lembur', 'Rerata Jam Kerja']];
      
      const rows = filteredData.map((emp) => [
        emp.name,
        emp.employee_id,
        emp.nik,
        formatRole(emp.role),
        emp.presentDays + ' hari',
        formatDurationLong(emp.totalWorkMinutes),
        formatDurationLong(emp.totalOvertimeMinutes),
        formatDurationLong(emp.avgWorkingMinutes),
      ]);
      
      autoTable(doc, {
        head: headers,
        body: rows,
        startY: 36,
        styles: { fontSize: 9 },
        headStyles: { fillColor: [37, 99, 235] },
        alternateRowStyles: { fillColor: [245, 247, 250] },
      });
      
      doc.save(`laporan_performa_karyawan_${from}_to_${to}.pdf`);
      toast.success('Laporan PDF berhasil diunduh');
    } catch (err) {
      console.error('Failed to export PDF:', err);
      toast.error('Gagal mengunduh laporan PDF');
    }
  };

  const exportXLSX = async () => {
    try {
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
      wb.creator = 'Admin';
      const ws = wb.addWorksheet('Performa Karyawan');
      
      ws.columns = [
        { width: 25 }, // Nama
        { width: 15 }, // ID
        { width: 18 }, // NIK
        { width: 15 }, // Role
        { width: 12 }, // Hari Hadir
        { width: 22 }, // Total Jam Kerja
        { width: 22 }, // Total Jam Lembur
        { width: 22 }, // Rerata Jam Kerja
      ];
      
      const borderThin = {
        top: { style: 'thin' as const, color: { argb: 'E5E7EB' } },
        left: { style: 'thin' as const, color: { argb: 'E5E7EB' } },
        bottom: { style: 'thin' as const, color: { argb: 'E5E7EB' } },
        right: { style: 'thin' as const, color: { argb: 'E5E7EB' } },
      };
      
      const r1 = ws.addRow([`Laporan Performa Karyawan (${from} s/d ${to})`]);
      ws.mergeCells(1, 1, 1, 8);
      r1.font = { bold: true, size: 14, color: { argb: 'FFFFFF' } };
      r1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '2563EB' } };
      r1.alignment = { vertical: 'middle', horizontal: 'left' };
      r1.height = 32;
      
      const r2 = ws.addRow([`Generated: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`]);
      ws.mergeCells(2, 1, 2, 8);
      r2.font = { size: 11, italic: true, color: { argb: '6B7280' } };
      r2.height = 22;
      
      ws.addRow([]);
      
      const headerRow = ws.addRow([
        'Nama Karyawan', 'ID Karyawan', 'NIK', 'Role', 'Hari Hadir', 'Total Jam Kerja', 'Total Jam Lembur', 'Rerata Jam Kerja'
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
      
      filteredData.forEach((emp) => {
        const row = ws.addRow([
          emp.name,
          emp.employee_id,
          emp.nik,
          formatRole(emp.role),
          emp.presentDays,
          formatDurationLong(emp.totalWorkMinutes),
          formatDurationLong(emp.totalOvertimeMinutes),
          formatDurationLong(emp.avgWorkingMinutes),
        ]);
        
        row.eachCell((cell) => {
          cell.border = borderThin;
          cell.alignment = { vertical: 'middle' };
        });
        row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };
        row.height = 20;
      });
      
      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `laporan_performa_karyawan_${from}_to_${to}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success('Laporan Excel (XLSX) berhasil diunduh');
    } catch (err) {
      console.error('Failed to export XLSX:', err);
      toast.error('Gagal mengunduh laporan Excel');
    }
  };

  const columns = [
    {
      key: 'name',
      header: 'Nama Karyawan',
      sortable: true,
      render: (row: EmployeePerformance) => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-semibold">
            {row.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex flex-col">
            <span className="font-medium text-gray-900">{row.name}</span>
            <span className="text-xs text-gray-400">ID: {row.employee_id}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      sortable: true,
      render: (row: EmployeePerformance) => (
        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          {formatRole(row.role)}
        </span>
      ),
    },
    {
      key: 'presentDays',
      header: 'Kehadiran',
      sortable: true,
      render: (row: EmployeePerformance) => (
        <span className="font-semibold text-gray-700">{row.presentDays} hari</span>
      ),
    },
    {
      key: 'totalWorkMinutes',
      header: 'Total Jam Kerja',
      sortable: true,
      render: (row: EmployeePerformance) => (
        <div className="flex items-center gap-1.5">
          <Clock className="w-4 h-4 text-blue-600 shrink-0" />
          <span className="font-medium">{formatDuration(row.totalWorkMinutes)}</span>
        </div>
      ),
    },
    {
      key: 'totalOvertimeMinutes',
      header: 'Total Jam Lembur',
      sortable: true,
      render: (row: EmployeePerformance) => (
        <div className="flex items-center gap-1.5">
          <Timer className={`w-4 h-4 shrink-0 ${row.totalOvertimeMinutes > 0 ? 'text-orange-500' : 'text-gray-400'}`} />
          <span className={row.totalOvertimeMinutes > 0 ? 'font-semibold text-orange-600' : 'text-gray-400'}>
            {formatDuration(row.totalOvertimeMinutes)}
          </span>
        </div>
      ),
    },
    {
      key: 'avgWorkingMinutes',
      header: 'Rerata Jam/Hari',
      sortable: true,
      render: (row: EmployeePerformance) => (
        <span className="text-gray-500 text-sm">{formatDuration(row.avgWorkingMinutes)}</span>
      ),
    },
  ];

  const modalColumns = [
    {
      key: 'date',
      header: 'Tanggal',
      render: (row: any) => formatWIBDateDisplay(row.check_in_time),
    },
    {
      key: 'check_in',
      header: 'Check-in',
      render: (row: any) => formatWIBTime(row.check_in_time),
    },
    {
      key: 'check_out',
      header: 'Check-out',
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
      render: (row: any) => (
        <span className={row.overtime_minutes > 0 ? 'text-orange-600 font-medium' : 'text-gray-400'}>
          {formatDuration(row.overtime_minutes)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row: any) => getStatusBadge(row.status, row.is_mocked),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative">
        <div className="absolute -left-4 top-0 bottom-0 w-1 bg-gradient-red-blue rounded-full" />
        <div className="pl-4">
          <h1 className="text-2xl font-bold text-gray-900">Performa Karyawan</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Analisis akumulasi jam kerja dan lembur karyawan secara berkala
          </p>
        </div>
      </div>

      {/* Filters Box */}
      <div className="bg-white rounded-xl shadow-sm border p-5">
        <div className="flex flex-col lg:flex-row gap-3 items-end">
          {/* Search Input */}
          <div className="w-full lg:w-72">
            <label className="block text-xs font-medium text-gray-500 mb-1">Cari Karyawan</label>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Cari nama, NIK, atau ID..."
            />
          </div>
          {/* Date Range Picker */}
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1">Rentang Tanggal</label>
            <DateRangePicker from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
          </div>
          {/* Role Filter */}
          <div className="w-full lg:w-56">
            <label className="block text-xs font-medium text-gray-500 mb-1">Role Jabatan</label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full px-3 py-2.5 border rounded-xl text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="" className="text-gray-900 bg-white">Semua Jabatan</option>
              <option value="driver" className="text-gray-900 bg-white">Driver</option>
              <option value="ob" className="text-gray-900 bg-white">OB</option>
              <option value="juru_parkir" className="text-gray-900 bg-white">Juru Parkir</option>
            </select>
          </div>
          {/* Action Buttons */}
          <div className="flex gap-2 shrink-0">
            <Button variant="ghost" onClick={handleReset}>Reset Filters</Button>
          </div>
        </div>

        {/* Exports Row */}
        <div className="flex gap-2 mt-4 pt-4 border-t flex-wrap">
          <Button variant="secondary" onClick={exportCSV} disabled={loading || filteredData.length === 0}>
            <Download className="w-4 h-4" /> Export CSV ({filteredData.length})
          </Button>
          <Button variant="secondary" onClick={exportPDF} disabled={loading || filteredData.length === 0}>
            <FileDown className="w-4 h-4" /> Export PDF ({filteredData.length})
          </Button>
          <Button variant="secondary" onClick={exportXLSX} disabled={loading || filteredData.length === 0}>
            <FileSpreadsheet className="w-4 h-4" /> Export XLSX ({filteredData.length})
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          icon={<Clock className="w-5 h-5" />}
          value={formatDuration(stats.totalWorkMinutes)}
          label="Total Jam Kerja"
          color="blue"
        />
        <StatsCard
          icon={<Timer className="w-5 h-5" />}
          value={formatDuration(stats.totalOvertimeMinutes)}
          label="Total Jam Lembur"
          color="orange"
        />
        <StatsCard
          icon={<Award className="w-5 h-5" />}
          value={formatDuration(stats.avgWorkingMinutes)}
          label="Rerata Jam Kerja / Karyawan"
          color="purple"
        />
        <StatsCard
          icon={<Users className="w-5 h-5" />}
          value={stats.activeEmployees}
          label="Karyawan Aktif"
          color="green"
        />
      </div>

      {/* Main Table */}
      {error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-xs text-gray-500 font-medium text-right px-2">
            * Klik pada baris karyawan untuk melihat rincian breakdown harian
          </div>
          <Table<EmployeePerformance>
            columns={columns}
            data={filteredData}
            loading={loading}
            emptyText="Tidak ada data performa karyawan dalam rentang waktu terpilih"
            onRowClick={(row) => setSelectedEmployee(row)}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={handleSort}
          />
        </div>
      )}

      {/* Breakdown Modal */}
      <Modal
        isOpen={selectedEmployee !== null}
        onClose={() => setSelectedEmployee(null)}
        title={`Rincian Riwayat Harian - ${selectedEmployee?.name || ''}`}
        size="xl"
      >
        {selectedEmployee && (
          <div className="space-y-4">
            {/* Employee quick metadata */}
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between bg-blue-50 border border-blue-100 rounded-xl p-4">
              <div>
                <p className="text-xs text-blue-600 font-medium uppercase tracking-wider">Karyawan</p>
                <h4 className="text-lg font-bold text-blue-900">{selectedEmployee.name}</h4>
                <p className="text-sm text-blue-700">NIK: {selectedEmployee.nik} | ID: {selectedEmployee.employee_id}</p>
              </div>
              <div className="flex gap-4 border-t sm:border-t-0 sm:border-l border-blue-200 pt-3 sm:pt-0 sm:pl-4">
                <div>
                  <p className="text-xs text-blue-600">Total Hadir</p>
                  <p className="text-md font-semibold text-blue-900">{selectedEmployee.presentDays} hari</p>
                </div>
                <div>
                  <p className="text-xs text-blue-600">Total Jam Kerja</p>
                  <p className="text-md font-semibold text-blue-900">{formatDuration(selectedEmployee.totalWorkMinutes)}</p>
                </div>
                <div>
                  <p className="text-xs text-blue-600">Total Lembur</p>
                  <p className="text-md font-semibold text-orange-600">{formatDuration(selectedEmployee.totalOvertimeMinutes)}</p>
                </div>
              </div>
            </div>

            {/* Daily breakdown table */}
            <Table<any>
              columns={modalColumns}
              data={selectedEmployee.records}
              emptyText="Tidak ada catatan absensi harian pada periode ini"
            />
            
            <div className="flex justify-end pt-2">
              <Button onClick={() => setSelectedEmployee(null)}>Tutup</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
