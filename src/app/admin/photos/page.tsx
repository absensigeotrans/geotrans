'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Image from 'next/image';
import { formatWIBTime, formatWIBDateDisplay, getWIBDaysAgo, getWIBDate } from '@/lib/timezone';
import { Badge } from '@/components/ui/Badge';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import { SearchInput } from '@/components/ui/SearchInput';
import { Search, X, Trash2, AlertTriangle } from 'lucide-react';

interface PhotoRecord {
  id: string;
  photo_url: string;
  check_in_time: string;
  check_out_time?: string;
  status: string;
  work_status: string;
  user_name: string;
  employee_id?: string;
}

export default function PhotosPage() {
  const [records, setRecords] = useState<PhotoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(() => getWIBDaysAgo(7));
  const [to, setTo] = useState(() => getWIBDate());
  const [search, setSearch] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PhotoRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchPhotos = async (f = from, t = to) => {
    setLoading(true);
    try {
      let query = supabase
        .from('attendance')
        .select(`
          id, photo_url, check_in_time, check_out_time, status, work_status,
          profiles:user_id(full_name, employee_id)
        `)
        .not('photo_url', 'is', null)
        .order('check_in_time', { ascending: false })
        .limit(100);

      if (f) query = query.gte('check_in_time', f + 'T00:00:00');
      if (t) query = query.lte('check_in_time', t + 'T23:59:59');

      const { data } = await query;
      if (!data) { setRecords([]); return; }

      const mapped: PhotoRecord[] = (data as any[]).map((r) => ({
        id: r.id,
        photo_url: r.photo_url,
        check_in_time: r.check_in_time,
        check_out_time: r.check_out_time,
        status: r.status || 'present',
        work_status: r.work_status || '—',
        user_name: r.profiles?.full_name || 'Unknown',
        employee_id: r.profiles?.employee_id,
      }));

      setRecords(mapped);
    } catch (e) {
      console.error('Photo fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePhoto = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const path = deleteTarget.photo_url.split('/selfie_absensi/')[1];
      if (path) {
        await supabase.storage.from('selfie_absensi').remove([path]);
      }
      await supabase.from('attendance').update({ photo_url: null }).eq('id', deleteTarget.id);
      setRecords((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (e) {
      console.error('Delete photo error:', e);
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => { fetchPhotos(); }, []);

  const filtered = search
    ? records.filter((r) =>
        r.user_name.toLowerCase().includes(search.toLowerCase()) ||
        r.employee_id?.toLowerCase().includes(search.toLowerCase()))
    : records;

  const getStatusColor = (s: string) => {
    switch (s) {
      case 'present': return 'success';
      case 'late': return 'warning';
      default: return 'danger';
    }
  };

  return (
    <div className="space-y-5">
      {/* Header & Filters */}
      <div className="bg-white rounded-xl shadow-sm border p-5">
        <div className="flex flex-col lg:flex-row gap-3 items-end">
          <div className="w-full lg:w-64">
            <label className="block text-xs font-medium text-gray-500 mb-1">Search Employee</label>
            <SearchInput value={search} onChange={setSearch} placeholder="Search name..." />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1">Date Range</label>
            <DateRangePicker from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
          </div>
          <button
            onClick={() => fetchPhotos(from, to)}
            className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Apply
          </button>
        </div>
        <div className="text-sm text-gray-500 mt-3">
          {filtered.length} photo{filtered.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Photo Grid */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border p-20 text-center text-gray-500">
          <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="font-medium">No photos found</p>
          <p className="text-sm mt-1">Try adjusting the date range</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((record) => (
            <div
              key={record.id}
              className="bg-white rounded-xl shadow-sm border overflow-hidden hover:shadow-md transition-shadow"
            >
              {/* Photo */}
              <div className="relative aspect-[4/3] bg-gray-100 group">
                <div
                  className="absolute inset-0 cursor-pointer"
                  onClick={() => setSelectedPhoto(record.photo_url)}
                >
                  <Image
                    src={record.photo_url}
                    alt={`${record.user_name} selfie`}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  />
                </div>
                <button
                  onClick={() => setDeleteTarget(record)}
                  className="absolute top-2 right-2 p-1.5 bg-red-500/80 hover:bg-red-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200"
                  title="Hapus foto"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Info */}
              <div className="p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900 text-sm truncate">
                    {record.user_name}
                  </span>
                  <Badge variant={getStatusColor(record.status)}>
                    {record.status.replace('_', ' ')}
                  </Badge>
                </div>

                {record.employee_id && (
                  <div className="text-xs text-gray-400">{record.employee_id}</div>
                )}

                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>{formatWIBDateDisplay(record.check_in_time)}</span>
                  <span className="text-gray-300">|</span>
                  <span>{formatWIBTime(record.check_in_time)}</span>
                </div>

                {record.work_status && record.work_status !== '—' && (
                  <span className="inline-block px-2 py-0.5 rounded text-xs font-medium text-blue-700 bg-blue-100">
                    {record.work_status}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="bg-red-600 px-6 py-4 flex items-center gap-3">
              <Trash2 className="w-5 h-5 text-white" />
              <h3 className="text-lg font-semibold text-white">Hapus Foto</h3>
            </div>
            <div className="p-6">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-1">Yakin ingin menghapus foto ini?</h4>
                  <p className="text-sm text-gray-600">
                    Foto selfie <strong>{deleteTarget.user_name}</strong> tanggal{' '}
                    {formatWIBDateDisplay(deleteTarget.check_in_time)} akan dihapus
                    permanen dari storage. Data kehadiran tetap tersimpan.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  disabled={deleting}
                >
                  Batal
                </button>
                <button
                  onClick={handleDeletePhoto}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                  disabled={deleting}
                >
                  {deleting ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Menghapus...
                    </span>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4 inline mr-1" />
                      Hapus
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full-size Photo Modal */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <button
            className="absolute top-4 right-4 p-2 bg-white/20 rounded-full text-white hover:bg-white/30 transition-colors"
            onClick={() => setSelectedPhoto(null)}
          >
            <X className="w-6 h-6" />
          </button>
          <div className="relative max-w-3xl w-full max-h-[90vh] aspect-[3/4]">
            <Image
              src={selectedPhoto}
              alt="Selfie full size"
              fill
              className="object-contain"
              sizes="100vw"
            />
          </div>
        </div>
      )}
    </div>
  );
}
