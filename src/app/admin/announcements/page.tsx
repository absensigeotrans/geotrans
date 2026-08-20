'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { safeFetchJson } from '@/lib/safe-fetch';
import { useAuth } from '@/context/AuthContext';

import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { toast } from '@/components/ui/Toast';
import { SearchInput } from '@/components/ui/SearchInput';
import { StatsCard } from '@/components/ui/StatsCard';
import { 
  Megaphone, 
  Plus, 
  Send, 
  Users, 
  Eye, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Calendar,
  Building,
  Bell,
  Link as LinkIcon,
  ExternalLink,
  Trash2
} from 'lucide-react';

interface EmployeeOption {
  id: string;
  full_name: string;
  email: string;
  department?: string;
  role: string;
}

export default function AdminAnnouncementsPage() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Form modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form fields
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<'normal' | 'important' | 'urgent'>('normal');
  const [targetType, setTargetType] = useState<'ALL' | 'DEPARTMENT' | 'USERS'>('ALL');
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [expiresAt, setExpiresAt] = useState('');
  const [linkUrl, setLinkUrl] = useState('');

  // Options from DB
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);

  // Tracking modal state
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<any | null>(null);
  const [readStats, setReadStats] = useState<any | null>(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingSearch, setTrackingSearch] = useState('');
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleResendPush = async (item: any) => {
    setResendingId(item.id);
    try {
      const { ok, data, error } = await safeFetchJson('/api/admin/announcements/resend-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id }),
      });
      if (!ok) throw new Error(error || 'Gagal mengirim notifikasi');
      toast.success(data?.message || `Push notification terkirim ke ${data?.count || 0} perangkat!`);
    } catch (err: any) {
      console.error('Error resending push:', err);
      toast.error(err.message || 'Gagal mengirim push notification');
    } finally {
      setResendingId(null);
    }
  };


  const fetchAnnouncements = useCallback(async () => {
    setLoading(true);
    try {
      const { ok, data, error } = await safeFetchJson('/api/admin/announcements');
      if (!ok) throw new Error(error || 'Gagal memuat pengumuman');
      setAnnouncements(data?.data || []);
    } catch (err: any) {
      console.error('Error fetching announcements:', err);
      toast.error(err.message || 'Gagal memuat daftar pengumuman');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchOptions = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email, department, role')
        .neq('role', 'inactive')
        .order('full_name', { ascending: true });

      if (data) {
        setEmployees(data);
        const depts = Array.from(new Set(data.map((p) => p.department || p.role).filter(Boolean))) as string[];
        setDepartments(depts);
      }
    } catch (err) {
      console.error('Error fetching employee options:', err);
    }
  }, []);

  useEffect(() => {
    fetchAnnouncements();
    fetchOptions();
  }, [fetchAnnouncements, fetchOptions]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      toast.error('Judul dan isi pengumuman tidak boleh kosong');
      return;
    }

    setSubmitting(true);
    try {
      const targetValues = targetType === 'DEPARTMENT' ? selectedDepts : targetType === 'USERS' ? selectedUserIds : [];
      
      let formattedExpiresAt: string | null = null;
      if (expiresAt) {
        const expDate = new Date(expiresAt);
        // If user picked current minute, add 59 seconds to prevent instant expiration
        if (expDate.getTime() <= Date.now()) {
          expDate.setSeconds(59);
        }
        if (expDate.getTime() > Date.now()) {
          formattedExpiresAt = expDate.toISOString();
        }
      }

      const { ok, data, error } = await safeFetchJson('/api/admin/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          message: message.trim(),
          priority,
          target_type: targetType,
          target_values: targetValues,
          expires_at: formattedExpiresAt,
          link_url: linkUrl.trim() || undefined,
        }),
      });

      if (!ok) throw new Error(error || 'Gagal mengirim pengumuman');

      toast.success(data?.pushNotice || 'Pengumuman berhasil dikirim!');
      setIsCreateModalOpen(false);
      resetForm();
      fetchAnnouncements();
    } catch (err: any) {
      console.error('Error creating announcement:', err);
      toast.error(err.message || 'Gagal mengirim pengumuman');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setMessage('');
    setPriority('normal');
    setTargetType('ALL');
    setSelectedDepts([]);
    setSelectedUserIds([]);
    setExpiresAt('');
    setLinkUrl('');
  };

  const openTrackingModal = async (announcement: any) => {
    setSelectedAnnouncement(announcement);
    setTrackingLoading(true);
    setTrackingSearch('');
    try {
      const { ok, data, error } = await safeFetchJson(`/api/admin/announcements/reads?id=${announcement.id}`);
      if (!ok) throw new Error(error || 'Gagal memuat detail keterbacaan');
      setReadStats(data);
    } catch (err: any) {
      console.error('Error fetching read stats:', err);
      toast.error(err.message || 'Gagal memuat statistik pembaca');
    } finally {
      setTrackingLoading(false);
    }
  };

  const handleDelete = async (id: string, itemTitle?: string) => {
    const confirmMsg = itemTitle 
      ? `Apakah Anda yakin ingin menghapus pengumuman "${itemTitle}"?\nPengumuman akan dihapus permanen dari sistem dan aplikasi HP karyawan.`
      : 'Apakah Anda yakin ingin menghapus pengumuman ini?';
    if (!confirm(confirmMsg)) return;

    setDeletingId(id);
    try {
      const { ok, data, error } = await safeFetchJson('/api/admin/announcements', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      if (!ok) throw new Error(error || 'Gagal menghapus pengumuman');

      toast.success(data?.message || 'Pengumuman berhasil dihapus');
      if (selectedAnnouncement?.id === id) {
        setSelectedAnnouncement(null);
      }
      fetchAnnouncements();
    } catch (err: any) {
      console.error('Error deleting announcement:', err);
      toast.error(err.message || 'Gagal menghapus pengumuman');
    } finally {
      setDeletingId(null);
    }
  };

  const filteredAnnouncements = announcements.filter((item) => {
    const query = search.toLowerCase();
    return item.title.toLowerCase().includes(query) || item.body.toLowerCase().includes(query);
  });

  const urgentCount = announcements.filter((a) => a.priority === 'urgent').length;
  const totalSent = announcements.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Megaphone className="w-7 h-7 text-blue-600" />
            Pengumuman & Push Notification
          </h1>
          <p className="text-sm text-gray-500">
            Kirim pengumuman 1-arah dan notifikasi push ke aplikasi HP karyawan GeoTrans.
          </p>
        </div>
        <Button onClick={() => setIsCreateModalOpen(true)} className="flex items-center gap-2 shadow-md">
          <Plus className="w-4 h-4" />
          Kirim Pengumuman Baru
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatsCard icon={<Bell className="w-6 h-6" />} value={totalSent} label="Total Pengumuman Dikirim" color="blue" />
        <StatsCard icon={<AlertTriangle className="w-6 h-6" />} value={urgentCount} label="Pengumuman Urgent/Darurat" color="red" />
        <StatsCard icon={<Users className="w-6 h-6" />} value={employees.length} label="Total Karyawan Aktif" color="green" />
      </div>

      {/* Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <SearchInput
          value={search}
          onChange={(val) => setSearch(val)}
          placeholder="Cari pengumuman..."
          className="flex-1"
        />
      </div>

      {/* Announcements Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-5 py-3.5 text-left text-sm font-medium text-gray-600">Pengumuman</th>
                <th className="px-5 py-3.5 text-left text-sm font-medium text-gray-600">Prioritas</th>
                <th className="px-5 py-3.5 text-left text-sm font-medium text-gray-600">Target Audience</th>
                <th className="px-5 py-3.5 text-left text-sm font-medium text-gray-600">Tanggal Kirim</th>
                <th className="px-5 py-3.5 text-left text-sm font-medium text-gray-600">Status Pembaca</th>
                <th className="px-5 py-3.5 text-left text-sm font-medium text-gray-600">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
                  </td>
                </tr>
              ) : filteredAnnouncements.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-gray-500">
                    Belum ada pengumuman yang dikirim.
                  </td>
                </tr>
              ) : (
                filteredAnnouncements.map((item) => {
                  const readPct = item.total_targets > 0 ? Math.round((item.read_count / item.total_targets) * 100) : 0;
                  return (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-5 py-4 max-w-xs">
                        <p className="font-semibold text-gray-900 text-sm line-clamp-1">{item.title}</p>
                        <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{item.body}</p>
                        {item.link_url && (
                          <a
                            href={item.link_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 mt-1 text-xs text-blue-600 hover:text-blue-800 hover:underline font-medium"
                          >
                            <ExternalLink className="w-3 h-3" /> Tautan Terlampir
                          </a>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <Badge
                          variant={
                            item.priority === 'urgent'
                              ? 'danger'
                              : item.priority === 'important'
                              ? 'warning'
                              : 'info'
                          }
                        >
                          {item.priority === 'urgent'
                            ? '🚨 Urgent'
                            : item.priority === 'important'
                            ? '⚠️ Penting'
                            : 'ℹ️ Biasa'}
                        </Badge>
                      </td>
                      <td className="px-5 py-4 text-xs font-medium text-gray-700">
                        {item.target_type === 'ALL' && (
                          <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full border border-blue-200">
                            <Users className="w-3 h-3" /> Semua Karyawan
                          </span>
                        )}
                        {item.target_type === 'DEPARTMENT' && (
                          <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 px-2.5 py-1 rounded-full border border-purple-200">
                            <Building className="w-3 h-3" /> Per Departemen ({item.target_values?.length || 0})
                          </span>
                        )}
                        {item.target_type === 'USERS' && (
                          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full border border-amber-200">
                            <Users className="w-3 h-3" /> Karyawan Tertentu ({item.target_values?.length || 0})
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-xs text-gray-500 whitespace-nowrap">
                        {new Date(item.created_at).toLocaleDateString('id-ID', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-gray-200 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-green-500 h-full rounded-full transition-all duration-300"
                              style={{ width: `${readPct}%` }}
                            />
                          </div>
                          <span className="text-xs font-bold text-gray-700">{readPct}%</span>
                          <span className="text-[11px] text-gray-400">({item.read_count} dibaca)</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleResendPush(item)}
                            disabled={resendingId === item.id}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg border border-purple-200 transition-colors disabled:opacity-50"
                            title="Kirim Notifikasi Push HP Manual"
                          >
                            <Bell className="w-3.5 h-3.5 text-purple-600" />
                            {resendingId === item.id ? 'Mengirim...' : 'Kirim Push HP'}
                          </button>
                          <button
                            onClick={() => openTrackingModal(item)}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" /> Detail Pembaca
                          </button>
                          <button
                            onClick={() => handleDelete(item.id, item.title)}
                            disabled={deletingId === item.id}
                            className="p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-50 rounded-lg border border-red-200 transition-colors"
                            title="Hapus Pengumuman"
                          >
                            {deletingId === item.id ? (
                              <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
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

      {/* CREATE ANNOUNCEMENT MODAL */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Kirim Pengumuman Baru ke HP Karyawan"
        size="md"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Judul Pengumuman *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: Perubahan Jam Kerja Selama Bulan Ramadan"
              className="w-full border border-gray-300 rounded-xl px-3.5 py-2 text-sm text-gray-900 bg-white placeholder:text-gray-400 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Isi Pengumuman *</label>
            <textarea
              required
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tuliskan isi pengumuman selengkapnya di sini..."
              className="w-full border border-gray-300 rounded-xl px-3.5 py-2 text-sm text-gray-900 bg-white placeholder:text-gray-400 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Link / URL Tautan (Opsional)</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <LinkIcon className="w-4 h-4" />
              </div>
              <input
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://drive.google.com/... atau https://pertamina.com/..."
                className="w-full border border-gray-300 rounded-xl pl-9 pr-3.5 py-2 text-sm text-gray-900 bg-white placeholder:text-gray-400 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Penerima di HP dapat langsung mengklik tautan ini untuk membuka web/dokumen.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Tingkat Urgensi / Prioritas</label>
              <select
                value={priority}
                onChange={(e: any) => setPriority(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-900 bg-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="normal" className="text-gray-900 bg-white">ℹ️ Informasi Biasa</option>
                <option value="important" className="text-gray-900 bg-white">⚠️ Penting</option>
                <option value="urgent" className="text-gray-900 bg-white">🚨 Darurat / Urgent</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Masa Berlaku (Opsional)</label>
              <input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-900 bg-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Target Penerima</label>
            <select
              value={targetType}
              onChange={(e: any) => setTargetType(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-900 bg-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL" className="text-gray-900 bg-white">🌐 Semua Karyawan</option>
              <option value="DEPARTMENT" className="text-gray-900 bg-white">🏢 Per Departemen</option>
              <option value="USERS" className="text-gray-900 bg-white">👤 Karyawan Tertentu (Spesifik)</option>
            </select>
          </div>

          {targetType === 'DEPARTMENT' && (
            <div className="space-y-2 bg-purple-50 p-3 rounded-xl border border-purple-100">
              <label className="block text-xs font-bold text-purple-800">Pilih Departemen Target:</label>
              <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto">
                {departments.map((dept) => (
                  <label key={dept} className="flex items-center gap-2 text-xs text-purple-900 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedDepts.includes(dept)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedDepts([...selectedDepts, dept]);
                        else setSelectedDepts(selectedDepts.filter((d) => d !== dept));
                      }}
                      className="rounded text-purple-600"
                    />
                    {dept}
                  </label>
                ))}
              </div>
            </div>
          )}

          {targetType === 'USERS' && (
            <div className="space-y-2 bg-amber-50 p-3 rounded-xl border border-amber-100">
              <label className="block text-xs font-bold text-amber-800">Pilih Karyawan Target:</label>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {employees.map((emp) => (
                  <label key={emp.id} className="flex items-center gap-2 text-xs text-amber-900 cursor-pointer hover:bg-amber-100/50 p-1 rounded">
                    <input
                      type="checkbox"
                      checked={selectedUserIds.includes(emp.id)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedUserIds([...selectedUserIds, emp.id]);
                        else setSelectedUserIds(selectedUserIds.filter((id) => id !== emp.id));
                      }}
                      className="rounded text-amber-600"
                    />
                    <span>{emp.full_name}</span>
                    <span className="text-[10px] text-amber-600 font-mono">({emp.email})</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-3 border-t">
            <Button type="submit" loading={submitting} className="flex-1 flex items-center justify-center gap-2">
              <Send className="w-4 h-4" />
              Kirim Notifikasi & Pengumuman
            </Button>
            <Button type="button" variant="secondary" onClick={() => setIsCreateModalOpen(false)} disabled={submitting}>
              Batal
            </Button>
          </div>
        </form>
      </Modal>

      {/* TRACKING READ RECEIPTS MODAL */}
      <Modal
        isOpen={!!selectedAnnouncement}
        onClose={() => setSelectedAnnouncement(null)}
        title="Laporan Detail Keterbacaan Pengumuman"
        size="lg"
      >
        {selectedAnnouncement && (
          <div className="space-y-5 text-sm">
            {/* Overview Box */}
            <div className="bg-gray-50 p-4 rounded-xl border space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-gray-900 text-base">{selectedAnnouncement.title}</h3>
                <Badge
                  variant={
                    selectedAnnouncement.priority === 'urgent'
                      ? 'danger'
                      : selectedAnnouncement.priority === 'important'
                      ? 'warning'
                      : 'info'
                  }
                >
                  {selectedAnnouncement.priority}
                </Badge>
              </div>
              <p className="text-gray-600 text-xs bg-white p-2.5 rounded-lg border">{selectedAnnouncement.body}</p>
              {selectedAnnouncement.link_url && (
                <div className="pt-1">
                  <a
                    href={selectedAnnouncement.link_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Buka Tautan: {selectedAnnouncement.link_url}
                  </a>
                </div>
              )}
            </div>

            {/* Read Stats Bar */}
            {readStats?.stats && (
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl">
                  <p className="text-xs text-blue-600 font-medium">Total Target</p>
                  <p className="text-lg font-bold text-blue-900">{readStats.stats.total_employees}</p>
                </div>
                <div className="bg-green-50 border border-green-200 p-3 rounded-xl">
                  <p className="text-xs text-green-600 font-medium">Sudah Membaca</p>
                  <p className="text-lg font-bold text-green-900">
                    {readStats.stats.read_count} ({readStats.stats.read_percentage}%)
                  </p>
                </div>
                <div className="bg-orange-50 border border-orange-200 p-3 rounded-xl">
                  <p className="text-xs text-orange-600 font-medium">Belum Membaca</p>
                  <p className="text-lg font-bold text-orange-900">{readStats.stats.unread_count}</p>
                </div>
              </div>
            )}

            {/* Search Filter for Employees */}
            <SearchInput
              value={trackingSearch}
              onChange={(val) => setTrackingSearch(val)}
              placeholder="Cari nama karyawan..."
            />

            {/* Employees Read Status Table */}
            <div className="border rounded-xl overflow-hidden max-h-72 overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-100 sticky top-0 border-b">
                  <tr>
                    <th className="px-4 py-2.5 text-xs font-semibold text-gray-700">Nama Karyawan</th>
                    <th className="px-4 py-2.5 text-xs font-semibold text-gray-700">Departemen</th>
                    <th className="px-4 py-2.5 text-xs font-semibold text-gray-700">Status Pembacaan</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-xs">
                  {trackingLoading ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto" />
                      </td>
                    </tr>
                  ) : !readStats?.employees ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-4 text-center text-gray-500">
                        Tidak ada data
                      </td>
                    </tr>
                  ) : (
                    readStats.employees
                      .filter((emp: any) => emp.full_name?.toLowerCase().includes(trackingSearch.toLowerCase()))
                      .map((emp: any) => (
                        <tr key={emp.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2.5">
                            <p className="font-semibold text-gray-900">{emp.full_name}</p>
                            <p className="text-[10px] text-gray-500">{emp.email}</p>
                          </td>
                          <td className="px-4 py-2.5 text-gray-600">{emp.department || '-'}</td>
                          <td className="px-4 py-2.5">
                            {emp.is_read ? (
                              <span className="inline-flex items-center gap-1.5 text-green-700 font-semibold bg-green-50 px-2.5 py-1 rounded-full border border-green-200">
                                <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                                Dibaca: {new Date(emp.read_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-orange-700 font-medium bg-orange-50 px-2.5 py-1 rounded-full border border-orange-200">
                                <Clock className="w-3.5 h-3.5 text-orange-500" />
                                Belum Membaca
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-3 border-t">
              <Button
                type="button"
                variant="danger"
                disabled={deletingId === selectedAnnouncement.id}
                loading={deletingId === selectedAnnouncement.id}
                onClick={() => handleDelete(selectedAnnouncement.id, selectedAnnouncement.title)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Hapus Pengumuman
              </Button>
              <Button variant="secondary" onClick={() => setSelectedAnnouncement(null)}>
                Tutup
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
