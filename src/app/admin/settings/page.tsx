'use client';

import { useEffect, useState } from 'react';
import { useAdminSettings, type ShiftConfig } from '@/hooks/useAdminSettings';
import { Button } from '@/components/ui/Button';
import { FormInput } from '@/components/ui/FormInput';
import { toast } from '@/components/ui/Toast';
import { Settings, Clock, MapPin, Database, CheckCircle, AlertCircle, ArrowsUpFromLine, Sun, Moon, SunDim, Building2, Pencil, Check, X } from 'lucide-react';

export default function SettingsPage() {
  const { settings, loading, synced, syncFromDB, updateSettings, resetSettings, shifts, shiftsLoading, fetchShifts, updateShift } = useAdminSettings();

  const [hour, setHour] = useState(settings.late_threshold_hour.toString());
  const [minute, setMinute] = useState(settings.late_threshold_minute.toString());
  const [radius, setRadius] = useState(settings.default_geofence_radius.toString());
  const [saving, setSaving] = useState(false);
  const [editingShift, setEditingShift] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ start_time: string; end_time: string; grace_minutes: string }>({ start_time: '', end_time: '', grace_minutes: '' });

  useEffect(() => {
    setHour(settings.late_threshold_hour.toString());
    setMinute(settings.late_threshold_minute.toString());
    setRadius(settings.default_geofence_radius.toString());
  }, [settings]);

  useEffect(() => {
    syncFromDB();
    fetchShifts();
  }, [syncFromDB, fetchShifts]);

  const startEdit = (s: ShiftConfig) => {
    setEditingShift(s.shift_type);
    setEditValues({ start_time: s.start_time.slice(0, 5), end_time: s.end_time.slice(0, 5), grace_minutes: String(s.grace_minutes) });
  };

  const cancelEdit = () => {
    setEditingShift(null);
  };

  const saveEdit = async (shift_type: string) => {
    await updateShift(shift_type, {
      start_time: editValues.start_time + ':00',
      end_time: editValues.end_time + ':00',
      grace_minutes: parseInt(editValues.grace_minutes) || 3,
    });
    setEditingShift(null);
    toast.success('Shift updated');
  };

  const handleSave = async () => {
    setSaving(true);
    await updateSettings({
      late_threshold_hour: parseInt(hour) || 9,
      late_threshold_minute: parseInt(minute) || 0,
      default_geofence_radius: parseInt(radius) || 100,
    });
    setSaving(false);
    toast.success('Settings saved' + (synced ? ' (synced to DB)' : ' (local only)'));
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Sync Status */}
      <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm ${
        synced ? 'bg-green-50 border-green-200 text-green-700' : 'bg-yellow-50 border-yellow-200 text-yellow-700'
      }`}>
        {synced ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
        <span>
          {synced
            ? 'Settings synced with database. Changes will apply to new attendance records.'
            : 'Settings stored locally only. Database table may not exist yet. Run migration 002 first.'}
        </span>
      </div>

      {/* Late Threshold */}
      <div className="bg-white rounded-xl shadow-sm border p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Clock className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Late Threshold</h3>
            <p className="text-sm text-gray-500">Batas terlambat untuk karyawan Non-Shifting (Full Time). Shift Pagi & Siang punya batas sendiri.</p>
          </div>
        </div>

        <div className="flex items-center gap-3 pl-12">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Time:</label>
            <select
              value={hour}
              onChange={(e) => setHour(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i} className="text-gray-900 bg-white">{i.toString().padStart(2, '0')}</option>
              ))}
            </select>
            <span className="text-gray-500 font-medium">:</span>
            <select
              value={minute}
              onChange={(e) => setMinute(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="0" className="text-gray-900 bg-white">00</option>
              <option value="15" className="text-gray-900 bg-white">15</option>
              <option value="30" className="text-gray-900 bg-white">30</option>
              <option value="45" className="text-gray-900 bg-white">45</option>
            </select>
          </div>
          <span className="text-gray-500 text-sm">
            ({parseInt(hour).toString().padStart(2, '0')}:{parseInt(minute).toString().padStart(2, '0')} = late untuk Non-Shifting)
          </span>
        </div>
      </div>

      {/* Shift Config */}
      <div className="bg-white rounded-xl shadow-sm border p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-100 rounded-lg">
            <Sun className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Konfigurasi Shift</h3>
            <p className="text-sm text-gray-500">Jam kerja per shift. Digunakan untuk kalkulasi lembur otomatis.</p>
          </div>
        </div>

        {shiftsLoading ? (
          <div className="pl-12 text-sm text-gray-400">Loading...</div>
        ) : (
          <div className="pl-12 space-y-3">
            {shifts.map(s => (
              <div key={s.shift_type} className="border rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{s.name}</span>
                    <span className="text-xs text-gray-400 font-mono">{s.shift_type}</span>
                  </div>
                  {editingShift === s.shift_type ? (
                    <div className="flex gap-1">
                      <button onClick={() => saveEdit(s.shift_type)} className="p-1 text-green-600 hover:bg-green-50 rounded">
                        <Check className="w-4 h-4" />
                      </button>
                      <button onClick={cancelEdit} className="p-1 text-gray-400 hover:bg-gray-100 rounded">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => startEdit(s)} className="p-1 text-gray-400 hover:bg-gray-100 rounded">
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {editingShift === s.shift_type ? (
                  <div className="flex items-center gap-3 text-sm">
                    <label className="text-gray-500">Start:</label>
                    <input type="time" value={editValues.start_time} onChange={e => setEditValues(p => ({ ...p, start_time: e.target.value }))} className="px-2 py-1 border rounded text-sm" />
                    <label className="text-gray-500">End:</label>
                    <input type="time" value={editValues.end_time} onChange={e => setEditValues(p => ({ ...p, end_time: e.target.value }))} className="px-2 py-1 border rounded text-sm" />
                    <label className="text-gray-500">Grace:</label>
                    <input type="number" min="0" max="60" value={editValues.grace_minutes} onChange={e => setEditValues(p => ({ ...p, grace_minutes: e.target.value }))} className="px-2 py-1 border rounded text-sm w-16" />
                    <span className="text-xs text-gray-400">menit</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span><span className="text-gray-400">Start:</span> {s.start_time.slice(0, 5)} WIB</span>
                    <span><span className="text-gray-400">End:</span> {s.end_time.slice(0, 5)} WIB</span>
                    <span><span className="text-gray-400">Grace:</span> {s.grace_minutes} menit</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Default Geofence Radius */}
      <div className="bg-white rounded-xl shadow-sm border p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <MapPin className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Default Geofence Radius</h3>
            <p className="text-sm text-gray-500">Default radius for new office locations (in meters)</p>
          </div>
        </div>

        <div className="pl-12">
          <FormInput
            label=""
            type="number"
            min="10"
            max="10000"
            value={radius}
            onChange={(e) => setRadius(e.target.value)}
            hint="Must be between 10 and 10000 meters"
            className="max-w-xs"
          />
        </div>
      </div>

      {/* System Info */}
      <div className="bg-white rounded-xl shadow-sm border p-6 space-y-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gray-100 rounded-lg">
            <Database className="w-5 h-5 text-gray-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">System Information</h3>
            <p className="text-sm text-gray-500">Database connection details</p>
          </div>
        </div>

        <div className="pl-12 space-y-2 text-sm">
          <div className="flex gap-4">
            <span className="text-gray-500">Supabase Project:</span>
            <span className="font-mono text-gray-700">yoykktgggvvoigrbtvhq</span>
          </div>
          <div className="flex gap-4">
            <span className="text-gray-500">App Version:</span>
            <span className="font-mono text-gray-700">1.0.0</span>
          </div>
          <div className="flex gap-4">
            <span className="text-gray-500">Settings Table:</span>
            <span className={synced ? 'text-green-600 font-medium' : 'text-yellow-600 font-medium'}>
              {synced ? 'Connected' : 'Not found (run migration 002)'}
            </span>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex gap-3">
        <Button onClick={handleSave} loading={saving} className="flex-1">
          <Settings className="w-4 h-4" /> Save Settings
        </Button>
        <Button variant="ghost" onClick={resetSettings}>
          Reset to Defaults
        </Button>
      </div>

      {/* Migration Guide */}
      {!synced && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 text-sm text-blue-800 space-y-2">
          <h4 className="font-semibold">Required: Run Database Migration</h4>
          <p>To enable settings sync with the database, run the following in your Supabase SQL editor:</p>
          <pre className="bg-white border rounded-lg p-3 text-xs overflow-x-auto mt-2">
{`-- supabase/migrations/002_admin_settings.sql
CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY DEFAULT 'app_settings',
  late_threshold_hour INTEGER DEFAULT 9,
  late_threshold_minute INTEGER DEFAULT 0,
  default_geofence_radius INTEGER DEFAULT 100,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO settings (id) VALUES ('app_settings') ON CONFLICT DO NOTHING;

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage settings" ON settings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Update the trigger to read from settings
CREATE OR REPLACE FUNCTION validate_attendance_geofence()
RETURNS TRIGGER AS $$
DECLARE
  office_record RECORD;
  settings_record RECORD;
  calculated_distance DOUBLE PRECISION;
  R_EARTH CONSTANT DOUBLE PRECISION := 6371000;
  d_lat DOUBLE PRECISION;
  d_lon DOUBLE PRECISION;
  a DOUBLE PRECISION;
  c DOUBLE PRECISION;
BEGIN
  SELECT * INTO office_record FROM offices LIMIT 1;
  SELECT * INTO settings_record FROM settings WHERE id = 'app_settings';

  IF office_record IS NULL THEN
    NEW.is_valid := FALSE;
    NEW.status := 'outside_radius';
    RETURN NEW;
  END IF;

  d_lat := RADIANS(NEW.latitude - office_record.latitude);
  d_lon := RADIANS(NEW.longitude - office_record.longitude);
  a := SIN(d_lat/2) * SIN(d_lat/2) +
       COS(RADIANS(office_record.latitude)) * COS(RADIANS(NEW.latitude)) *
       SIN(d_lon/2) * SIN(d_lon/2);
  c := 2 * ATAN2(SQRT(a), SQRT(1-a));
  calculated_distance := R_EARTH * c;
  NEW.distance_from_office := calculated_distance;

  IF calculated_distance <= office_record.geofence_radius THEN
    NEW.is_valid := TRUE;
    -- Use settings threshold
    IF EXTRACT(HOUR FROM NEW.check_in_time) > settings_record.late_threshold_hour
       OR (EXTRACT(HOUR FROM NEW.check_in_time) = settings_record.late_threshold_hour
           AND EXTRACT(MINUTE FROM NEW.check_in_time) >= settings_record.late_threshold_minute)
    THEN
      NEW.status := 'late';
    ELSE
      NEW.status := 'present';
    END IF;
  ELSE
    NEW.is_valid := FALSE;
    NEW.status := 'outside_radius';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;`}
          </pre>
        </div>
      )}
    </div>
  );
}