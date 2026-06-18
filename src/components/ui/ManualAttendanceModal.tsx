import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { useEmployees } from '@/hooks/useEmployees';
import { toast } from '@/components/ui/Toast';
import { format } from 'date-fns';
import { X, UserPlus, Clock, Search } from 'lucide-react';
import { Profile } from '@/types';

interface ManualAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  initialData?: any;
}

export function ManualAttendanceModal({ isOpen, onClose, onSave, initialData }: ManualAttendanceModalProps) {
  const { fetchAllEmployees } = useEmployees();
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);

  // Form states
  const [userId, setUserId] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [checkInTime, setCheckInTime] = useState('08:00:00');
  const [checkOutTime, setCheckOutTime] = useState('');
  const [status, setStatus] = useState('present');
  const [workStatus, setWorkStatus] = useState('WFO');

  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadEmployees();
      if (initialData) {
        setUserId(initialData.user_id || '');
        
        // Extract date and time from check_in_time
        if (initialData.check_in_time) {
          const dt = new Date(initialData.check_in_time);
          setDate(format(dt, 'yyyy-MM-dd'));
          setCheckInTime(format(dt, 'HH:mm:ss'));
        }
        
        // Extract check_out_time
        if (initialData.check_out_time) {
          const outDt = new Date(initialData.check_out_time);
          setCheckOutTime(format(outDt, 'HH:mm:ss'));
        } else {
          setCheckOutTime('');
        }

        setStatus(initialData.status || 'present');
        setWorkStatus(initialData.work_status || 'WFO');
      } else {
        // Reset
        setUserId('');
        setDate(format(new Date(), 'yyyy-MM-dd'));
        setCheckInTime('08:00:00');
        setCheckOutTime('');
        setStatus('present');
        setWorkStatus('WFO');
      }
    }
  }, [isOpen, initialData]);

  const loadEmployees = async () => {
    const data = await fetchAllEmployees();
    setEmployees(data);
  };

  const filteredEmployees = employees.filter(emp => 
    emp.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    emp.employee_id?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) {
      toast.error('Silakan pilih karyawan');
      return;
    }
    if (!date) {
      toast.error('Silakan pilih tanggal');
      return;
    }
    if (!checkInTime) {
      toast.error('Silakan isi jam check-in');
      return;
    }

    setLoading(true);
    try {
      // Construct ISO strings for timezone Asia/Jakarta
      const checkInDateTime = `${date}T${checkInTime}+07:00`;
      let checkOutDateTime = null;
      if (checkOutTime) {
        checkOutDateTime = `${date}T${checkOutTime}+07:00`;
      }

      await onSave({
        id: initialData?.id,
        user_id: userId,
        check_in_time: checkInDateTime,
        check_out_time: checkOutDateTime,
        status: status,
        work_status: workStatus,
      });
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Gagal menyimpan data absensi');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {initialData ? 'Edit Absensi Manual' : 'Tambah Absensi Manual'}
              </h2>
              <p className="text-sm text-gray-500">
                Atur waktu check-in dan check-out untuk karyawan
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto">
          <div className="space-y-5">
            
            {/* Karyawan Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Karyawan <span className="text-red-500">*</span>
              </label>
              {!initialData ? (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Cari nama karyawan..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 border rounded-xl text-sm text-black focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div className="border rounded-xl max-h-40 overflow-y-auto bg-gray-50 p-1">
                    {filteredEmployees.length === 0 ? (
                      <div className="p-3 text-center text-sm text-gray-500">Tidak ada karyawan ditemukan</div>
                    ) : (
                      filteredEmployees.map(emp => (
                        <div 
                          key={emp.id} 
                          onClick={() => setUserId(emp.id)}
                          className={`px-3 py-2 text-sm rounded-lg cursor-pointer flex items-center gap-2 ${
                            userId === emp.id ? 'bg-blue-100 text-blue-700 font-medium' : 'hover:bg-gray-100 text-gray-700'
                          }`}
                        >
                          <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold shrink-0">
                            {emp.full_name?.charAt(0).toUpperCase()}
                          </div>
                          <span className="truncate">{emp.full_name}</span>
                          {emp.employee_id && <span className="text-xs text-gray-400">({emp.employee_id})</span>}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                <div className="px-4 py-3 bg-gray-50 border rounded-xl flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold">
                    {initialData.profiles?.full_name?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{initialData.profiles?.full_name || 'Unknown'}</div>
                    <div className="text-xs text-gray-500">{initialData.profiles?.employee_id || '-'}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Tanggal & Status */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tanggal <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-4 py-2 border rounded-xl text-black focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status Absen</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-4 py-2 border rounded-xl text-black focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="present">Hadir</option>
                  <option value="late">Terlambat</option>
                  <option value="outside_radius">Luar Radius</option>
                </select>
              </div>
            </div>

            {/* Jam Masuk & Keluar */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Jam Masuk <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Clock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="time"
                    step="1"
                    required
                    value={checkInTime}
                    onChange={(e) => setCheckInTime(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border rounded-xl text-black focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Jam Keluar (Opsional)
                </label>
                <div className="relative">
                  <Clock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="time"
                    step="1"
                    value={checkOutTime}
                    onChange={(e) => setCheckOutTime(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border rounded-xl text-black focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Work Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status Kerja</label>
              <select
                value={workStatus}
                onChange={(e) => setWorkStatus(e.target.value)}
                className="w-full px-4 py-2 border rounded-xl text-black focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="WFO">WFO (Work From Office)</option>
                <option value="WFH">WFH (Work From Home)</option>
                <option value="DINAS">Dinas Luar</option>
                <option value="LAINNYA">Lainnya</option>
              </select>
            </div>

            {/* Warning if Admin adds attendance manually */}
            <div className="bg-blue-50 text-blue-700 p-3 rounded-xl text-sm mt-4 border border-blue-100">
              Absensi yang dimasukkan melalui Admin secara otomatis ditandai valid tanpa pengecekan radius lokasi.
            </div>

          </div>

          <div className="mt-6 pt-4 border-t flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
              Batal
            </Button>
            <Button type="submit" disabled={loading || !userId}>
              {loading ? 'Menyimpan...' : 'Simpan Absensi'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
