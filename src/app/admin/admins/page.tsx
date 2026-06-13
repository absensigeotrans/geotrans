'use client';

import { useEffect, useState, useCallback } from 'react';
import { useEmployees } from '@/hooks/useEmployees';
import { useAuth } from '@/context/AuthContext';
import { SearchInput } from '@/components/ui/SearchInput';
import { StatsCard } from '@/components/ui/StatsCard';
import { Pagination } from '@/components/ui/Pagination';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { FormInput } from '@/components/ui/FormInput';
import { toast } from '@/components/ui/Toast';
import { Profile } from '@/types';
import { getWIBDate, formatWIBDateDisplay } from '@/lib/timezone';
import { UserCog, ShieldAlert, Trash2, UserPlus, Download, Eye, EyeOff } from 'lucide-react';

const PAGE_SIZE = 50;

export default function AdminsPage() {
  const {
    employees,
    loading,
    fetchEmployees,
    updateEmployee,
    createEmployee,
    deleteEmployee,
  } = useEmployees();
  const { user: currentUser } = useAuth();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  // Edit modal
  const [editAdmin, setEditAdmin] = useState<Profile | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [saving, setSaving] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);

  // Delete confirm modal
  const [deleteConfirmAdmin, setDeleteConfirmAdmin] = useState<Profile | null>(null);

  // Add Admin modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addFullName, setAddFullName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [addErrors, setAddErrors] = useState<Record<string, string>>({});

  const load = useCallback(
    async (s = search, p = page) => {
      // Fetch all, we will filter for admins
      const result = await fetchEmployees(p, PAGE_SIZE, s);
      // Let's filter admins to calculate total count
      const allAdmins = (result.data || []).filter((e) => e.role === 'admin');
      setTotal(allAdmins.length);
    },
    [fetchEmployees, search, page]
  );

  useEffect(() => {
    load();
  }, [load]);

  const handleSearch = (val: string) => {
    setSearch(val);
    setPage(1);
    load(val, 1);
  };

  const openEdit = (emp: Profile) => {
    setShowEditPassword(false);
    setEditAdmin(emp);
    setEditFullName(emp.full_name);
    setSaving(false);
  };

  const handleSaveEdit = async () => {
    if (!editAdmin) return;
    setSaving(true);
    const result = await updateEmployee(editAdmin.id, {
      full_name: editFullName,
      role: 'admin', // keep as admin
    });
    setSaving(false);
    if (result.success) {
      toast.success('Akun Admin berhasil diperbarui');
      setEditAdmin(null);
      load(search, page);
    } else {
      toast.error(result.error || 'Gagal memperbarui Admin');
    }
  };

  const openAddModal = () => {
    setAddFullName('');
    setAddEmail('');
    setAddPassword('');
    setAddErrors({});
    setShowAddModal(true);
  };

  const validateAddForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!addFullName.trim()) errors.full_name = 'Nama lengkap wajib diisi';
    if (!addEmail.trim()) errors.email = 'Email wajib diisi';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addEmail)) errors.email = 'Format email tidak valid';
    if (!addPassword) errors.password = 'Password wajib diisi';
    else if (addPassword.length < 8) errors.password = 'Password minimal 8 karakter';
    setAddErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddAdmin = async () => {
    if (!validateAddForm()) return;
    setSaving(true);
    const result = await createEmployee({
      email: addEmail,
      password: addPassword,
      full_name: addFullName,
      role: 'admin',
    });
    setSaving(false);
    if (result.success) {
      toast.success('Admin baru berhasil ditambahkan');
      setShowAddModal(false);
      load(search, page);
    } else {
      toast.error(result.error || 'Gagal menambahkan Admin');
    }
  };

  const handleDeleteAdmin = async () => {
    if (!deleteConfirmAdmin) return;
    if (deleteConfirmAdmin.id === currentUser?.id) {
      toast.error('Anda tidak dapat menghapus akun Anda sendiri');
      return;
    }
    setSaving(true);
    const result = await deleteEmployee(deleteConfirmAdmin.id);
    setSaving(false);
    if (result.success) {
      toast.success('Akun Admin berhasil dihapus');
      setDeleteConfirmAdmin(null);
      load(search, page);
    } else {
      toast.error(result.error || 'Gagal menghapus Admin');
    }
  };

  // Filter local copy of employees for rendering
  const adminList = employees.filter((e) => e.role === 'admin');

  const exportCSV = () => {
    const headers = ['Nama', 'Email', 'Role', 'Tanggal Bergabung'];
    const rows = adminList.map((e) => [
      e.full_name,
      e.email,
      'Admin',
      e.created_at,
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${c}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `admins_${getWIBDate()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV berhasil diunduh');
  };

  return (
    <div className="space-y-5">
      {/* Header / Title */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kelola Akun Admin</h1>
          <p className="text-sm text-gray-505">
            Halaman manajemen untuk menambah, memperbarui, dan menghapus akun Administrator sistem.
          </p>
        </div>
      </div>

      {/* Search + Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <SearchInput
          value={search}
          onChange={handleSearch}
          placeholder="Cari nama atau email..."
          className="flex-1"
        />
        <Button variant="secondary" onClick={exportCSV}>
          <Download className="w-4 h-4" /> Ekspor CSV
        </Button>
        <Button variant="primary" onClick={openAddModal}>
          <UserPlus className="w-4 h-4" /> Tambah Admin
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatsCard
          icon={<ShieldAlert className="w-6 h-6" />}
          value={adminList.length}
          label="Total Akun Admin"
          color="red"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-650">Nama</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-650">Email</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-655">Role</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-650">Tanggal Terdaftar</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-650">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
                  </td>
                </tr>
              ) : adminList.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    Tidak ada akun admin yang ditemukan
                  </td>
                </tr>
              ) : (
                adminList.map((emp) => {
                  const isSelf = emp.id === currentUser?.id;
                  return (
                    <tr key={emp.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center text-sm font-medium text-red-650">
                            {emp.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-medium text-gray-900">
                              {emp.full_name}
                            </span>
                            {isSelf && (
                              <span className="text-[10px] text-blue-600 font-semibold">
                                Akun Anda (Sedang Aktif)
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{emp.email}</td>
                      <td className="px-4 py-3">
                        <Badge variant="danger">
                          Admin
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-550">
                        {formatWIBDateDisplay(emp.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="ghost" onClick={() => openEdit(emp)}>
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            className={`text-xs py-1 px-2.5 ${isSelf ? 'opacity-40 cursor-not-allowed' : ''}`}
                            disabled={isSelf}
                            onClick={() => setDeleteConfirmAdmin(emp)}
                            title={isSelf ? 'Anda tidak bisa menghapus akun Anda sendiri' : ''}
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Hapus
                          </Button>
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

      {/* Pagination */}
      <Pagination
        currentPage={page}
        totalPages={Math.ceil(total / PAGE_SIZE) || 1}
        onPageChange={(p) => {
          setPage(p);
          load(search, p);
        }}
      />

      {/* Add Admin Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Tambah Administrator Baru" size="md">
        <div className="space-y-4">
          <FormInput
            label="Nama Lengkap *"
            value={addFullName}
            onChange={(e) => setAddFullName(e.target.value)}
            error={addErrors.full_name}
            placeholder="Masukkan nama lengkap admin"
          />
          <FormInput
            label="Alamat Email *"
            type="email"
            value={addEmail}
            onChange={(e) => setAddEmail(e.target.value)}
            error={addErrors.email}
            placeholder="admin@pertamina.com"
          />
          <FormInput
            label="Password *"
            type="password"
            value={addPassword}
            onChange={(e) => setAddPassword(e.target.value)}
            error={addErrors.password}
            placeholder="Minimal 8 karakter"
          />
          <div className="flex gap-2 pt-2">
            <Button onClick={handleAddAdmin} loading={saving} className="flex-1">
              <UserPlus className="w-4 h-4" /> Tambah Admin
            </Button>
            <Button variant="secondary" onClick={() => setShowAddModal(false)} disabled={saving}>
              Batal
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Admin Modal */}
      <Modal isOpen={!!editAdmin} onClose={() => setEditAdmin(null)} title="Edit Nama Administrator" size="sm">
        {editAdmin && (
          <div className="space-y-4">
            <FormInput
              label="Nama Lengkap"
              value={editFullName}
              onChange={(e) => setEditFullName(e.target.value)}
            />
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">Password Terdaftar</label>
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border rounded-lg text-sm text-black font-mono select-all">
                <span>{showEditPassword ? (editAdmin as any).registered_password || '—' : '••••••••'}</span>
                {(editAdmin as any).registered_password && (
                  <button
                    type="button"
                    onClick={() => setShowEditPassword(!showEditPassword)}
                    className="ml-auto p-1 text-gray-400 hover:text-gray-600 rounded"
                  >
                    {showEditPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                )}
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={handleSaveEdit} loading={saving} className="flex-1">
                Simpan Perubahan
              </Button>
              <Button variant="secondary" onClick={() => setEditAdmin(null)}>
                Batal
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={!!deleteConfirmAdmin} onClose={() => setDeleteConfirmAdmin(null)} title="Hapus Akun Administrator" size="sm">
        {deleteConfirmAdmin && (
          <div className="space-y-4">
            <div className="bg-red-50 text-red-800 p-3 rounded-lg text-sm border border-red-200">
              <p className="font-semibold">⚠️ Peringatan Penting:</p>
              <p className="mt-1">
                Menghapus administrator <strong>{deleteConfirmAdmin.full_name}</strong> ({deleteConfirmAdmin.email}) akan menghapus akun tersebut secara permanen dari database.
              </p>
              <p className="mt-1">
                Tindakan ini tidak dapat dibatalkan. Pastikan Anda benar-benar ingin menghapusnya.
              </p>
            </div>
            <p className="text-gray-600 text-sm">
              Apakah Anda yakin ingin melanjutkan tindakan ini?
            </p>
            <div className="flex gap-2 pt-2">
              <Button variant="danger" onClick={handleDeleteAdmin} loading={saving} className="flex-1">
                <Trash2 className="w-4 h-4" /> Ya, Hapus Akun
              </Button>
              <Button variant="secondary" onClick={() => setDeleteConfirmAdmin(null)} disabled={saving}>
                Batal
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
