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
import { ArrowLeftRight, Check, X, Clock, FileText, User, UserCog } from 'lucide-react';

const PAGE_SIZE = 20;

export default function AdminDriverRequestsPage() {
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

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch counts
      const { count: pending } = await supabase
        .from('driver_role_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      const { count: approved } = await supabase
        .from('driver_role_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'approved');

      const { count: totalReqs } = await supabase
        .from('driver_role_requests')
        .select('*', { count: 'exact', head: true });

      setPendingCount(pending || 0);
      setApprovedCount(approved || 0);
      setTotalCount(totalReqs || 0);

      // 2. Fetch paginated list with profile details
      let query = supabase
        .from('driver_role_requests')
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
        // Since we cannot search nested profiles directly without postgrest join filter,
        // we fetch user ids from profiles matching search, then filter requests.
        const { data: matchedProfiles } = await supabase
          .from('profiles')
          .select('id')
          .ilike('full_name', `%${search}%`);

        if (matchedProfiles && matchedProfiles.length > 0) {
          const ids = matchedProfiles.map(p => p.id);
          query = query.in('user_id', ids);
        } else {
          // If no profile matches search, return empty
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
      console.error('Error fetching driver requests:', err);
      toast.error('Gagal mengambil data pengajuan');
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
      const { error } = await supabase
        .from('driver_role_requests')
        .update({
          status: newStatus,
          admin_notes: adminNotes.trim(),
          approved_by: responseAction === 'approve' ? user.id : null,
          approved_at: responseAction === 'approve' ? new Date().toISOString() : null,
          rejected_by: responseAction === 'reject' ? user.id : null,
          rejected_at: responseAction === 'reject' ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedRequest.id);

      if (error) throw error;

      toast.success(
        responseAction === 'approve'
          ? 'Pengajuan berhasil disetujui, role karyawan terupdate'
          : 'Pengajuan ditolak'
      );
      
      setSelectedRequest(null);
      setResponseAction(null);
      setAdminNotes('');
      fetchRequests();
    } catch (err) {
      console.error('Error responding to request:', err);
      toast.error('Gagal memproses keputusan');
    } finally {
      setSubmitting(false);
    }
  };

  const openResponseModal = (req: any, action: 'approve' | 'reject') => {
    setSelectedRequest(req);
    setResponseAction(action);
    setAdminNotes('');
  };

  const getRoleLabel = (role: string) => {
    if (role === 'driver_bebas') return 'Driver (Bebas)';
    if (role === 'driver_kantor') return 'Driver (Kantor)';
    return role;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Driver Role Requests</h1>
        <p className="text-sm text-gray-500">Kelola dan setujui permohonan ganti jenis driver bebas & kantor.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatsCard icon={<Clock className="w-6 h-6" />} value={pendingCount} label="Pending Requests" color="orange" />
        <StatsCard icon={<Check className="w-6 h-6" />} value={approvedCount} label="Approved Requests" color="green" />
        <StatsCard icon={<UserCog className="w-6 h-6" />} value={totalCount} label="Total Requests" color="blue" />
      </div>

      {/* Search & Action bar */}
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
                <th className="px-5 py-3 text-left text-sm font-medium text-gray-600">Employee</th>
                <th className="px-5 py-3 text-left text-sm font-medium text-gray-600">Role Change</th>
                <th className="px-5 py-3 text-left text-sm font-medium text-gray-600">Reason</th>
                <th className="px-5 py-3 text-left text-sm font-medium text-gray-600">Date</th>
                <th className="px-5 py-3 text-left text-sm font-medium text-gray-600">Status</th>
                <th className="px-5 py-3 text-left text-sm font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-gray-500">No requests found</td>
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
                          <p className="font-semibold text-gray-900 text-sm">{req.profiles?.full_name || 'Unknown'}</p>
                          <p className="text-xs text-gray-500">{req.profiles?.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-gray-600 font-medium">{getRoleLabel(req.from_role)}</span>
                        <ArrowLeftRight className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        <span className="text-blue-600 font-bold">{getRoleLabel(req.to_role)}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-600 max-w-xs truncate" title={req.reason}>
                      {req.reason}
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
                        <span className="text-xs text-gray-400 font-medium">Processed</span>
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
        title={responseAction === 'approve' ? 'Setujui Pengajuan Ganti Role' : 'Tolak Pengajuan Ganti Role'}
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
                <span className="text-gray-500 font-medium">Perubahan:</span>
                <span className="font-semibold text-gray-800">
                  {getRoleLabel(selectedRequest.from_role)} → {getRoleLabel(selectedRequest.to_role)}
                </span>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-500 font-medium">Alasan:</span>
                <span className="font-medium text-gray-700 italic">"{selectedRequest.reason}"</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-gray-700 block">Catatan Admin (Opsional)</label>
              <textarea
                rows={2}
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Tuliskan catatan/tanggapan untuk driver..."
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
                {responseAction === 'approve' ? 'Setujui & Ubah Role' : 'Tolak Pengajuan'}
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
