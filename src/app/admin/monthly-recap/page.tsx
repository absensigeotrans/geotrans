'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { StatsCard } from '@/components/ui/StatsCard';
import { Button } from '@/components/ui/Button';
import { toast } from '@/components/ui/Toast';
import {
  ChevronDown,
  ChevronRight,
  Download,
  FileText,
  TrendingUp,
  Clock,
  XCircle,
  Save,
  Users,
  FileSpreadsheet,
  CalendarX,
  Trash2,
  Plus,
} from 'lucide-react';

type CellStatus = 'present' | 'late' | 'outside_radius' | 'absent' | 'weekend' | 'future' | 'exception' | 'leave';
type EditChoice = 'present' | 'late' | 'absent';

const CHOICES: EditChoice[] = ['present', 'late', 'absent'];
const CHOICE_LABEL: Record<EditChoice, string> = { present: 'Hadir', late: 'Terlambat', absent: 'Absen' };

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function isWeekend(year: number, month: number, day: number): boolean {
  return new Date(year, month, day).getDay() % 6 === 0;
}

function isFutureDate(year: number, month: number, day: number): boolean {
  const d = new Date(year, month, day);
  d.setHours(23, 59, 59, 999);
  return d > new Date();
}

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

interface DayInfo {
  day: number;
  status: CellStatus;
  isWeekend: boolean;
  isFuture: boolean;
}

interface EmployeeRow {
  id: string;
  name: string;
  days: DayInfo[];
  present: number;
  late: number;
  absent: number;
  leave: number;
}

interface AttendanceRecord {
  user_id: string;
  status: string;
  check_in_time: string;
}

const STATUS_COLOR: Record<string, string> = {
  present: 'bg-green-100 text-green-700',
  late: 'bg-orange-100 text-orange-700',
  outside_radius: 'bg-blue-100 text-blue-700',
  absent: 'bg-red-100 text-red-700 font-bold',
  weekend: 'bg-gray-50 text-gray-300',
  future: 'bg-gray-50 text-gray-200',
  exception: 'bg-gray-100 text-gray-300 italic',
  leave: 'bg-purple-100 text-purple-700 font-bold',
};

function getAbsent(emp: Omit<EmployeeRow, 'present' | 'late' | 'absent' | 'leave'>): number {
  return emp.days.filter((d) => d.status === 'absent').length;
}

function getPresent(emp: Omit<EmployeeRow, 'present' | 'late' | 'absent' | 'leave'>): number {
  return emp.days.filter((d) => d.status === 'present' || d.status === 'outside_radius').length;
}

function getLate(emp: Omit<EmployeeRow, 'present' | 'late' | 'absent' | 'leave'>): number {
  return emp.days.filter((d) => d.status === 'late').length;
}

function getLeave(emp: Omit<EmployeeRow, 'present' | 'late' | 'absent' | 'leave'>): number {
  return emp.days.filter((d) => d.status === 'leave').length;
}

function getStatusAtDay(emp: Omit<EmployeeRow, 'present' | 'late' | 'absent' | 'leave'>, day: number): CellStatus {
  return emp.days.find((d) => d.day === day)?.status || 'absent';
}

function getChoiceFromStatus(s: CellStatus): EditChoice {
  if (s === 'present' || s === 'late' || s === 'absent') return s;
  if (s === 'outside_radius') return 'present';
  return 'absent';
}

function computeDynamicCounts(
  emp: Omit<EmployeeRow, 'present' | 'late' | 'absent' | 'leave'>,
  pending: Record<number, EditChoice>,
) {
  let present = getPresent(emp);
  let late = getLate(emp);
  let absent = getAbsent(emp);
  let leave = getLeave(emp);

  for (const [dayStr, choice] of Object.entries(pending)) {
    const day = Number(dayStr);
    const original = getStatusAtDay(emp, day);

    if (original === 'present' || original === 'outside_radius') present--;
    else if (original === 'late') late--;
    else if (original === 'absent') absent--;
    else if (original === 'leave') leave--;

    if (choice === 'present') present++;
    else if (choice === 'late') late++;
    else if (choice === 'absent') absent++;
  }

  return { present, late, absent, leave };
}

export default function MonthlyRecapPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pendingChanges, setPendingChanges] = useState<Record<string, Record<number, EditChoice>>>({});
  const [saving, setSaving] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  function refresh() {
    setRefreshKey((k) => k + 1);
  }

  const [globalExceptions, setGlobalExceptions] = useState<Set<string>>(new Set());
  const [userExceptions, setUserExceptions] = useState<Record<string, Set<string>>>({});
  const [showExceptionModal, setShowExceptionModal] = useState(false);
  const [exceptionTab, setExceptionTab] = useState<'global' | 'user'>('global');
  const [exceptionDate, setExceptionDate] = useState('');
  const [exceptionReason, setExceptionReason] = useState('');
  const [exceptionUserId, setExceptionUserId] = useState('');
  const [profilesList, setProfilesList] = useState<{ id: string; full_name: string }[]>([]);

  const daysInMonth = getDaysInMonth(year, month);
  const monthLabel = `${MONTHS[month]} ${year}`;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setPendingChanges({});
      setExpandedId(null);
      setGlobalExceptions(new Set());
      setUserExceptions({});
      try {
        const startDate = formatDate(year, month, 1);
        const endDate = formatDate(year, month, daysInMonth);

        const { data: profiles, error: profileErr } = await supabase
          .from('profiles')
          .select('id, full_name')
          .not('role', 'in', '("admin","inactive")')
          .order('full_name');

        if (profileErr) throw profileErr;

        const toDate = new Date(endDate);
        toDate.setDate(toDate.getDate() + 1);
        const toISO = toDate.toISOString();

        const { data: attendance, error: attErr } = await supabase
          .from('attendance')
          .select('user_id, status, check_in_time')
          .gte('check_in_time', startDate)
          .lt('check_in_time', toISO);

        if (attErr) throw attErr;

        const [{ data: globalData }, { data: userData }] = await Promise.all([
          supabase
            .from('global_exception_dates')
            .select('date')
            .gte('date', startDate)
            .lte('date', endDate),
          supabase
            .from('user_exception_dates')
            .select('user_id, date, reason')
            .gte('date', startDate)
            .lte('date', endDate),
        ]);

        const globalSet = new Set((globalData || []).map((r) => r.date));
        const userMap: Record<string, Set<string>> = {};
        const userReasonsMap: Record<string, Record<string, string>> = {};
        for (const r of userData || []) {
          if (!userMap[r.user_id]) userMap[r.user_id] = new Set();
          userMap[r.user_id].add(r.date);

          if (!userReasonsMap[r.user_id]) userReasonsMap[r.user_id] = {};
          userReasonsMap[r.user_id][r.date] = r.reason || '';
        }

        if (!cancelled) {
          setGlobalExceptions(globalSet);
          setUserExceptions(userMap);
          setProfilesList(profiles || []);
        }

        const records = (attendance || []) as AttendanceRecord[];

        const userDayStatus: Record<string, Record<number, string>> = {};
        for (const rec of records) {
          const d = new Date(rec.check_in_time);
          const day = d.getDate();
          if (!userDayStatus[rec.user_id]) userDayStatus[rec.user_id] = {};
          if (!userDayStatus[rec.user_id][day]) {
            userDayStatus[rec.user_id][day] = rec.status;
          }
        }

        const rows: EmployeeRow[] = (profiles || []).map((p) => {
          const days: DayInfo[] = [];

          for (let d = 1; d <= daysInMonth; d++) {
            const weekend = isWeekend(year, month, d);
            const future = isFutureDate(year, month, d);
            const dateStr = formatDate(year, month, d);
            const isGlobalEx = globalSet.has(dateStr);
            const userReason = userReasonsMap[p.id]?.[dateStr];
            const isUserEx = userReason !== undefined;
            const isLeave = isUserEx && (
              userReason.toLowerCase().startsWith('cuti') ||
              userReason.toLowerCase().startsWith('sakit') ||
              userReason.toLowerCase().startsWith('izin')
            );
            const isException = isGlobalEx || isUserEx;
            const status = userDayStatus[p.id]?.[d];

            if (weekend || future || isException) {
              const st = weekend ? 'weekend' : future ? 'future' : isLeave ? 'leave' : 'exception';
              days.push({ day: d, status: st as CellStatus, isWeekend: weekend, isFuture: future });
            } else if (!status) {
              days.push({ day: d, status: 'absent', isWeekend: false, isFuture: false });
            } else if (status === 'present') {
              days.push({ day: d, status: 'present', isWeekend: false, isFuture: false });
            } else if (status === 'late') {
              days.push({ day: d, status: 'late', isWeekend: false, isFuture: false });
            } else {
              days.push({ day: d, status: 'outside_radius', isWeekend: false, isFuture: false });
            }
          }

          const tempEmp = { id: p.id, name: p.full_name, days };
          const counts = computeDynamicCounts(tempEmp, {});

          return {
            id: p.id,
            name: p.full_name,
            days,
            present: counts.present,
            late: counts.late,
            absent: counts.absent,
            leave: counts.leave,
          };
        });

        if (!cancelled) setEmployees(rows);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Gagal memuat data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [year, month, daysInMonth, refreshKey]);

  const employeeDynamics = employees.map((emp) => ({
    ...emp,
    ...computeDynamicCounts(emp, pendingChanges[emp.id] || {}),
  }));

  const totalPresent = employeeDynamics.reduce((s, e) => s + e.present, 0);
  const totalLate = employeeDynamics.reduce((s, e) => s + e.late, 0);
  const totalAbsent = employeeDynamics.reduce((s, e) => s + e.absent, 0);

  const avgRate = employees.length > 0
    ? Math.round(
        employeeDynamics.reduce((s, e) => {
          const total = e.present + e.late + e.absent;
          return s + (total > 0 ? (e.present / total) * 100 : 0);
        }, 0) / employees.length,
      )
    : 0;

  const years = Array.from({ length: 5 }, (_, i) => today.getFullYear() - 2 + i);

  function getPendingForEmployee(empId: string): Record<number, EditChoice> {
    return pendingChanges[empId] || {};
  }

  function cellClassWithPending(emp: EmployeeRow, day: DayInfo): string {
    if (day.status === 'exception') return 'bg-gray-100 text-gray-300 italic';
    if (day.status === 'leave') return STATUS_COLOR.leave;
    const pending = getPendingForEmployee(emp.id);
    if (day.day in pending) {
      const c = pending[day.day];
      const base = STATUS_COLOR[c === 'present' ? 'present' : c === 'late' ? 'late' : 'absent'];
      return `${base} ring-2 ring-offset-1 ${c === 'present' ? 'ring-green-400' : c === 'late' ? 'ring-orange-400' : 'ring-red-400'}`;
    }
    if (day.isWeekend || day.isFuture) return 'bg-gray-50 text-gray-300';
    return STATUS_COLOR[day.status];
  }

  function cellContent(day: DayInfo, pendingChoice?: EditChoice): string {
    if (pendingChoice !== undefined) {
      return pendingChoice === 'absent' ? 'A' : '●';
    }
    switch (day.status) {
      case 'present': case 'late': case 'outside_radius': return '●';
      case 'absent': return 'A';
      case 'exception': return '-';
      case 'leave': return 'C';
      default: return '-';
    }
  }

  function cellTitle(emp: EmployeeRow, day: DayInfo): string {
    const pending = getPendingForEmployee(emp.id);
    const label = day.day in pending ? CHOICE_LABEL[pending[day.day]] + ' (pending)' : day.status === 'absent' ? 'Absen' : day.status === 'present' ? 'Hadir' : day.status === 'late' ? 'Terlambat' : day.status === 'outside_radius' ? 'Luar Area' : day.status === 'weekend' ? 'Libur' : day.status === 'exception' ? 'Hari Libur' : day.status === 'leave' ? 'Cuti' : '-';
    return `${emp.name} - ${day.day} ${monthLabel}: ${label}`;
  }

  function handleCellClick(emp: EmployeeRow, day: DayInfo) {
    if (day.isWeekend || day.isFuture || day.status === 'exception' || day.status === 'leave') return;

    const pending = getPendingForEmployee(emp.id);
    const current = day.day in pending
      ? pending[day.day]
      : getChoiceFromStatus(day.status);

    const idx = CHOICES.indexOf(current);
    const next = CHOICES[(idx + 1) % CHOICES.length];

    setPendingChanges((prev) => {
      const empChanges = { ...(prev[emp.id] || {}) };
      const originalStatus = getStatusAtDay(emp, day.day);
      if (next === getChoiceFromStatus(originalStatus)) {
        delete empChanges[day.day];
      } else {
        empChanges[day.day] = next;
      }
      const result = { ...prev };
      if (Object.keys(empChanges).length === 0) {
        delete result[emp.id];
      } else {
        result[emp.id] = empChanges;
      }
      return result;
    });
  }

  function handleDayRightClick(e: React.MouseEvent, emp: EmployeeRow, day: DayInfo) {
    e.preventDefault();
    if (day.isWeekend || day.isFuture || day.status === 'exception' || day.status === 'leave') return;

    const pending = getPendingForEmployee(emp.id);
    const current = day.day in pending
      ? pending[day.day]
      : getChoiceFromStatus(day.status);

    // Right-click resets to original
    const originalChoice = getChoiceFromStatus(getStatusAtDay(emp, day.day));

    setPendingChanges((prev) => {
      const empChanges = { ...(prev[emp.id] || {}) };
      if (current === originalChoice) {
        delete empChanges[day.day];
      } else {
        empChanges[day.day] = originalChoice;
      }
      const result = { ...prev };
      if (Object.keys(empChanges).length === 0) {
        delete result[emp.id];
      } else {
        result[emp.id] = empChanges;
      }
      return result;
    });
  }

  async function saveChanges(emp: EmployeeRow) {
    const changes = getPendingForEmployee(emp.id);
    const days = Object.keys(changes).map(Number);
    if (days.length === 0) return;

    setSaving(true);
    try {
      for (const day of days) {
        const newStatus = changes[day];
        const originalStatus = getStatusAtDay(emp, day);
        const dateStr = formatDate(year, month, day);

        if (originalStatus === 'absent') {
          if (newStatus !== 'absent') {
            const checkIn = `${dateStr}T01:00:00+07:00`;
            const { error: insertErr } = await supabase.from('attendance').insert({
              user_id: emp.id,
              status: newStatus,
              check_in_time: checkIn,
              check_in_latitude: 0,
              check_in_longitude: 0,
              distance_from_office: 0,
              is_valid: true,
              is_mocked: false,
            });
            if (insertErr) throw insertErr;
          }
        } else if (newStatus === 'absent') {
          const { data: existing, error: selectErr } = await supabase
            .from('attendance')
            .select('id')
            .eq('user_id', emp.id)
            .gte('check_in_time', `${dateStr}T00:00:00+07:00`)
            .lt('check_in_time', `${dateStr}T23:59:59+07:00`)
            .maybeSingle();

          if (selectErr) throw selectErr;

          if (existing) {
            const { error: deleteErr } = await supabase.from('attendance').delete().eq('id', existing.id);
            if (deleteErr) throw deleteErr;
          }
        } else if (getChoiceFromStatus(originalStatus) !== newStatus) {
          const { data: existing, error: selectErr } = await supabase
            .from('attendance')
            .select('id')
            .eq('user_id', emp.id)
            .gte('check_in_time', `${dateStr}T00:00:00+07:00`)
            .lt('check_in_time', `${dateStr}T23:59:59+07:00`)
            .maybeSingle();

          if (selectErr) throw selectErr;

          if (existing) {
            const { error: updateErr } = await supabase.from('attendance').update({ status: newStatus }).eq('id', existing.id);
            if (updateErr) throw updateErr;
          } else {
            const checkIn = `${dateStr}T01:00:00+07:00`;
            const { error: insertErr } = await supabase.from('attendance').insert({
              user_id: emp.id,
              status: newStatus,
              check_in_time: checkIn,
              check_in_latitude: 0,
              check_in_longitude: 0,
              distance_from_office: 0,
              is_valid: true,
              is_mocked: false,
            });
            if (insertErr) throw insertErr;
          }
        }
      }

      setPendingChanges((prev) => {
        const result = { ...prev };
        delete result[emp.id];
        return result;
      });

      setEmployees((prev) =>
        prev.map((e) => {
          if (e.id !== emp.id) return e;
          const newDays = e.days.map((d) => {
            const choice = changes[d.day];
            if (!choice) return d;
            return { ...d, status: choice as CellStatus };
          });
          const tempEmp = { id: e.id, name: e.name, days: newDays };
          const counts = computeDynamicCounts(tempEmp, {});
          return {
            ...e,
            days: newDays,
            present: counts.present,
            late: counts.late,
            absent: counts.absent,
            leave: counts.leave,
          };
        }),
      );

      toast.success(`Perubahan untuk ${emp.name} berhasil disimpan`);
      setExpandedId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyimpan perubahan');
    } finally {
      setSaving(false);
    }
  }

  const exportCSV = () => {
    const headers = ['Nama', ...Array.from({ length: daysInMonth }, (_, i) => String(i + 1)), 'Hadir', 'Telat', 'Absen', 'Cuti'];
    const rows = employeeDynamics.map((emp) => [
      emp.name,
      ...emp.days.map((d) => {
        const p = pendingChanges[emp.id]?.[d.day];
        const st = p !== undefined ? p : d.status;
        switch (st) {
          case 'present': return 'H';
          case 'late': return 'T';
          case 'outside_radius': return 'L';
          case 'absent': return 'A';
          case 'leave': return 'C';
          default: return '';
        }
      }),
      emp.present,
      emp.late,
      emp.absent,
      emp.leave,
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rekap_bulanan_${monthLabel.replace(' ', '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`CSV berhasil di-export (${employees.length} karyawan)`);
  };

  const exportPDF = async () => {
    try {
      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ]);

      const doc = new jsPDF('landscape');
      const title = `Rekap Bulanan - ${monthLabel}`;
      doc.setFontSize(16);
      doc.text(title, 14, 16);
      doc.setFontSize(10);
      doc.text(`Generated: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`, 14, 23);
      doc.text(`Karyawan: ${employees.length} | Hadir: ${totalPresent} | Terlambat: ${totalLate} | Absen: ${totalAbsent} | Cuti: ${employeeDynamics.reduce((s, e) => s + e.leave, 0)} | Rata-rata: ${avgRate}%`, 14, 30);

      const dayHeaders = Array.from({ length: daysInMonth }, (_, i) => String(i + 1));
      const headers = [['Nama', ...dayHeaders, 'Hadir', 'Telat', 'Absen', 'Cuti']];
      const rows = employeeDynamics.map((emp) => [
        emp.name,
        ...emp.days.map((d) => {
          const p = pendingChanges[emp.id]?.[d.day];
          const st = p !== undefined ? p : d.status;
          switch (st) {
            case 'present': return '●';
            case 'late': return '●';
            case 'outside_radius': return '●';
            case 'absent': return 'A';
            case 'leave': return 'C';
            default: return '';
          }
        }),
        emp.present,
        emp.late,
        emp.absent,
        emp.leave,
      ]);

      autoTable(doc, {
        head: headers,
        body: rows,
        startY: 36,
        styles: { fontSize: 7 },
        headStyles: { fillColor: [37, 99, 235] },
        alternateRowStyles: { fillColor: [245, 247, 250] },
      });

      doc.save(`rekap_bulanan_${monthLabel.replace(' ', '_')}.pdf`);
      toast.success(`PDF berhasil di-export (${employees.length} karyawan)`);
    } catch (err) {
      console.error('Failed to export PDF:', err);
      toast.error('Failed to export PDF');
    }
  };

  async function exportEmployeeXLSX(
    emp: EmployeeRow,
  ) {
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Admin';
    const ws = wb.addWorksheet('Rekap Bulanan');

    const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

    const statusDisplay: Record<string, string> = {
      present: 'Hadir',
      late: 'Terlambat',
      outside_radius: 'Luar Area',
      absent: 'Absen',
      weekend: 'Libur',
      future: '-',
      leave: 'Cuti',
    };

    const statusIndicator: Record<string, string> = {
      present: '●',
      late: '●',
      outside_radius: '●',
      absent: 'A',
      weekend: '-',
      future: '-',
      leave: 'C',
    };

    const colorMap: Record<string, { bg: string; fg: string }> = {
      present: { bg: 'DCFCE7', fg: '166534' },
      late: { bg: 'FFEDD5', fg: '9A3412' },
      outside_radius: { bg: 'DBEAFE', fg: '1E40AF' },
      absent: { bg: 'FEE2E2', fg: '991B1B' },
      weekend: { bg: 'F9FAFB', fg: 'D1D5DB' },
      future: { bg: 'F9FAFB', fg: 'E5E7EB' },
      leave: { bg: 'F3E8FF', fg: '6B21A8' },
    };

    const pending = pendingChanges[emp.id] || {};

    ws.columns = [
      { width: 5 },
      { width: 20 },
      { width: 12 },
      { width: 22 },
      { width: 4 },
    ];

    const borderThin = {
      top: { style: 'thin' as const, color: { argb: 'E5E7EB' } },
      left: { style: 'thin' as const, color: { argb: 'E5E7EB' } },
      bottom: { style: 'thin' as const, color: { argb: 'E5E7EB' } },
      right: { style: 'thin' as const, color: { argb: 'E5E7EB' } },
    };

    const r1 = ws.addRow([`Rekap Bulanan - ${emp.name}`]);
    ws.mergeCells(1, 1, 1, 5);
    r1.font = { bold: true, size: 14, color: { argb: 'FFFFFF' } };
    r1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '2563EB' } };
    r1.alignment = { vertical: 'middle', horizontal: 'left' };
    r1.height = 32;

    const r2 = ws.addRow([`Periode: ${monthLabel}`]);
    ws.mergeCells(2, 1, 2, 5);
    r2.font = { size: 11, italic: true, color: { argb: '6B7280' } };
    r2.height = 22;

    ws.addRow([]);

    const hRow = ws.addRow(['No', 'Tanggal', 'Hari', 'Status', '']);
    hRow.font = { bold: true, color: { argb: 'FFFFFF' }, size: 11 };
    hRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '2563EB' } };
    hRow.alignment = { horizontal: 'center', vertical: 'middle' };
    hRow.height = 24;
    hRow.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });

    for (let i = 0; i < emp.days.length; i++) {
      const d = emp.days[i];
      const pendingChoice = pending[d.day];
      const displayStatus = pendingChoice || d.status;
      const colorKey = pendingChoice || d.status;
      const date = new Date(year, month, d.day);
      const dayName = DAY_NAMES[date.getDay()];

      const row = ws.addRow([
        i + 1,
        `${d.day} ${MONTHS[month]} ${year}`,
        dayName,
        ` ${statusIndicator[displayStatus] || ''}  ${statusDisplay[displayStatus] || ''}`,
        '',
      ]);

      row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(4).alignment = { horizontal: 'left', vertical: 'middle' };

      const colors = colorMap[colorKey] || colorMap.absent;

      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.bg } };
        cell.font = { ...(cell.font || {}), color: { argb: colors.fg } };
        cell.border = borderThin;
      });

      row.height = 20;
    }

    ws.addRow([]);

    const addSumRow = (label: string, value: number, color: string) => {
      const r = ws.addRow([label, '', '', value, '']);
      ws.mergeCells(r.number, 1, r.number, 3);
      r.getCell(1).font = { bold: true, size: 11 };
      r.getCell(4).font = { bold: true, size: 11, color: { argb: color } };
      r.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
      r.height = 22;
    };

    addSumRow('Jumlah Hadir', emp.present, '166534');
    addSumRow('Jumlah Terlambat', emp.late, '9A3412');
    addSumRow('Jumlah Absen', emp.absent, '991B1B');
    addSumRow('Jumlah Cuti', emp.leave, '6B21A8');

    ws.addRow([]);
    const fr = ws.addRow([`Diexport: ${new Date().toLocaleString('id-ID')}`]);
    ws.mergeCells(fr.number, 1, fr.number, 5);
    fr.font = { italic: true, size: 9, color: { argb: '9CA3AF' } };

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rekap_${emp.name.replace(/\s+/g, '_')}_${monthLabel.replace(/\s+/g, '_')}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`XLSX untuk ${emp.name} berhasil di-export`);
  }

  async function addGlobalException() {
    if (!exceptionDate) return toast.error('Pilih tanggal terlebih dahulu');
    try {
      const { error } = await supabase.from('global_exception_dates').insert({
        date: exceptionDate,
        reason: exceptionReason || 'Hari Libur',
      });
      if (error) throw error;
      toast.success('Hari libur global berhasil ditambahkan');
      setExceptionDate('');
      setExceptionReason('');
      setShowExceptionModal(false);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menambahkan');
    }
  }

  async function removeGlobalException(date: string) {
    try {
      const { error } = await supabase.from('global_exception_dates').delete().eq('date', date);
      if (error) throw error;
      toast.success('Hari libur dihapus');
      setShowExceptionModal(false);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menghapus');
    }
  }

  async function addUserException() {
    if (!exceptionDate) return toast.error('Pilih tanggal terlebih dahulu');
    if (!exceptionUserId) return toast.error('Pilih karyawan terlebih dahulu');
    try {
      const { error } = await supabase.from('user_exception_dates').insert({
        user_id: exceptionUserId,
        date: exceptionDate,
        reason: exceptionReason || 'Cuti / Izin',
      });
      if (error) throw error;
      toast.success('Hari libur per karyawan berhasil ditambahkan');
      setExceptionDate('');
      setExceptionReason('');
      setExceptionUserId('');
      setShowExceptionModal(false);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menambahkan');
    }
  }

  async function removeUserException(userId: string, date: string) {
    try {
      const { error } = await supabase
        .from('user_exception_dates')
        .delete()
        .eq('user_id', userId)
        .eq('date', date);
      if (error) throw error;
      toast.success('Hari libur dihapus');
      setShowExceptionModal(false);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menghapus');
    }
  }

  return (
    <div className="space-y-5">
      {/* Header & Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-900">Rekap Bulanan</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="secondary" size="sm" onClick={() => setShowExceptionModal(true)}>
            <CalendarX className="w-4 h-4" /> Atur Hari Libur
          </Button>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="px-3 py-2 border rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {MONTHS.map((label, idx) => (
              <option key={idx} value={idx} className="text-gray-900 bg-white">{label}</option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="px-3 py-2 border rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {years.map((y) => (
              <option key={y} value={y} className="text-gray-900 bg-white">{y}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          icon={<TrendingUp className="w-5 h-5" />}
          value={loading ? '...' : `${avgRate}%`}
          label="Rata-rata Kehadiran"
          color="green"
        />
        <StatsCard
          icon={<Clock className="w-5 h-5" />}
          value={loading ? '...' : String(totalLate)}
          label="Total Terlambat"
          color="orange"
        />
        <StatsCard
          icon={<XCircle className="w-5 h-5" />}
          value={loading ? '...' : String(totalAbsent)}
          label="Total Absen"
          color="red"
        />
        <StatsCard
          icon={<Users className="w-5 h-5" />}
          value={loading ? '...' : String(employees.length)}
          label="Total Karyawan"
          color="blue"
        />
      </div>

      {/* Export & Legend */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        {employees.length > 0 && (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={exportCSV}>
              <Download className="w-4 h-4" /> Export CSV
            </Button>
            <Button variant="secondary" onClick={exportPDF}>
              <FileText className="w-4 h-4" /> Export PDF
            </Button>
          </div>
        )}
        <div className="flex flex-wrap gap-3 text-xs text-gray-500">
          <span><span className="inline-block w-3 h-3 rounded-full bg-green-500 mr-1" /> Hadir</span>
          <span><span className="inline-block w-3 h-3 rounded-full bg-orange-500 mr-1" /> Terlambat</span>
          <span><span className="inline-block w-3 h-3 rounded-full bg-blue-500 mr-1" /> Luar Area</span>
          <span><span className="inline-block w-3 h-3 rounded-full bg-red-500 mr-1" /> Absen</span>
          <span><span className="inline-block border border-gray-300 align-middle mr-1" style={{ width: 12, height: 12 }} /> Libur/Masa Depan</span>
          <span><span className="inline-block w-3 h-3 bg-gray-100 border border-gray-200 align-middle mr-1" style={{ width: 12, height: 12 }} /> Hari Libur</span>
          <span><span className="inline-block w-3 h-3 rounded-full bg-purple-500 mr-1" /> Cuti</span>
          <span><span className="inline-block w-3 h-3 rounded-full bg-yellow-300 mr-1 ring-2 ring-yellow-400" /> Belum disimpan</span>
        </div>
      </div>

      {/* Employee Cards */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : employees.length === 0 ? (
        <div className="py-12 text-center text-gray-500">Tidak ada data untuk periode ini</div>
      ) : (
        <div className="space-y-3">
          {employeeDynamics.map((emp) => {
            const expanded = expandedId === emp.id;
            const pending = getPendingForEmployee(emp.id);
            const pendingCount = Object.keys(pending).length;

            return (
              <div key={emp.id} className="bg-white rounded-xl shadow-sm border overflow-hidden">
                {/* Card Header */}
                <button
                  onClick={() => setExpandedId(expanded ? null : emp.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                >
                  <span className="text-gray-400 flex-shrink-0">
                    {expanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{emp.name}</p>
                  </div>
                  <div className="flex items-center gap-4 text-sm flex-shrink-0">
                    <span className="text-green-600 font-medium">H {emp.present}</span>
                    <span className="text-orange-600 font-medium">T {emp.late}</span>
                    <span className="text-red-600 font-medium">A {emp.absent}</span>
                    <span className="text-purple-600 font-medium">C {emp.leave}</span>
                  </div>
                  {pendingCount > 0 && (
                    <span className="bg-yellow-100 text-yellow-700 text-xs font-medium px-2 py-0.5 rounded-full">
                      {pendingCount} perubahan
                    </span>
                  )}
                </button>

                {/* Expanded Matrix */}
                {expanded && (
                  <div className="border-t bg-gray-50/50 px-3 py-3">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-max text-xs">
                        <thead>
                          <tr>
                            {Array.from({ length: daysInMonth }, (_, i) => (
                              <th
                                key={i}
                                className={`px-1.5 py-1 text-center font-medium border ${
                                  isWeekend(year, month, i + 1) ? 'text-gray-300 bg-gray-100' : 'text-gray-600 bg-gray-50'
                                }`}
                              >
                                {i + 1}
                              </th>
                            ))}
                            <th className="px-2 py-1 text-center font-semibold text-green-700 bg-green-50 border min-w-[44px]">H</th>
                            <th className="px-2 py-1 text-center font-semibold text-orange-700 bg-orange-50 border min-w-[44px]">T</th>
                            <th className="px-2 py-1 text-center font-semibold text-red-700 bg-red-50 border min-w-[44px]">A</th>
                            <th className="px-2 py-1 text-center font-semibold text-purple-700 bg-purple-50 border min-w-[44px]">C</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            {emp.days.map((d, idx) => {
                              const pendingChoice = pending[d.day];
                              return (
                                <td
                                  key={idx}
                                  className={`px-1.5 py-1.5 text-center border cursor-pointer select-none transition-all ${
                                    d.isWeekend || d.isFuture || d.status === 'exception' || d.status === 'leave' ? 'cursor-default' : 'hover:brightness-90'
                                  } ${cellClassWithPending(emp, d)}`}
                                  title={cellTitle(emp, d)}
                                  onClick={() => handleCellClick(emp, d)}
                                  onContextMenu={(e) => handleDayRightClick(e, emp, d)}
                                >
                                  {cellContent(d, pendingChoice)}
                                </td>
                              );
                            })}
                            <td className="px-2 py-1.5 text-center font-semibold text-green-700 bg-green-50/50 border">
                              {emp.present}
                            </td>
                            <td className="px-2 py-1.5 text-center font-semibold text-orange-700 bg-orange-50/50 border">
                              {emp.late}
                            </td>
                            <td className="px-2 py-1.5 text-center font-semibold text-red-700 bg-red-50/50 border">
                              {emp.absent}
                            </td>
                            <td className="px-2 py-1.5 text-center font-semibold text-purple-700 bg-purple-50/50 border">
                              {emp.leave}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Bottom bar */}
                    <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
                      <p className="text-xs text-gray-400">
                        Klik: ganti status (Hadir → Terlambat → Absen).
                        Klik kanan: reset ke data asli.
                        <span className="ml-1 text-yellow-600">Ring kuning = perubahan belum disimpan.</span>
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => exportEmployeeXLSX(emp)}
                        >
                          <FileSpreadsheet className="w-4 h-4" /> Export XLSX
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          loading={saving}
                          disabled={pendingCount === 0}
                          onClick={() => saveChanges(emp)}
                        >
                          <Save className="w-4 h-4" /> Simpan
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Exception Modal */}
      {showExceptionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowExceptionModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">Kelola Hari Libur</h2>
                <button onClick={() => setShowExceptionModal(false)} className="text-gray-400 hover:text-gray-700 text-xl leading-none">&times;</button>
              </div>

              {/* Tabs */}
              <div className="flex border-b mb-4">
                <button
                  onClick={() => setExceptionTab('global')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${exceptionTab === 'global' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                  Global (Semua Karyawan)
                </button>
                <button
                  onClick={() => setExceptionTab('user')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${exceptionTab === 'user' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                  Per Karyawan
                </button>
              </div>

              {/* Add new exception */}
              <div className="flex items-end gap-2 mb-4 flex-wrap">
                <div className="flex-1 min-w-[140px]">
                  <label className="block text-xs text-gray-500 mb-1">Tanggal</label>
                  <input
                    type="date"
                    value={exceptionDate}
                    onChange={(e) => setExceptionDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex-1 min-w-[140px]">
                  <label className="block text-xs text-gray-500 mb-1">Alasan</label>
                  <input
                    type="text"
                    value={exceptionReason}
                    onChange={(e) => setExceptionReason(e.target.value)}
                    placeholder="Cuti / Izin / Libur"
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {exceptionTab === 'user' && (
                  <div className="flex-1 min-w-[140px]">
                    <label className="block text-xs text-gray-500 mb-1">Karyawan</label>
                    <select
                      value={exceptionUserId}
                      onChange={(e) => setExceptionUserId(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="" className="text-gray-900 bg-white">Pilih karyawan...</option>
                      {profilesList.map((p) => (
                        <option key={p.id} value={p.id} className="text-gray-900 bg-white">{p.full_name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <Button
                  variant="primary"
                  size="sm"
                  onClick={exceptionTab === 'global' ? addGlobalException : addUserException}
                >
                  <Plus className="w-4 h-4" /> Tambah
                </Button>
              </div>

              {/* List Global */}
              {exceptionTab === 'global' && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Daftar Hari Libur Global</h3>
                  {Array.from(globalExceptions).sort().length === 0 ? (
                    <p className="text-sm text-gray-400 py-4 text-center">Belum ada hari libur untuk bulan ini</p>
                  ) : (
                    <div className="space-y-1 max-h-60 overflow-y-auto">
                      {Array.from(globalExceptions).sort().map((date) => {
                        const d = new Date(date + 'T00:00:00');
                        const dayName = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][d.getDay()];
                        return (
                          <div key={date} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg">
                            <div>
                              <span className="text-sm font-medium text-gray-700">
                                {d.getDate()} {MONTHS[d.getMonth()]} {d.getFullYear()}
                              </span>
                              <span className="text-xs text-gray-400 ml-2">{dayName}</span>
                            </div>
                            <button
                              onClick={() => removeGlobalException(date)}
                              className="text-red-400 hover:text-red-600 transition-colors"
                              title="Hapus"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* List Per User */}
              {exceptionTab === 'user' && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Daftar Hari Libur Per Karyawan</h3>
                  {profilesList.filter((p) => userExceptions[p.id]?.size).length === 0 ? (
                    <p className="text-sm text-gray-400 py-4 text-center">Belum ada data untuk bulan ini</p>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {profilesList
                        .filter((p) => userExceptions[p.id]?.size)
                        .map((p) => (
                          <div key={p.id}>
                            <p className="text-xs font-semibold text-gray-500 mb-1">{p.full_name}</p>
                            <div className="space-y-1 ml-2">
                              {Array.from(userExceptions[p.id]).sort().map((date) => {
                                const d = new Date(date + 'T00:00:00');
                                const dayName = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][d.getDay()];
                                return (
                                  <div key={date} className="flex items-center justify-between px-3 py-1.5 bg-gray-50 rounded-lg">
                                    <span className="text-sm text-gray-700">
                                      {d.getDate()} {MONTHS[d.getMonth()]} {d.getFullYear()} <span className="text-xs text-gray-400">({dayName})</span>
                                    </span>
                                    <button
                                      onClick={() => removeUserException(p.id, date)}
                                      className="text-red-400 hover:text-red-600 transition-colors"
                                      title="Hapus"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400 text-center">
        ● Hijau = Hadir &nbsp;|&nbsp; ● Oranye = Terlambat &nbsp;|&nbsp; ● Biru = Luar Area &nbsp;|&nbsp; A Merah = Absen &nbsp;|&nbsp;
        C Ungu = Cuti &nbsp;|&nbsp; - Abu-abu = Libur, Hari Libur khusus, atau masa depan &nbsp;|&nbsp; Klik cell untuk edit
      </p>
    </div>
  );
}
