'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from '@/components/ui/Toast';
import { Calendar, AlertCircle, FileText, CheckCircle, Clock, XCircle } from 'lucide-react';
import { differenceInDays, parseISO } from 'date-fns';

export default function EmployeeLeavePage() {
  const { user } = useAuth();
  
  // Forms state
  const [leaveType, setLeaveType] = useState('cuti_tahunan');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [totalDays, setTotalDays] = useState(0);

  // History state
  const [leaveHistory, setLeaveHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Calculate total days
  useEffect(() => {
    if (startDate && endDate) {
      const start = parseISO(startDate);
      const end = parseISO(endDate);
      const diff = differenceInDays(end, start);
      if (diff >= 0) {
        setTotalDays(diff + 1);
      } else {
        setTotalDays(0);
      }
    } else {
      setTotalDays(0);
    }
  }, [startDate, endDate]);

  const fetchLeaveHistory = useCallback(async () => {
    if (!user) return;
    setLoadingHistory(true);

    try {
      const { data, error } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLeaveHistory(data || []);
    } catch (err) {
      console.error('Error fetching leave history:', err);
      toast.error('Gagal memuat riwayat cuti');
    } finally {
      setLoadingHistory(false);
    }
  }, [user]);

  useEffect(() => {
    fetchLeaveHistory();
  }, [fetchLeaveHistory]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (totalDays <= 0) {
      toast.error('Tanggal selesai harus setelah tanggal mulai!');
      return;
    }

    if (!reason.trim()) {
      toast.error('Alasan cuti harus diisi!');
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('leave_requests')
        .insert({
          user_id: user.id,
          leave_type: leaveType,
          start_date: startDate,
          end_date: endDate,
          total_days: totalDays,
          reason: reason.trim(),
          status: 'pending',
        });

      if (error) throw error;

      toast.success('Permohonan cuti/izin berhasil diajukan');
      
      // Reset Form
      setStartDate('');
      setEndDate('');
      setReason('');
      setTotalDays(0);

      // Reload history
      fetchLeaveHistory();
    } catch (err) {
      console.error('Error submitting leave:', err);
      toast.error('Gagal mengirim permohonan');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-green-500/10 text-green-400 border border-green-500/20 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" /> DISETUJUI
          </span>
        );
      case 'rejected':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20 flex items-center gap-1">
            <XCircle className="w-3 h-3" /> DITOLAK
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 flex items-center gap-1">
            <Clock className="w-3 h-3" /> MENUNGGU
          </span>
        );
    }
  };

  const getLeaveTypeLabel = (type: string) => {
    switch (type) {
      case 'cuti_tahunan':
        return 'Cuti Tahunan';
      case 'cuti_sakit':
        return 'Cuti Sakit';
      case 'cuti_darurat':
        return 'Cuti Darurat';
      case 'izin_tidak_hadir':
        return 'Izin Tidak Hadir';
      default:
        return 'Cuti / Izin';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="relative border-l-2 border-blue-500 pl-4 py-1">
        <h1 className="text-xl font-bold text-white tracking-wide">Pengajuan Cuti / Izin</h1>
        <p className="text-xs text-gray-400">Ajukan permohonan cuti, sakit, atau izin dinas kantor.</p>
      </div>

      {/* Leave Request Form */}
      <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-3xl p-5 space-y-4">
        <h2 className="text-sm font-bold text-gray-300 uppercase tracking-wider">Form Pengajuan</h2>
        
        {/* Leave Type */}
        <div className="space-y-1.5">
          <label className="text-xs text-gray-400 font-semibold">Tipe Pengajuan</label>
          <select
            value={leaveType}
            onChange={(e) => setLeaveType(e.target.value)}
            className="w-full bg-gray-850 border border-gray-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
          >
            <option value="cuti_tahunan">Cuti Tahunan</option>
            <option value="cuti_sakit">Cuti Sakit / Sakit</option>
            <option value="cuti_darurat">Cuti Darurat</option>
            <option value="izin_tidak_hadir">Izin Tidak Hadir</option>
          </select>
        </div>

        {/* Date Fields */}
        <div className="grid grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <label className="text-xs text-gray-400 font-semibold">Tanggal Mulai</label>
            <input
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-gray-850 border border-gray-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-gray-400 font-semibold">Tanggal Selesai</label>
            <input
              type="date"
              required
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-gray-850 border border-gray-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Total Days Display */}
        {totalDays > 0 && (
          <div className="bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-2xl p-3 flex items-center gap-2 text-xs font-semibold">
            <Calendar className="w-4 h-4 shrink-0" />
            <span>Total Pengajuan: {totalDays} Hari Kerja</span>
          </div>
        )}

        {/* Reason / Alasan */}
        <div className="space-y-1.5">
          <label className="text-xs text-gray-400 font-semibold">Alasan / Keterangan</label>
          <textarea
            required
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Tuliskan keterangan lengkap pengajuan cuti/izin Anda..."
            className="w-full bg-gray-850 border border-gray-800 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 resize-none"
          />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting || totalDays <= 0}
          className={`w-full py-3.5 rounded-2xl font-bold text-sm tracking-wide shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2 ${
            isSubmitting || totalDays <= 0
              ? 'bg-gray-800 text-gray-600 cursor-not-allowed border border-gray-700/50 shadow-none'
              : 'bg-gradient-to-r from-blue-600 to-blue-500 text-white hover:brightness-110 active:brightness-95'
          }`}
        >
          {isSubmitting ? 'Mengirim...' : 'Kirim Pengajuan'}
        </button>
      </form>

      {/* Leave Request History */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider pl-1">Riwayat Pengajuan</h2>

        {loadingHistory ? (
          <div className="space-y-2">
            {[1, 2].map((n) => (
              <div key={n} className="h-20 bg-gray-900 border border-gray-800 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : leaveHistory.length === 0 ? (
          <div className="bg-gray-900 border border-gray-850 rounded-2xl p-6 text-center text-gray-500 text-xs">
            Belum ada riwayat pengajuan cuti atau izin.
          </div>
        ) : (
          <div className="space-y-3">
            {leaveHistory.map((request) => (
              <div
                key={request.id}
                className="bg-gray-900 border border-gray-850 rounded-2xl p-4 space-y-3 relative overflow-hidden shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <p className="text-sm font-bold text-white tracking-wide">
                      {getLeaveTypeLabel(request.leave_type)}
                    </p>
                    <p className="text-[10px] text-gray-500 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-blue-500" />
                      {request.start_date} s/d {request.end_date} ({request.total_days} hari)
                    </p>
                  </div>
                  {getStatusBadge(request.status)}
                </div>

                <div className="bg-gray-850/50 border border-gray-800 p-2.5 rounded-xl text-xs text-gray-400 flex gap-2">
                  <FileText className="w-4.5 h-4.5 text-gray-500 shrink-0 mt-0.5" />
                  <p className="italic leading-relaxed">"{request.reason}"</p>
                </div>

                {/* Admin notes (if responded) */}
                {request.admin_notes && (
                  <div className="bg-blue-950/20 border border-blue-900/20 p-2.5 rounded-xl text-xs text-gray-400 space-y-1">
                    <span className="font-bold text-blue-400 text-[10px] uppercase">Catatan Admin:</span>
                    <p className="italic">"{request.admin_notes}"</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
