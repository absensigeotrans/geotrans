'use client';

import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useOffices } from '@/hooks/useOffices';
import { supabase } from '@/lib/supabase';
import { formatDistance } from '@/lib/utils';
import { StatsCard } from '@/components/ui/StatsCard';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FormInput } from '@/components/ui/FormInput';
import { toast } from '@/components/ui/Toast';
import { formatWIBTime, formatWIBDateDisplay, formatWIBDateShort } from '@/lib/timezone';
import { MapPin, Plus, Save, Trash2, Users, Clock } from 'lucide-react';

const MapPicker = dynamic(() => import('@/components/admin/MapPicker'), { ssr: false });

interface OfficeForm {
  name: string;
  latitude: string;
  longitude: string;
  geofence_radius: string;
}

interface OfficeStats {
  employeeCount: number;
  recentAttendees: { name: string; time: string }[];
}

export default function OfficesPage() {
  const { offices, loading, fetchOffices, createOffice, updateOffice, deleteOffice } = useOffices();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<OfficeForm>({ name: '', latitude: '', longitude: '', geofence_radius: '100' });
  const [saving, setSaving] = useState(false);
  const [officeStats, setOfficeStats] = useState<Record<string, OfficeStats>>({});
  const [selectedOffice, setSelectedOffice] = useState<string | null>(null);

  useEffect(() => {
    fetchOffices();
  }, [fetchOffices]);

  // Fetch stats per office
  useEffect(() => {
    if (offices.length === 0) return;

    const fetchStats = async () => {
      const stats: Record<string, OfficeStats> = {};

      for (const office of offices) {
        // Count unique employees who attended this office
        const { count } = await supabase
          .from('attendance')
          .select('user_id', { count: 'exact', head: true });

        // Get recent attendees
        const { data: recent } = await supabase
          .from('attendance')
          .select('check_in_time, profiles:user_id(full_name)')
          .order('check_in_time', { ascending: false })
          .limit(5);

        const attendees = (recent || []).slice(0, 5).map((r: any) => ({
          name: r.profiles?.full_name || 'Unknown',
          time: `${formatWIBDateShort(r.check_in_time)} ${formatWIBTime(r.check_in_time)}`,
        }));

        stats[office.id] = {
          employeeCount: count || 0,
          recentAttendees: attendees,
        };
      }

      setOfficeStats(stats);
    };

    fetchStats();
  }, [offices]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const data = {
      name: form.name,
      latitude: parseFloat(form.latitude),
      longitude: parseFloat(form.longitude),
      geofence_radius: parseInt(form.geofence_radius),
      is_active: true,
    };

    let result;
    if (editingId) {
      result = await updateOffice(editingId, data);
    } else {
      result = await createOffice(data);
    }

    setSaving(false);
    if (result.success) {
      toast.success(editingId ? 'Office updated' : 'Office created');
      setShowForm(false);
      setEditingId(null);
      setForm({ name: '', latitude: '', longitude: '', geofence_radius: '100' });
      fetchOffices();
    } else {
      toast.error(result.error || 'Failed to save');
    }
  };

  const handleEdit = (office: typeof offices[0]) => {
    setEditingId(office.id);
    setForm({
      name: office.name,
      latitude: office.latitude.toString(),
      longitude: office.longitude.toString(),
      geofence_radius: office.geofence_radius.toString(),
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    const result = await deleteOffice(id);
    if (result.success) {
      toast.success('Office deleted');
      fetchOffices();
    } else {
      toast.error('Failed to delete');
    }
  };

  const stats = officeStats[selectedOffice || ''];

  return (
    <div className="space-y-5">
      {/* Add New Button */}
      <div className="flex justify-between items-center">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1">
          <StatsCard icon={<MapPin className="w-5 h-5" />} value={offices.length} label="Total Offices" color="blue" />
          <StatsCard
            icon={<Users className="w-5 h-5" />}
            value={Object.values(officeStats).reduce((s, v) => s + v.employeeCount, 0)}
            label="Total Attendees"
            color="green"
          />
          <StatsCard
            icon={<Clock className="w-5 h-5" />}
            value={offices.reduce((s, o) => s + o.geofence_radius, 0)}
            label="Total Radius (m)"
            color="purple"
          />
        </div>
        <Button onClick={() => { setShowForm(true); setEditingId(null); setForm({ name: '', latitude: '', longitude: '', geofence_radius: '100' }); }}>
          <Plus className="w-4 h-4" /> Add Office
        </Button>
      </div>

      {/* Form Modal */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editingId ? 'Edit Office' : 'New Office'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormInput label="Office Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g., Jakarta HQ" required />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
            <MapPicker
              latitude={parseFloat(form.latitude) || -6.2088}
              longitude={parseFloat(form.longitude) || 106.8456}
              radius={parseInt(form.geofence_radius) || 100}
              onPositionChange={(lat, lng) => setForm({ ...form, latitude: lat.toString(), longitude: lng.toString() })}
              onRadiusChange={(r) => setForm({ ...form, geofence_radius: r.toString() })}
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="submit" loading={saving} className="flex-1">
              <Save className="w-4 h-4" /> {editingId ? 'Update' : 'Save'}
            </Button>
            <Button variant="secondary" type="button" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>

      {/* Detail Modal */}
      <Modal isOpen={!!selectedOffice} onClose={() => setSelectedOffice(null)} title="Office Details" size="md">
        {selectedOffice && (() => {
          const office = offices.find((o) => o.id === selectedOffice);
          if (!office) return null;
          const s = officeStats[selectedOffice];
          return (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Coordinates</p>
                  <p className="font-medium">{office.latitude.toFixed(6)}, {office.longitude.toFixed(6)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Radius</p>
                  <p className="font-medium">{formatDistance(office.geofence_radius)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Total Attendees</p>
                  <p className="font-medium">{s?.employeeCount || 0}</p>
                </div>
                <div>
                  <p className="text-gray-500">Created</p>
                  <p className="font-medium">{formatWIBDateDisplay(office.created_at)}</p>
                </div>
              </div>

              {s?.recentAttendees && s.recentAttendees.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Recent Attendees</h4>
                  <div className="space-y-2">
                    {s.recentAttendees.map((a, i) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-xs font-medium text-blue-600">
                            {a.name.charAt(0)}
                          </div>
                          <span className="text-sm">{a.name}</span>
                        </div>
                        <span className="text-xs text-gray-500">{a.time}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </Modal>

      {/* Offices List */}
      <div className="space-y-4">
        {offices.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border">
            <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 font-medium">No office locations</p>
            <p className="text-sm text-gray-500 mt-1">Add an office to enable geofencing</p>
            <Button className="mt-4" onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4" /> Add Office
            </Button>
          </div>
        ) : (
          offices.map((office) => {
            const s = officeStats[office.id];
            return (
              <div key={office.id} className="bg-white rounded-xl shadow-sm border p-5 hover:border-blue-200 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <button
                    onClick={() => setSelectedOffice(office.id)}
                    className="text-left flex-1 hover:text-blue-600"
                  >
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-blue-600" />
                      {office.name}
                    </h3>
                    <div className="flex flex-wrap gap-3 mt-2 text-sm text-gray-500">
                      <span>{office.latitude.toFixed(6)}, {office.longitude.toFixed(6)}</span>
                      <span className="bg-gray-100 px-2 py-0.5 rounded text-xs">{formatDistance(office.geofence_radius)} radius</span>
                      {s && (
                        <>
                          <span className="text-green-600 font-medium">{s.employeeCount} attendees</span>
                          <span>{s.recentAttendees.length} recent</span>
                        </>
                      )}
                    </div>
                  </button>
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="ghost" onClick={() => handleEdit(office)}>
                      <Save className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(office.id)} className="text-red-600 hover:bg-red-50">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}