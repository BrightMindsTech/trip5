import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

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

  const loadProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null);
      return;
    }
    setProfileLoading(true);
    try {
      const { data, error } = await supabase.from('profiles').select('full_name, phone').eq('id', userId).maybeSingle();
      if (error) {
        console.warn('Profile load:', error.message);
        setProfile({ full_name: '', phone: '' });
        return;
      }
      setProfile(data || { full_name: '', phone: '' });
    } finally {
      setProfileLoading(false);
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

  const signIn = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw error;
    return data;
  }, []);

  const signUp = useCallback(async (email, password, fullName, phone) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          phone: phone.trim(),
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
    const { error } = await supabase.from('profiles').upsert({
      id: u.user.id,
      full_name: updates.full_name,
      phone: updates.phone,
      updated_at: new Date().toISOString(),
    });
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
    accessToken: session?.access_token ?? null,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
