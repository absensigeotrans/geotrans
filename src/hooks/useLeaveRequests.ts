import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface LeaveRequest {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  type: 'annual' | 'sick' | 'emergency' | 'unpaid';
  start_date: string;
  end_date: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  created_at: string;
  approved_by?: string;
  approved_at?: string;
}

interface LeaveInsert {
  type: LeaveRequest['type'];
  start_date: string;
  end_date: string;
  reason: string;
}

const leaveTypeLabels: Record<LeaveRequest['type'], string> = {
  annual: 'Cuti Tahunan',
  sick: 'Sakit',
  emergency: 'Darurat',
  unpaid: 'Izin Tidak Dibayar',
};

export { leaveTypeLabels };

export function useLeaveRequests() {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('leave_requests')
        .select('*, profiles:user_id(full_name, email)')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mapped: LeaveRequest[] = (data || []).map((r: any) => ({
        id: r.id,
        user_id: r.user_id,
        user_name: r.profiles?.full_name || 'Unknown',
        user_email: r.profiles?.email || '',
        type: r.type,
        start_date: r.start_date,
        end_date: r.end_date,
        reason: r.reason || '',
        status: r.status,
        created_at: r.created_at,
        approved_by: r.approved_by,
        approved_at: r.approved_at,
      }));

      setRequests(mapped);
    } catch (err) {
      console.error('Failed to fetch leave requests:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const approveLeave = useCallback(async (id: string) => {
    try {
      const { data: user } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('leave_requests')
        .update({
          status: 'approved',
          approved_by: user.user?.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
      setRequests((prev) =>
        prev.map((r) =>
          r.id === id
            ? { ...r, status: 'approved', approved_at: new Date().toISOString() }
            : r
        )
      );
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to approve' };
    }
  }, []);

  const rejectLeave = useCallback(async (id: string) => {
    try {
      const { data: user } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('leave_requests')
        .update({
          status: 'rejected',
          approved_by: user.user?.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
      setRequests((prev) =>
        prev.map((r) =>
          r.id === id
            ? { ...r, status: 'rejected', approved_at: new Date().toISOString() }
            : r
        )
      );
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to reject' };
    }
  }, []);

  const createLeave = useCallback(async (data: LeaveInsert) => {
    try {
      const { data: user } = await supabase.auth.getUser();
      const userId = user.user?.id;
      if (!userId) throw new Error('Not authenticated');

      const { error } = await supabase.from('leave_requests').insert({
        user_id: userId,
        type: data.type,
        start_date: data.start_date,
        end_date: data.end_date,
        reason: data.reason,
      });

      if (error) throw error;
      await fetchRequests();
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to create' };
    }
  }, [fetchRequests]);

  const cancelLeave = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('leave_requests')
        .update({ status: 'cancelled' })
        .eq('id', id)
        .eq('status', 'pending');

      if (error) throw error;
      setRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: 'cancelled' } : r))
      );
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to cancel' };
    }
  }, []);

  const getByStatus = useCallback((status: LeaveRequest['status']) => {
    return requests.filter((r) => r.status === status);
  }, [requests]);

  return {
    requests,
    loading,
    fetchRequests,
    approveLeave,
    rejectLeave,
    createLeave,
    cancelLeave,
    getByStatus,
  };
}
