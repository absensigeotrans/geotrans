import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface AdminSettings {
  late_threshold_hour: number;
  late_threshold_minute: number;
  default_geofence_radius: number;
}

export interface ShiftConfig {
  id: string;
  shift_type: string;
  name: string;
  start_time: string;
  end_time: string;
  grace_minutes: number;
  is_active: boolean;
}

const STORAGE_KEY = 'geoattend_admin_settings';

const defaults: AdminSettings = {
  late_threshold_hour: 7,
  late_threshold_minute: 3,
  default_geofence_radius: 100,
};

export function useAdminSettings() {
  // [FIX] Gunakan lazy initializer di useState untuk membaca localStorage.
  // Ini lebih benar daripada useEffect karena berjalan sekali saat mount
  // tanpa memicu render tambahan dan tanpa melanggar aturan ESLint.
  const [settings, setSettings] = useState<AdminSettings>(() => {
    try {
      const stored = typeof window !== 'undefined'
        ? localStorage.getItem(STORAGE_KEY)
        : null;
      if (stored) {
        return { ...defaults, ...JSON.parse(stored) };
      }
    } catch {
      // Fallback to defaults jika JSON tidak valid
    }
    return defaults;
  });
  const [loading, setLoading] = useState(false);
  const [synced, setSynced] = useState(false); // false = only in localStorage

  // Try to load from DB settings table
  const syncFromDB = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('id', 'app_settings')
        .single();

      if (error || !data) {
        // Table might not exist yet, that's ok
        setSynced(false);
        setLoading(false);
        return;
      }

      const dbSettings: AdminSettings = {
        late_threshold_hour: data.late_threshold_hour ?? defaults.late_threshold_hour,
        late_threshold_minute: data.late_threshold_minute ?? defaults.late_threshold_minute,
        default_geofence_radius: data.default_geofence_radius ?? defaults.default_geofence_radius,
      };

      setSettings(dbSettings);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dbSettings));
      setSynced(true);
    } catch {
      setSynced(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateSettings = useCallback(async (newSettings: Partial<AdminSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

    // Try to update DB (will fail gracefully if table doesn't exist)
    try {
      await supabase
        .from('settings')
        .upsert({
          id: 'app_settings',
          ...updated,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });
      setSynced(true);
    } catch {
      setSynced(false);
    }
  }, [settings]);

  const resetSettings = useCallback(() => {
    setSettings(defaults);
    localStorage.removeItem(STORAGE_KEY);
    setSynced(false);
  }, []);

  // ── Shift Config ──────────────────────────────────────────
  const [shifts, setShifts] = useState<ShiftConfig[]>([]);
  const [shiftsLoading, setShiftsLoading] = useState(false);

  const fetchShifts = useCallback(async () => {
    setShiftsLoading(true);
    try {
      const { data, error } = await supabase
        .from('shift_config')
        .select('*')
        .order('shift_type');
      if (error) throw error;
      setShifts(data ?? []);
    } catch {
      // silently fail
    } finally {
      setShiftsLoading(false);
    }
  }, []);

  const updateShift = useCallback(async (shift_type: string, values: Partial<ShiftConfig>) => {
    await supabase
      .from('shift_config')
      .update({
        ...values,
        updated_at: new Date().toISOString(),
      })
      .eq('shift_type', shift_type);

    setShifts(prev => prev.map(s => s.shift_type === shift_type ? { ...s, ...values } as ShiftConfig : s));
  }, []);

  return {
    settings,
    loading,
    synced,
    syncFromDB,
    updateSettings,
    resetSettings,
    shifts,
    shiftsLoading,
    fetchShifts,
    updateShift,
  };
}