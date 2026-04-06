import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { initI18n } from '../i18n';

/**
 * Loads and mutates current user's saved places (Supabase + RLS).
 */
export function useSavedPlaces() {
  const [locale, setLocale] = useState('ar');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rows, setRows] = useState([]);

  const loadPlaces = useCallback(async () => {
    setError(null);
    const { data, error: qErr } = await supabase
      .from('saved_places')
      .select('id, label, address, latitude, longitude, kind, created_at, updated_at')
      .order('created_at', { ascending: false });
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
      loadPlaces().finally(() => {
        if (!cancelled) setLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }, [loadPlaces])
  );

  const refresh = useCallback(async () => {
    setError(null);
    await loadPlaces();
  }, [loadPlaces]);

  const insertPlace = useCallback(async (payload) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) throw new Error('Not signed in');
    const row = {
      user_id: user.id,
      label: payload.label,
      address: payload.address,
      latitude: payload.latitude,
      longitude: payload.longitude,
      kind: payload.kind || 'other',
    };
    const { data, error: insErr } = await supabase.from('saved_places').insert(row).select().single();
    if (insErr) throw insErr;
    await loadPlaces();
    return data;
  }, [loadPlaces]);

  const updatePlace = useCallback(
    async (id, payload) => {
      const allowed = ['label', 'address', 'latitude', 'longitude', 'kind'];
      const updates = { updated_at: new Date().toISOString() };
      for (const k of allowed) {
        if (payload[k] !== undefined) updates[k] = payload[k];
      }
      const { error: upErr } = await supabase.from('saved_places').update(updates).eq('id', id);
      if (upErr) throw upErr;
      await loadPlaces();
    },
    [loadPlaces]
  );

  const deletePlace = useCallback(
    async (id) => {
      const { error: delErr } = await supabase.from('saved_places').delete().eq('id', id);
      if (delErr) throw delErr;
      await loadPlaces();
    },
    [loadPlaces]
  );

  return {
    locale,
    loading,
    error,
    rows,
    refresh,
    insertPlace,
    updatePlace,
    deletePlace,
  };
}
