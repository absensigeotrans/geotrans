'use client';

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Office } from '@/types';

interface UseOfficesReturn {
  offices: Office[];
  currentOffice: Office | null;
  loading: boolean;
  error: string | null;
  fetchOffices: () => Promise<void>;
  createOffice: (office: Omit<Office, 'id' | 'created_at' | 'updated_at'>) => Promise<{ success: boolean; error?: string }>;
  updateOffice: (id: string, office: Partial<Office>) => Promise<{ success: boolean; error?: string }>;
  deleteOffice: (id: string) => Promise<{ success: boolean; error?: string }>;
}

export function useOffices(): UseOfficesReturn {
  const [offices, setOffices] = useState<Office[]>([]);
  const [currentOffice, setCurrentOffice] = useState<Office | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOffices = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('offices')
        .select('*')
        .order('created_at', { ascending: true });

      if (fetchError) throw fetchError;

      setOffices(data as Office[] || []);
      setCurrentOffice(data?.[0] as Office || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch offices');
    } finally {
      setLoading(false);
    }
  }, []);

  const createOffice = useCallback(async (office: Omit<Office, 'id' | 'created_at' | 'updated_at'>) => {
    setLoading(true);
    setError(null);

    try {
      const { error: insertError } = await supabase
        .from('offices')
        .insert([office]);

      if (insertError) throw insertError;

      await fetchOffices();
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create office';
      setError(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  }, [fetchOffices]);

  const updateOffice = useCallback(async (id: string, office: Partial<Office>) => {
    setLoading(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('offices')
        .update(office)
        .eq('id', id);

      if (updateError) throw updateError;

      await fetchOffices();
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update office';
      setError(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  }, [fetchOffices]);

  const deleteOffice = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);

    try {
      const { error: deleteError } = await supabase
        .from('offices')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      await fetchOffices();
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete office';
      setError(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  }, [fetchOffices]);

  return {
    offices,
    currentOffice,
    loading,
    error,
    fetchOffices,
    createOffice,
    updateOffice,
    deleteOffice,
  };
}
