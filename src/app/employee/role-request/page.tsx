'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from '@/components/ui/Toast';
import { Calendar, ArrowLeftRight, FileText, CheckCircle, Clock, XCircle, UserCog } from 'lucide-react';

export default function EmployeeRoleRequestPage() {
  const { user, profile } = useAuth();
  
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requests, setRequests] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const currentRole = profile?.role || '';
  const targetRole = currentRole === 'driver_kantor' ? 'driver_bebas' : 'driver_kantor';

  const fetchRequestHistory = useCallback(async () => {
    if (!user) return;
    setLoadingHistory(true);

    try {
      const { data, error } = await supabase
        .from('driver_role_requests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch (err) {
      console.error('Error fetching role requests:', err);
      toast.error('Gagal memuat riwayat pengajuan');
    } finally {
      setLoadingHistory(false);
    }
  }, [user]);

  useEffect(() => {
    fetchRequestHistory();
  }, [fetchRequestHistory]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;

    if (profile.role !== 'driver_bebas' && profile.role !== 'driver_kantor') {
      toast.error('Fitur ini hanya tersedia untuk akun Driver!');
      return;
    }

    if (!reason.trim()) {
      toast.error('Alasan pengajuan ganti role harus diisi!');
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('driver_role_requests')
        .insert({
          user_id: user.id,
          from_role: currentRole,
          to_role: targetRole,
          reason: reason.trim(),
          status: 'pending',
        });

      if (error) throw error;

      toast.success('Permohonan ganti role berhasil diajukan');
      setReason('');
      fetchRequestHistory();
    } catch (err) {
      console.error('Error submitting role request:', err);
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
            <Clock className="w-3 h-3" /> PENDING
          </span>
        );
    }
  };

  const getRoleLabel = (role: string) => {
    if (role === 'driver_bebas') return 'Driver (Bebas / Tanpa Geofence)';
    if (role === 'driver_kantor') return 'Driver (Kantor / Wajib Geofence)';
    return role;
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="relative border-l-2 border-blue-500 pl-4 py-1">
        <h1 className="text-xl font-bold text-white tracking-wide">Pengajuan Ganti Role</h1>
        <p className="text-xs text-gray-400">Ajukan pergantian jenis Driver untuk melakukan absen di luar radius kantor.</p>
      </div>

      {/* Role Request Form */}
      <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-3xl p-5 space-y-4">
        <h2 className="text-sm font-bold text-gray-300 uppercase tracking-wider">Form Pengajuan</h2>

        {/* Roles Compare Display */}
        <div className="grid grid-cols-2 gap-4 bg-gray-950 p-4 rounded-2xl border border-gray-800 text-xs">
          <div className="space-y-1">
            <span className="text-gray-500 font-semibold block">Role Saat Ini:</span>
            <span className="font-bold text-gray-300 block">{getRoleLabel(currentRole)}</span>
          </div>
          <div className="space-y-1 border-l border-gray-850 pl-4">
            <span className="text-blue-400 font-semibold block">Role Target:</span>
            <span className="font-bold text-blue-300 block">{getRoleLabel(targetRole)}</span>
          </div>
        </div>

        {/* Reason / Alasan */}
        <div className="space-y-1.5">
          <label className="text-xs text-gray-400 font-semibold">Alasan Ganti Jenis Driver</label>
          <textarea
            required
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Tuliskan alasan lengkap, misal: Harus mengantar logistik ke luar kota/daerah..."
            className="w-full bg-gray-850 border border-gray-800 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 resize-none"
          />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting || !currentRole}
          className={`w-full py-3.5 rounded-2xl font-bold text-sm tracking-wide shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2 ${
            isSubmitting || !currentRole
              ? 'bg-gray-800 text-gray-600 cursor-not-allowed border border-gray-700/50 shadow-none'
              : 'bg-gradient-to-r from-blue-600 to-blue-500 text-white hover:brightness-110 active:brightness-95'
          }`}
        >
          {isSubmitting ? 'Mengirim...' : 'Kirim Pengajuan'}
        </button>
      </form>

      {/* Role Request History */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider pl-1">Riwayat Pengajuan</h2>

        {loadingHistory ? (
          <div className="space-y-2">
            {[1, 2].map((n) => (
              <div key={n} className="h-20 bg-gray-900 border border-gray-800 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : requests.length === 0 ? (
          <div className="bg-gray-900 border border-gray-850 rounded-2xl p-6 text-center text-gray-500 text-xs">
            Belum ada riwayat pengajuan ganti role.
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((request) => (
              <div
                key={request.id}
                className="bg-gray-900 border border-gray-850 rounded-2xl p-4 space-y-3 relative overflow-hidden shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs font-bold text-white">
                      <span>{getRoleLabel(request.from_role)}</span>
                      <ArrowLeftRight className="w-3.5 h-3.5 text-blue-500" />
                      <span className="text-blue-400">{getRoleLabel(request.to_role)}</span>
                    </div>
                    <p className="text-[10px] text-gray-500 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-blue-500" />
                      Diajukan: {new Date(request.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
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
