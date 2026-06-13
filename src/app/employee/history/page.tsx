'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { formatWIBDateDisplay, formatWIBTime } from '@/lib/timezone';
import { formatDistance } from '@/lib/utils';
import { Clock, LogOut, MapPin, Calendar, Camera } from 'lucide-react';
import { toast } from '@/components/ui/Toast';

export default function EmployeeHistoryPage() {
  const { user } = useAuth();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', user.id)
        .order('check_in_time', { ascending: false })
        .limit(30);

      if (error) throw error;
      setHistory(data || []);
    } catch (err) {
      console.error('Error fetching personal history:', err);
      toast.error('Gagal memuat riwayat absensi');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'present':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-green-500/10 text-green-400 border border-green-500/20">
            HADIR
          </span>
        );
      case 'late':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
            TELAT
          </span>
        );
      case 'outside_radius':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            LUAR RADIUS
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-gray-500/10 text-gray-400 border border-gray-500/20">
            TERCATAT
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Info */}
      <div className="relative border-l-2 border-blue-500 pl-4 py-1">
        <h1 className="text-xl font-bold text-white tracking-wide">Riwayat Absensi</h1>
        <p className="text-xs text-gray-400">Menampilkan 30 log kehadiran terakhir Anda.</p>
      </div>

      {/* History List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-24 bg-gray-900 border border-gray-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : history.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-3xl p-8 text-center text-gray-500">
          <Calendar className="w-8 h-8 mx-auto mb-2 text-gray-700" />
          <p className="text-sm">Belum ada riwayat absensi.</p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {history.map((record) => {
            const hasCheckout = record.check_out_time !== null;
            return (
              <div
                key={record.id}
                className="bg-gray-900 border border-gray-850 hover:border-gray-800 rounded-2xl p-4 flex gap-4 transition-all relative overflow-hidden group shadow-md"
              >
                {/* Visual Accent */}
                <div className="absolute top-0 left-0 bottom-0 w-1 bg-blue-500/80 rounded-l-full" />

                {/* Selfie Thumbnail (If present) */}
                {record.photo_url ? (
                  <div className="w-16 h-20 rounded-xl overflow-hidden bg-gray-800 border border-gray-750 shrink-0 relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={record.photo_url}
                      alt="Selfie Check-in"
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute bottom-1 right-1 bg-black/70 p-1 rounded-md text-[8px] text-gray-400">
                      <Camera className="w-2.5 h-2.5" />
                    </div>
                  </div>
                ) : (
                  <div className="w-16 h-20 rounded-xl bg-gray-800/50 border border-gray-750 flex flex-col items-center justify-center shrink-0 text-gray-500">
                    <Camera className="w-4 h-4" />
                    <span className="text-[8px] mt-1">No Photo</span>
                  </div>
                )}

                {/* Info details */}
                <div className="flex-1 min-w-0 flex flex-col justify-between space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-bold text-white tracking-wide truncate">
                      {formatWIBDateDisplay(record.check_in_time)}
                    </p>
                    {getStatusBadge(record.status)}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-400 mt-1">
                    {/* Check In */}
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-green-500" />
                      <div>
                        <span className="text-[9px] text-gray-500 block uppercase font-semibold">Masuk</span>
                        <span className="font-semibold text-gray-300">
                          {formatWIBTime(record.check_in_time)}
                        </span>
                      </div>
                    </div>

                    {/* Check Out */}
                    <div className="flex items-center gap-1.5">
                      <LogOut className="w-3.5 h-3.5 text-red-400" />
                      <div>
                        <span className="text-[9px] text-gray-500 block uppercase font-semibold">Keluar</span>
                        <span className="font-semibold text-gray-300">
                          {hasCheckout ? formatWIBTime(record.check_out_time) : '--:--'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Geolocation Distance details */}
                  <div className="flex items-center gap-1 text-[10px] text-gray-500 pt-0.5 border-t border-gray-800/40">
                    <MapPin className="w-3 h-3 text-blue-500" />
                    <span>Jarak: {formatDistance(record.distance_from_office)}</span>
                    {record.work_status && (
                      <span className="ml-auto font-bold bg-gray-850 px-1.5 py-0.5 rounded text-[8px] text-gray-400 border border-gray-800">
                        {record.work_status}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
