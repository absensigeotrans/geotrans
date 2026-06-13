'use client';

import { useState, useMemo } from 'react';
import { useAttendanceRate, EmployeeStat, Period } from '@/hooks/useAttendanceRate';
import { StatsCard } from '@/components/ui/StatsCard';
import { Badge } from '@/components/ui/Badge';
import {
  TrendingUp, AlertTriangle, Award, XCircle,
  Search, ArrowUpDown, Users, Hash,
} from 'lucide-react';

const periods: { value: Period; label: string }[] = [
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: 'custom', label: 'Custom' },
];

type SortKey = 'attendanceRate' | 'late' | 'present' | 'absent' | 'fullName' | 'lateRate';
type SortDir = 'asc' | 'desc';

export default function ViewerAttendanceRatePage() {
  const {
    stats, loading, error,
    period, setPeriod,
    customStart, setCustomStart,
    customEnd, setCustomEnd,
    avgRate, mostLate, bestAttendee, totalAbsent,
  } = useAttendanceRate();

  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('attendanceRate');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const filtered = useMemo(() => {
    let result = [...stats];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((s) => s.fullName.toLowerCase().includes(q));
    }
    result.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'fullName') {
        cmp = a.fullName.localeCompare(b.fullName);
      } else {
        cmp = (a[sortKey] as number) - (b[sortKey] as number);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return result;
  }, [stats, search, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'attendanceRate' ? 'asc' : 'desc');
    }
  };

  const renderRateBadge = (rate: number) => {
    if (rate >= 90) return <Badge variant="success">{rate}%</Badge>;
    if (rate >= 70) return <Badge variant="warning">{rate}%</Badge>;
    return <Badge variant="danger">{rate}%</Badge>;
  };

  const renderSortIcon = (key: SortKey) => {
    if (sortKey !== key) return <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" />;
    return <span className="text-blue-600">{sortDir === 'asc' ? '▲' : '▼'}</span>;
  };

  const thClass = "px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700";
  const tdClass = "px-3 py-3 text-sm text-gray-900 whitespace-nowrap";

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-900">Attendance Rate</h1>
        <div className="flex items-center gap-2 flex-wrap">
          {periods.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                period === p.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {p.label}
            </button>
          ))}
          {period === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="px-2 py-1.5 text-sm border rounded-lg"
              />
              <span className="text-gray-400">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-2 py-1.5 text-sm border rounded-lg"
              />
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          icon={<TrendingUp className="w-5 h-5" />}
          value={loading ? '...' : `${avgRate}%`}
          label="Avg Attendance Rate"
          color="blue"
        />
        <StatsCard
          icon={<AlertTriangle className="w-5 h-5" />}
          value={loading || !mostLate ? '—' : mostLate.fullName}
          label={`Most Late (${mostLate?.late ?? 0}x)`}
          color="red"
        />
        <StatsCard
          icon={<Award className="w-5 h-5" />}
          value={loading || !bestAttendee ? '—' : bestAttendee.fullName}
          label={`Best Attendee (${bestAttendee?.attendanceRate ?? 0}%)`}
          color="green"
        />
        <StatsCard
          icon={<XCircle className="w-5 h-5" />}
          value={loading ? '...' : totalAbsent}
          label="Total Absences"
          color="yellow"
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search employee..."
            className="w-full pl-9 pr-4 py-2.5 border rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-gray-500">
            {stats.length === 0 ? 'No employees found' : 'No results matching your filters'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10">#</th>
                  <th className={thClass} onClick={() => handleSort('fullName')}>
                    <div className="flex items-center gap-1">Name {renderSortIcon('fullName')}</div>
                  </th>
                  <th className={thClass} onClick={() => handleSort('attendanceRate')}>
                    <div className="flex items-center gap-1">Rate {renderSortIcon('attendanceRate')}</div>
                  </th>
                  <th className={thClass} onClick={() => handleSort('present')}>
                    <div className="flex items-center gap-1">P {renderSortIcon('present')}</div>
                  </th>
                  <th className={thClass} onClick={() => handleSort('late')}>
                    <div className="flex items-center gap-1">L {renderSortIcon('late')}</div>
                  </th>
                  <th className={thClass} onClick={() => handleSort('lateRate')}>
                    <div className="flex items-center gap-1">L% {renderSortIcon('lateRate')}</div>
                  </th>
                  <th className={thClass} onClick={() => handleSort('absent')}>
                    <div className="flex items-center gap-1">A {renderSortIcon('absent')}</div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((emp, idx) => {
                  const rowClass = emp.attendanceRate < 70
                    ? 'bg-red-50/50'
                    : emp.attendanceRate < 90
                    ? 'bg-yellow-50/30'
                    : '';
                  return (
                    <tr key={emp.id} className={`hover:bg-gray-50 transition-colors ${rowClass}`}>
                      <td className="px-3 py-3 text-sm text-gray-500">{idx + 1}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-sm font-medium text-blue-600">
                            {emp.fullName.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-gray-900">{emp.fullName}</span>
                        </div>
                      </td>
                      <td className={tdClass}>{renderRateBadge(emp.attendanceRate)}</td>
                      <td className={tdClass}>{emp.present}</td>
                      <td className={tdClass}>
                        <span className={emp.late > 0 ? 'text-yellow-600 font-medium' : ''}>{emp.late}</span>
                      </td>
                      <td className={tdClass}>{emp.lateRate}%</td>
                      <td className={tdClass}>
                        <span className={emp.absent > 0 ? 'text-red-600 font-medium' : ''}>{emp.absent}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400 text-center">
        Working days exclude Saturday &amp; Sunday. Rate = (Present + Late) / Working Days × 100.
        🟢 ≥90% &middot; 🟡 70-89% &middot; 🔴 &lt;70%
      </p>
    </div>
  );
}
