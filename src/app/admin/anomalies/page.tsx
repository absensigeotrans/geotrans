'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { formatWIBTime, formatWIBDateDisplay, getWIBStartOfDay, getWIBEndOfDay } from '@/lib/timezone';
import { StatsCard } from '@/components/ui/StatsCard';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { toast } from '@/components/ui/Toast';
import { AlertTriangle, ShieldCheck, XCircle, Calendar, Search, CheckCircle } from 'lucide-react';

type AnomalyType = 'all' | 'fake_gps' | 'duplicate_checkin' | 'missing_checkout' | 'duplicate_coordinates';
type ConfirmAction = 'confirmed' | 'dismissed';

interface AnomalyRecord {
  id: string;
  user_id: string;
  check_in_time: string;
  check_out_time: string | null;
  status: string;
  is_mocked: boolean;
  is_valid: boolean;
  anomaly_flags: Record<string, boolean>;
  distance_from_office: number;
  profiles: { full_name: string; employee_id: string; nik: string };
}

const ANOMALY_LABELS: Record<string, { label: string; variant: 'danger' | 'warning' | 'info' | 'default' }> = {
  fake_gps: { label: 'Fake GPS', variant: 'danger' },
  duplicate_checkin: { label: 'Absen Ganda', variant: 'warning' },
  missing_checkout: { label: 'No Checkout Kemarin', variant: 'info' },
  duplicate_coordinates: { label: 'Koordinat Duplikat', variant: 'default' },
};

const VALIDITY_BADGE = {
  true: { label: 'Valid', variant: 'success' as const },
  false: { label: 'Tidak Valid', variant: 'danger' as const },
};

export default function AnomaliesPage() {
  const [records, setRecords] = useState<AnomalyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [anomalyFilter, setAnomalyFilter] = useState<AnomalyType>('all');
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);

  const fetchAnomalies = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const fromISO = getWIBStartOfDay(new Date(dateFrom));
      const toISO = getWIBEndOfDay(new Date(dateTo));

      let query = supabase
        .from('attendance')
        .select('*, profiles:user_id(full_name, employee_id, nik)')
        .gte('check_in_time', fromISO)
        .lte('check_in_time', toISO)
        .or('is_mocked.eq.true,anomaly_flags.neq.{}')
        .order('check_in_time', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;
      setRecords((data as any) || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    fetchAnomalies();
  }, [fetchAnomalies]);

  const filteredRecords = useMemo(() => {
    if (anomalyFilter === 'all') return records;
    return records.filter((r) => {
      if (anomalyFilter === 'fake_gps' && r.is_mocked) return true;
      const flags = r.anomaly_flags || {};
      return flags[anomalyFilter] === true;
    });
  }, [records, anomalyFilter]);

  const anomalyTypes = useMemo(() => {
    const types = new Set<string>();
    for (const r of records) {
      if (r.is_mocked) types.add('fake_gps');
      const flags = r.anomaly_flags || {};
      Object.keys(flags).forEach((k) => {
        if (flags[k]) types.add(k);
      });
    }
    return types;
  }, [records]);

  const totalAnomalies = filteredRecords.length;
  const fakeGpsCount = filteredRecords.filter((r) => r.is_mocked).length;
  const invalidCount = filteredRecords.filter((r) => !r.is_valid).length;

  async function handleConfirm(recordId: string) {
    try {
      await supabase
        .from('attendance')
        .update({
          anomaly_flags: {},
          is_valid: true,
        })
        .eq('id', recordId);
      toast.success('Anomali dikonfirmasi sebagai valid');
      fetchAnomalies();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal mengupdate');
    }
  }

  async function handleDismiss(recordId: string) {
    try {
      const current = records.find((r) => r.id === recordId);
      const flags = { ...(current?.anomaly_flags || {}) };

      await supabase
        .from('attendance')
        .update({
          anomaly_flags: flags,
          is_valid: true,
        })
        .eq('id', recordId);
      toast.success('Anomali diabaikan');
      fetchAnomalies();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal mengupdate');
    }
  }

  function getAnomalyBadges(record: AnomalyRecord) {
    const badges: { label: string; variant: 'danger' | 'warning' | 'info' | 'default' }[] = [];
    if (record.is_mocked) badges.push(ANOMALY_LABELS.fake_gps);
    const flags = record.anomaly_flags || {};
    Object.entries(flags).forEach(([key, val]) => {
      if (val && ANOMALY_LABELS[key]) badges.push(ANOMALY_LABELS[key]);
    });
    return badges;
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-900">Deteksi Anomali Absensi</h1>
        <Button variant="secondary" size="sm" onClick={fetchAnomalies}>
          <Search className="w-4 h-4" /> Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Jenis Anomali</label>
            <select
              value={anomalyFilter}
              onChange={(e) => setAnomalyFilter(e.target.value as AnomalyType)}
              className="w-full px-3 py-2 border rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all" className="text-gray-900 bg-white">Semua Anomali ({records.length})</option>
              {anomalyTypes.has('fake_gps') && <option value="fake_gps" className="text-gray-900 bg-white">Fake GPS</option>}
              {anomalyTypes.has('duplicate_checkin') && <option value="duplicate_checkin" className="text-gray-900 bg-white">Absen Ganda</option>}
              {anomalyTypes.has('missing_checkout') && <option value="missing_checkout" className="text-gray-900 bg-white">No Checkout Kemarin</option>}
              {anomalyTypes.has('duplicate_coordinates') && <option value="duplicate_coordinates" className="text-gray-900 bg-white">Koordinat Duplikat</option>}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Dari Tanggal</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Sampai Tanggal</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-end">
            <Button variant="primary" onClick={fetchAnomalies}>
              <Calendar className="w-4 h-4" /> Terapkan Filter
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          icon={<AlertTriangle className="w-5 h-5" />}
          value={loading ? '...' : String(totalAnomalies)}
          label="Total Anomali"
          color="red"
        />
        <StatsCard
          icon={<XCircle className="w-5 h-5" />}
          value={loading ? '...' : String(fakeGpsCount)}
          label="Fake GPS"
          color="red"
        />
        <StatsCard
          icon={<ShieldCheck className="w-5 h-5" />}
          value={loading ? '...' : String(invalidCount)}
          label="Tidak Valid"
          color="orange"
        />
        <StatsCard
          icon={<CheckCircle className="w-5 h-5" />}
          value={loading ? '...' : String(records.length - invalidCount)}
          label="Valid (flagged)"
          color="green"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Karyawan</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Tanggal</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Jam</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Anomali</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Validitas</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                    <div className="animate-spin inline-block w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full" />
                    <p className="mt-2">Memuat data...</p>
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                    <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>Tidak ada anomali ditemukan</p>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record) => {
                  const badges = getAnomalyBadges(record);
                  const validity = record.is_valid ? 'Valid' : 'Tidak Valid';
                  const valVariant = record.is_valid ? 'success' : 'danger';

                  return (
                    <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{record.profiles?.full_name || '-'}</div>
                        <div className="text-xs text-gray-400">{record.profiles?.employee_id || record.profiles?.nik || ''}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                        {formatWIBDateDisplay(record.check_in_time)}
                      </td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap font-mono text-xs">
                        {formatWIBTime(record.check_in_time)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {badges.length === 0 ? (
                            <span className="text-gray-400 text-xs">-</span>
                          ) : (
                            badges.map((b) => (
                              <Badge key={b.label} variant={b.variant}>{b.label}</Badge>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={valVariant as any}>{validity}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={
                          record.status === 'present' ? 'success' :
                          record.status === 'late' ? 'warning' : 'danger'
                        }>
                          {record.status === 'present' ? 'Hadir' :
                           record.status === 'late' ? 'Terlambat' :
                           record.status === 'outside_radius' ? 'Luar Area' : record.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleConfirm(record.id)}
                            className="px-2.5 py-1.5 text-xs font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                            title="Tandai valid"
                          >
                            <CheckCircle className="w-3.5 h-3.5 inline mr-1" />
                            Valid
                          </button>
                          <button
                            onClick={() => handleDismiss(record.id)}
                            className="px-2.5 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                            title="Abaikan"
                          >
                            <XCircle className="w-3.5 h-3.5 inline mr-1" />
                            Abaikan
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-gray-400 text-center">
        Anomali terdeteksi otomatis oleh sistem. Klik "Valid" untuk mengonfirmasi data benar, atau "Abaikan" untuk menghapus flag.
      </p>
    </div>
  );
}
