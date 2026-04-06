import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  normalizeJordanPhoneToDigits,
  phoneToSyntheticEmail,
  formatJordanPhoneDisplay,
} from '../utils/phoneAuth';

const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  const loadProfile = useCallback(async (userId, options = {}) => {
    const silent = options.silent === true;
    if (!userId) {
      setProfile(null);
      return;
    }
    if (!silent) setProfileLoading(true);
    try {
      let { data, error } = await supabase
        .from('profiles')
        .select('full_name, phone, is_driver, driver_score, driver_subscription_valid_until')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        const retry = await supabase.from('profiles').select('full_name, phone, is_driver').eq('id', userId).maybeSingle();
        if (!retry.error) {
          data = { ...retry.data, driver_score: null, driver_subscription_valid_until: null };
          error = null;
        } else {
          const retry2 = await supabase.from('profiles').select('full_name, phone').eq('id', userId).maybeSingle();
          if (!retry2.error) {
            data = { ...retry2.data, is_driver: false, driver_score: null, driver_subscription_valid_until: null };
            error = null;
          } else {
            error = retry2.error;
          }
        }
      }

      if (error) {
        console.warn('Profile load:', error.message);
        setProfile({ full_name: '', phone: '', is_driver: false, driver_score: null, driver_subscription_valid_until: null });
        return;
      }
      const row = data || {
        full_name: '',
        phone: '',
        is_driver: false,
        driver_score: null,
        driver_subscription_valid_until: null,
      };
      setProfile({
        ...row,
        is_driver: row.is_driver === true,
        driver_score: row.driver_score != null ? Number(row.driver_score) : null,
        driver_subscription_valid_until: row.driver_subscription_valid_until ?? null,
      });
    } finally {
      if (!silent) setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s?.user?.id) loadProfile(s.user.id);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.user?.id) loadProfile(s.user.id);
      else setProfile(null);
    });

    return () => subscription.unsubscribe();
  }, [loadProfile]);

  const signIn = useCallback(async (phone, password) => {
    const digits = normalizeJordanPhoneToDigits(phone);
    const email = phoneToSyntheticEmail(digits);
    if (!email) throw new Error('Invalid phone');
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }, []);

  const signUp = useCallback(async (phone, password, fullName) => {
    const digits = normalizeJordanPhoneToDigits(phone);
    const email = phoneToSyntheticEmail(digits);
    if (!email) throw new Error('Invalid phone');
    const displayPhone = formatJordanPhoneDisplay(digits);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          phone: displayPhone,
        },
      },
    });
    if (error) throw error;
    return data;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  const updateProfile = useCallback(async (updates) => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw new Error('Not signed in');
    // Upsert so a missing profiles row (trigger failure, etc.) is created; on conflict only these columns change, so is_driver is preserved.
    const { error } = await supabase.from('profiles').upsert(
      {
        id: u.user.id,
        full_name: updates.full_name,
        phone: updates.phone,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
    if (error) throw error;
    await loadProfile(u.user.id);
  }, [loadProfile]);

  const needsProfile = Boolean(
    session?.user &&
      profile &&
      (!(String(profile.phone || '').trim()) || !(String(profile.full_name || '').trim()))
  );

  const value = {
    session,
    profile,
    loading,
    profileLoading,
    signIn,
    signUp,
    signOut,
    updateProfile,
    loadProfile,
    needsProfile,
    isDriver: profile?.is_driver === true,
    accessToken: session?.access_token ?? null,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
