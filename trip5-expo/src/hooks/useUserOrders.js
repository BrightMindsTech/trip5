import { useState, useCallback, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { initI18n } from '../i18n';
import { useAuth } from '../context/AuthContext';

function sortOrdersByScheduledAtDesc(rows) {
  return [...rows].sort((a, b) => {
    const ta = new Date(a.scheduled_at).getTime();
    const tb = new Date(b.scheduled_at).getTime();
    return tb - ta;
  });
}

/**
 * Loads current user's orders from Supabase; refetches on screen focus; subscribes to Realtime changes.
 */
export function useUserOrders() {
  const { session } = useAuth();
  const [locale, setLocale] = useState('ar');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rows, setRows] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadOrders = useCallback(async () => {
    setError(null);
    const { data, error: qErr } = await supabase
      .from('orders')
      .select('*')
      .order('scheduled_at', { ascending: false });
    if (qErr) {
      setError(qErr.message || 'fetch failed');
      setRows([]);
      return;
    }
    setRows(data || []);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      initI18n()
        .then((lang) => {
          if (!cancelled) setLocale(lang);
        })
        .catch(() => {
          if (!cancelled) setLocale('ar');
        });
      setLoading(true);
      loadOrders().finally(() => {
        if (!cancelled) setLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }, [loadOrders])
  );

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return undefined;

    const channel = supabase
      .channel(`orders:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          setRows((prev) => {
            if (payload.eventType === 'INSERT' && payload.new) {
              const id = payload.new.id;
              const rest = prev.filter((r) => r.id !== id);
              return sortOrdersByScheduledAtDesc([payload.new, ...rest]);
            }
            if (payload.eventType === 'UPDATE' && payload.new) {
              const next = prev.map((r) => (r.id === payload.new.id ? payload.new : r));
              return sortOrdersByScheduledAtDesc(next);
            }
            if (payload.eventType === 'DELETE' && payload.old?.id) {
              return prev.filter((r) => r.id !== payload.old.id);
            }
            return prev;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    await loadOrders();
    setRefreshing(false);
  }, [loadOrders]);

  return {
    locale,
    loading,
    error,
    rows,
    refreshing,
    loadOrders,
    onRefresh,
  };
}
