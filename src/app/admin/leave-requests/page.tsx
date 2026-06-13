'use client';

import { useEffect } from 'react';
import { useLeaveRequests, leaveTypeLabels, LeaveRequest } from '@/hooks/useLeaveRequests';
import { Tabs } from '@/components/ui/Tabs';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { FormInput, FormSelect } from '@/components/ui/FormInput';
import { toast } from '@/components/ui/Toast';
import { Calendar, CheckCircle, XCircle, Plus } from 'lucide-react';
import { useState } from 'react';

const statusMap: Record<string, string> = {
  pending: 'Menunggu',
  approved: 'Disetujui',
  rejected: 'Ditolak',
  cancelled: 'Dibatalkan',
};

export default function LeaveRequestsPage() {
  const { requests, loading, fetchRequests, approveLeave, rejectLeave, createLeave } = useLeaveRequests();
  const [activeTab, setActiveTab] = useState('pending');
  const [showCreate, setShowCreate] = useState(false);

  // Form state for create
  const [formData, setFormData] = useState({
    type: 'annual' as LeaveRequest['type'],
    start_date: '',
    end_date: '',
    reason: '',
  });

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const pending = requests.filter((r) => r.status === 'pending');
  const approved = requests.filter((r) => r.status === 'approved');
  const rejected = requests.filter((r) => r.status === 'rejected' || r.status === 'cancelled');
  const all = requests;

  const tabs = [
    { id: 'pending', label: 'Menunggu', count: pending.length },
    { id: 'approved', label: 'Disetujui', count: approved.length },
    { id: 'rejected', label: 'Ditolak', count: rejected.length },
    { id: 'all', label: 'Semua', count: all.length },
  ];

  const getFiltered = () => {
    switch (activeTab) {
      case 'pending': return pending;
      case 'approved': return approved;
      case 'rejected': return rejected;
      default: return all;
    }
  };

  const handleApprove = async (id: string) => {
    const result = await approveLeave(id);
    if (result.success) {
      toast.success('Permohonan cuti disetujui');
    } else {
      toast.error(result.error || 'Gagal menyetujui permohonan');
    }
  };

  const handleReject = async (id: string) => {
    const result = await rejectLeave(id);
    if (result.success) {
      toast.success('Permohonan cuti ditolak');
    } else {
      toast.error(result.error || 'Gagal menolak permohonan');
    }
  };

  const handleCreate = async () => {
    if (!formData.start_date || !formData.end_date) {
      toast.error('Harap isi tanggal mulai dan selesai');
      return;
    }
    const result = await createLeave({
      type: formData.type,
      start_date: formData.start_date,
      end_date: formData.end_date,
      reason: formData.reason,
    });
    if (result.success) {
      toast.success('Permohonan cuti berhasil diajukan');
      setShowCreate(false);
      setFormData({ type: 'annual', start_date: '', end_date: '', reason: '' });
    } else {
      toast.error(result.error || 'Gagal mengajukan permohonan');
    }
  };

  const getStatusBadge = (status: LeaveRequest['status']) => {
    return (
      <Badge variant={status === 'approved' ? 'success' : status === 'rejected' ? 'danger' : status === 'cancelled' ? 'default' : 'warning'}>
        {statusMap[status] || status}
      </Badge>
    );
  };

  return (
    <div className="space-y-5">
      {/* Create button + tabs */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4" /> Pengajuan Baru
        </Button>
      </div>

      {/* Request Cards */}
      {getFiltered().length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-900 font-medium">Tidak ada pengajuan cuti</p>
          <p className="text-sm text-gray-500 mt-1">
            {activeTab === 'pending' ? 'Tidak ada permohonan yang menunggu ditinjau' : `Tidak ada permohonan ${statusMap[activeTab] || activeTab}`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {getFiltered().map((req) => (
            <div key={req.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  {/* Header */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-sm font-semibold text-blue-600">
                      {req.user_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{req.user_name}</p>
                      <p className="text-sm text-gray-500">{req.user_email}</p>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                      {getStatusBadge(req.status)}
                    </div>
                  </div>

                  {/* Details */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <div>
                      <p className="text-black text-xs">Jenis Cuti</p>
                      <p className="font-medium text-black">{leaveTypeLabels[req.type]}</p>
                    </div>
                    <div>
                      <p className="text-black text-xs">Mulai</p>
                      <p className="font-medium text-black">{new Date(req.start_date).toLocaleDateString('id-ID')}</p>
                    </div>
                    <div>
                      <p className="text-black text-xs">Sampai</p>
                      <p className="font-medium text-black">{new Date(req.end_date).toLocaleDateString('id-ID')}</p>
                    </div>
                    <div>
                      <p className="text-black text-xs">Durasi</p>
                      <p className="font-medium text-black">
                        {Math.ceil((new Date(req.end_date).getTime() - new Date(req.start_date).getTime()) / 86400000) + 1} Hari
                      </p>
                    </div>
                  </div>

                  {req.reason && (
                    <p className="mt-3 text-sm text-black bg-gray-50 p-3 rounded-lg border border-gray-200">
                      <span className="font-bold text-black">Alasan:</span> {req.reason}
                    </p>
                  )}
                </div>

                {/* Actions */}
                {req.status === 'pending' && (
                  <div className="flex flex-col gap-2 shrink-0">
                    <Button size="sm" onClick={() => handleApprove(req.id)}>
                      <CheckCircle className="w-4 h-4" /> Setujui
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => handleReject(req.id)}>
                      <XCircle className="w-4 h-4" /> Tolak
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Ajukan Permohonan Cuti" size="md">
        <div className="space-y-4">
          <FormSelect
            label="Jenis Cuti"
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value as LeaveRequest['type'] })}
            options={Object.entries(leaveTypeLabels).map(([value, label]) => ({ value, label }))}
          />
          <div className="grid grid-cols-2 gap-4">
            <FormInput
              label="Tanggal Mulai"
              type="date"
              value={formData.start_date}
              onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              required
            />
            <FormInput
              label="Tanggal Selesai"
              type="date"
              value={formData.end_date}
              onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-black mb-1">Alasan Cuti</label>
            <textarea
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              placeholder="Alasan mengajukan cuti..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-black bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={handleCreate} className="flex-1">Kirim Pengajuan</Button>
            <Button variant="secondary" onClick={() => setShowCreate(false)}>Batal</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}