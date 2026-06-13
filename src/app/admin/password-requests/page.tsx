'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { toast } from '@/components/ui/Toast';
import { Pagination } from '@/components/ui/Pagination';
import { SearchInput } from '@/components/ui/SearchInput';
import { StatsCard } from '@/components/ui/StatsCard';
import { Clock, Check, X, FileText, Lock, Eye, EyeOff } from 'lucide-react';

const PAGE_SIZE = 20;

export default function AdminPasswordRequestsPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  // Stats
  const [pendingCount, setPendingCount] = useState(0);
  const [approvedCount, setApprovedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  // Response Modals
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [responseAction, setResponseAction] = useState<'approve' | 'reject' | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Visibility states for requested passwords in the table
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  const togglePasswordVisibility = (id: string) => {
    setVisiblePasswords((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch counts
      const { count: pending } = await supabase
        .from('password_change_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      const { count: approved } = await supabase
        .from('password_change_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'approved');

      const { count: totalReqs } = await supabase
        .from('password_change_requests')
        .select('*', { count: 'exact', head: true });

      setPendingCount(pending || 0);
      setApprovedCount(approved || 0);
      setTotalCount(totalReqs || 0);

      // 2. Fetch requests with profile details
      let query = supabase
        .from('password_change_requests')
        .select(`
          *,
          profiles:user_id (
            full_name,
            email,
            employee_id
          )
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

      if (search) {
        const { data: matchedProfiles } = await supabase
          .from('profiles')
          .select('id')
          .ilike('full_name', `%${search}%`);

        if (matchedProfiles && matchedProfiles.length > 0) {
          const ids = matchedProfiles.map(p => p.id);
          query = query.in('user_id', ids);
        } else {
          setRequests([]);
          setTotal(0);
          setLoading(false);
          return;
        }
      }

      const { data, error, count } = await query;

      if (error) throw error;
      setRequests(data || []);
      setTotal(count || 0);
    } catch (err) {
      console.error('Error fetching password requests:', err);
      toast.error('Gagal mengambil data pengajuan password');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleResponse = async () => {
    if (!selectedRequest || !responseAction || !user) return;

    setSubmitting(true);
    const newStatus = responseAction === 'approve' ? 'approved' : 'rejected';

    try {
      const res = await fetch('/api/admin/approve-password-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request_id: selectedRequest.id,
          status: newStatus,
          admin_notes: adminNotes.trim(),
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'Gagal memproses keputusan');
      }

      toast.success(
        responseAction === 'approve'
          ? 'Pengajuan ganti password berhasil disetujui, password terupdate'
          : 'Pengajuan ganti password ditolak'
      );
      
      setSelectedRequest(null);
      setResponseAction(null);
      setAdminNotes('');
      fetchRequests();
    } catch (err: any) {
      console.error('Error responding to password request:', err);
      toast.error(err.message || 'Gagal memproses keputusan');
    } finally {
      setSubmitting(false);
    }
  };

  const openResponseModal = (req: any, action: 'approve' | 'reject') => {
    setSelectedRequest(req);
    setResponseAction(action);
    setAdminNotes('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pengajuan Ganti Password</h1>
        <p className="text-sm text-gray-500">Kelola dan setujui permohonan penggantian password dari karyawan.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatsCard icon={<Clock className="w-6 h-6" />} value={pendingCount} label="Pending Requests" color="orange" />
        <StatsCard icon={<Check className="w-6 h-6" />} value={approvedCount} label="Approved Requests" color="green" />
        <StatsCard icon={<Lock className="w-6 h-6" />} value={totalCount} label="Total Requests" color="blue" />
      </div>

      {/* Search bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <SearchInput
          value={search}
          onChange={(val) => { setSearch(val); setPage(1); }}
          placeholder="Cari nama karyawan..."
          className="flex-1"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-5 py-3 text-left text-sm font-medium text-gray-600">Karyawan</th>
                <th className="px-5 py-3 text-left text-sm font-medium text-gray-600">Password Baru yang Diajukan</th>
                <th className="px-5 py-3 text-left text-sm font-medium text-gray-600">Tanggal Pengajuan</th>
                <th className="px-5 py-3 text-left text-sm font-medium text-gray-600">Status</th>
                <th className="px-5 py-3 text-left text-sm font-medium text-gray-600">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-gray-500">Tidak ada pengajuan password</td>
                </tr>
              ) : (
                requests.map((req) => (
                  <tr key={req.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center text-sm font-semibold text-blue-600">
                          {req.profiles?.full_name?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 text-sm">{req.profiles?.full_name || 'Tidak Diketahui'}</p>
                          <p className="text-xs text-gray-500">{req.profiles?.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-sm font-mono text-gray-700">
                      <div className="flex items-center gap-1.5">
                        <span className="select-all">
                          {visiblePasswords[req.id] ? req.new_password : '••••••••'}
                        </span>
                        <button
                          onClick={() => togglePasswordVisibility(req.id)}
                          className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
                          title={visiblePasswords[req.id] ? "Sembunyikan password" : "Tampilkan password"}
                        >
                          {visiblePasswords[req.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-500">
                      {new Date(req.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant={
                        req.status === 'approved' ? 'success' :
                        req.status === 'rejected' ? 'danger' : 'warning'
                      }>
                        {req.status === 'approved' ? 'Disetujui' :
                         req.status === 'rejected' ? 'Ditolak' : 'Pending'}
                      </Badge>
                    </td>
                    <td className="px-5 py-3">
                      {req.status === 'pending' ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => openResponseModal(req, 'approve')}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded border border-green-200"
                            title="Setujui"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openResponseModal(req, 'reject')}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded border border-red-200"
                            title="Tolak"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 font-medium">Selesai Diproses</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <Pagination
        currentPage={page}
        totalPages={Math.ceil(total / PAGE_SIZE)}
        onPageChange={(p) => setPage(p)}
      />

      {/* Response Modal */}
      <Modal
        isOpen={!!selectedRequest}
        onClose={() => { setSelectedRequest(null); setResponseAction(null); }}
        title={responseAction === 'approve' ? 'Setujui Pengajuan Ganti Password' : 'Tolak Pengajuan Ganti Password'}
        size="sm"
      >
        {selectedRequest && (
          <div className="space-y-4 text-sm">
            <div className="bg-gray-50 border rounded-xl p-3.5 space-y-2">
              <div className="flex gap-2">
                <span className="text-gray-500 font-medium">Nama:</span>
                <span className="font-bold text-gray-800">{selectedRequest.profiles?.full_name}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-500 font-medium">Password Baru:</span>
                <span className="font-semibold text-gray-800 font-mono">{selectedRequest.new_password}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-gray-700 block">Catatan Admin (Opsional)</label>
              <textarea
                rows={2}
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Tuliskan catatan/alasan keputusan..."
                className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant={responseAction === 'approve' ? 'primary' : 'danger'}
                onClick={handleResponse}
                loading={submitting}
                className="flex-1"
              >
                {responseAction === 'approve' ? 'Setujui & Ganti' : 'Tolak Pengajuan'}
              </Button>
              <Button
                variant="secondary"
                onClick={() => { setSelectedRequest(null); setResponseAction(null); }}
                disabled={submitting}
              >
                Batal
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
