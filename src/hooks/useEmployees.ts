import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Profile, UserRole, ShiftType } from '@/types';

interface EmployeeUpdate {
  full_name?: string;
  role?: UserRole;
  shift_type?: ShiftType | null;
  password?: string;
}

interface CreateEmployeeData {
  email: string;
  password: string;
  full_name: string;
  nik?: string;
  employee_id?: string;
  role: UserRole;
  shift_type?: ShiftType | null;
}

async function enrichEmployeesWithTodayShift(employees: Profile[]): Promise<Profile[]> {
  if (employees.length === 0) return [];

  const userIds = employees.map((e) => e.id);
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

  try {
    const { data: todayShifts, error } = await supabase
      .from('user_shift_schedules')
      .select('user_id, shift_type')
      .in('user_id', userIds)
      .eq('schedule_date', today);

    if (error) {
      console.error('Error fetching today shifts:', error);
      return employees;
    }

    const shiftMap = new Map<string, string>();
    for (const s of todayShifts || []) {
      shiftMap.set(s.user_id, s.shift_type);
    }

    return employees.map((emp) => {
      const todayShift = shiftMap.get(emp.id);
      return {
        ...emp,
        today_shift_type: (todayShift as ShiftType) || null,
      };
    });
  } catch (err) {
    console.error('Error in enrichEmployeesWithTodayShift:', err);
    return employees;
  }
}

export function useEmployees() {
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEmployees = useCallback(async (page = 1, limit = 50, search = '', includeAdmins = false) => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('profiles')
        .select('*', { count: 'exact' });

      if (!includeAdmins) {
        query = query.not('role', 'eq', 'admin');
      }

      query = query.order('created_at', { ascending: false })
        .range((page - 1) * limit, page * limit - 1);

      if (search) {
        query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
      }

      const { data, error: fetchError, count } = await query;
      if (fetchError) throw fetchError;

      const enriched = await enrichEmployeesWithTodayShift((data as Profile[]) || []);
      setEmployees(enriched);
      return { data: enriched, count: count || 0 };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch employees';
      setError(msg);
      return { data: [], count: 0 };
    } finally {
      setLoading(false);
    }
  }, []);

  const updateEmployee = useCallback(async (id: string, updates: EmployeeUpdate) => {
    try {
      // Use API route with service_role to update both profiles and auth metadata
      const res = await fetch('/api/admin/update-user-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: id,
          ...updates,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'Gagal update karyawan');
      }

      return { success: true, data: updates as Profile };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update employee';
      return { success: false, error: msg };
    }
  }, []);

  const toggleRole = useCallback(async (id: string, currentRole: UserRole) => {
    const newRole = currentRole === 'admin' ? 'viewer' : 'admin';
    return updateEmployee(id, { role: newRole });
  }, [updateEmployee]);

  const deactivateEmployee = useCallback(async (id: string) => {
    return updateEmployee(id, { role: 'inactive' });
  }, [updateEmployee]);

  const activateEmployee = useCallback(async (id: string, originalRole: UserRole) => {
    return updateEmployee(id, { role: originalRole });
  }, [updateEmployee]);

  // Create a new employee via server API route (uses service_role key)
  const createEmployee = useCallback(async (data: CreateEmployeeData) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (!res.ok) {
        return { success: false, error: result.error || 'Gagal membuat karyawan' };
      }

      // Refresh employee list
      await fetchEmployees();

      return { success: true, message: result.message || `Karyawan ${data.full_name} berhasil dibuat` };
    } catch (err: any) {
      const msg = err?.message || 'Failed to create employee';
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setLoading(false);
    }
  }, [fetchEmployees]);

  // Delete an employee via server API route (uses service_role key)
  const deleteEmployee = useCallback(async (userId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      const result = await res.json();

      if (!res.ok) {
        return { success: false, error: result.error || 'Gagal menghapus karyawan' };
      }

      // Refresh list
      await fetchEmployees();

      return { success: true, message: result.message || 'Karyawan berhasil dihapus' };
    } catch (err: any) {
      const msg = err?.message || 'Failed to delete employee';
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setLoading(false);
    }
  }, [fetchEmployees]);

  const fetchAllEmployees = useCallback(async (search = '', includeAdmins = false) => {
    try {
      let query = supabase
        .from('profiles')
        .select('*');

      if (!includeAdmins) {
        query = query.not('role', 'eq', 'admin');
      }

      query = query.order('created_at', { ascending: false });

      if (search) {
        query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
      }

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;

      const enriched = await enrichEmployeesWithTodayShift((data as Profile[]) || []);
      return enriched;
    } catch (err) {
      console.error('Error fetching all employees:', err);
      return [];
    }
  }, []);

  return {
    employees,
    setEmployees,
    loading,
    error,
    fetchEmployees,
    fetchAllEmployees,
    updateEmployee,
    toggleRole,
    deactivateEmployee,
    activateEmployee,
    createEmployee,
    deleteEmployee,
  };
}