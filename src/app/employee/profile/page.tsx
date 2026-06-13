'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { toast } from '@/components/ui/Toast';
import { User, Mail, Shield, BadgeIcon, Calendar, LogOut, ArrowRight, UserCheck } from 'lucide-react';

export default function EmployeeProfilePage() {
  const { profile, signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success('Logout berhasil!');
      router.push('/login');
    } catch (err) {
      console.error('Logout error:', err);
      toast.error('Gagal melakukan logout');
    }
  };

  if (!profile) {
    return (
      <div className="h-full flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const getShiftLabel = (type?: string | null) => {
    if (!type) return 'Belum Diatur';
    switch (type) {
      case 'morning':
        return 'Shift Pagi (06:00 - 14:00)';
      case 'afternoon':
        return 'Shift Siang (10:00 - 18:00)';
      case 'full_time':
        return 'Full Time (07:00 - 16:00)';
      case 'non_shifting':
        return 'Non-Shifting (Office)';
      default:
        return type.toUpperCase();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="relative border-l-2 border-blue-500 pl-4 py-1">
        <h1 className="text-xl font-bold text-white tracking-wide">Profil Karyawan</h1>
        <p className="text-xs text-gray-400">Informasi identitas dan shift kerja Anda.</p>
      </div>

      {/* Profile Card Header */}
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-800 rounded-3xl p-5 flex items-center gap-4 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl -translate-y-6 translate-x-6" />
        
        {/* Profile Avatar */}
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-red-500 flex items-center justify-center font-bold text-white text-xl shadow-md shrink-0">
          {profile.full_name?.charAt(0).toUpperCase() || 'U'}
        </div>

        <div className="min-w-0 space-y-1">
          <h2 className="text-base font-extrabold text-white truncate tracking-wide">
            {profile.full_name || 'Karyawan PTK'}
          </h2>
          <span className="inline-block text-[9.5px] font-bold px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full">
            {profile.role?.replace('_', ' ').toUpperCase() || 'KARYAWAN'}
          </span>
        </div>
      </div>

      {/* Info List */}
      <div className="bg-gray-900 border border-gray-800 rounded-3xl p-5 space-y-4">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider pl-1">Data Diri Karyawan</h3>
        
        <div className="space-y-3.5">
          {/* NIK */}
          <div className="flex items-center gap-3.5 py-1">
            <div className="p-2 bg-gray-800 border border-gray-700 text-gray-400 rounded-xl">
              <UserCheck className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] text-gray-500 block uppercase font-semibold">Nomor Induk Karyawan (NIK)</span>
              <span className="text-sm font-bold text-white tracking-wide">{profile.nik || '-'}</span>
            </div>
          </div>

          {/* Employee ID */}
          <div className="flex items-center gap-3.5 py-1">
            <div className="p-2 bg-gray-800 border border-gray-700 text-gray-400 rounded-xl">
              <Shield className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] text-gray-500 block uppercase font-semibold">Employee ID</span>
              <span className="text-sm font-bold text-white tracking-wide">{profile.employee_id || '-'}</span>
            </div>
          </div>

          {/* Email */}
          <div className="flex items-center gap-3.5 py-1">
            <div className="p-2 bg-gray-800 border border-gray-700 text-gray-400 rounded-xl">
              <Mail className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] text-gray-500 block uppercase font-semibold">Email</span>
              <span className="text-sm font-bold text-white truncate tracking-wide">{profile.email || '-'}</span>
            </div>
          </div>

          {/* Shift Type */}
          <div className="flex items-center gap-3.5 py-1">
            <div className="p-2 bg-gray-800 border border-gray-700 text-gray-400 rounded-xl">
              <Calendar className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] text-gray-500 block uppercase font-semibold">Tipe Shift Aktif</span>
              <span className="text-sm font-bold text-white tracking-wide">
                {getShiftLabel(profile.shift_type)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Logout Action */}
      <button
        onClick={handleSignOut}
        className="w-full bg-red-650 hover:bg-red-600 active:scale-[0.98] border border-red-500/20 text-white font-bold py-4 px-5 rounded-2xl flex items-center justify-between shadow-md transition-all group"
      >
        <span className="flex items-center gap-2 text-sm tracking-wide">
          <LogOut className="w-4.5 h-4.5 text-red-300" />
          Logout dari Akun
        </span>
        <ArrowRight className="w-4 h-4 text-red-300 group-hover:translate-x-1 transition-transform" />
      </button>
    </div>
  );
}
