import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

const storageKey = (userId, orderId) => `trip_chat_last_read:${userId}:${orderId}`;

const readListeners = new Set();
function notifyTripChatReadUpdated() {
  readListeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* ignore */
    }
  });
}

export async function markTripChatRead(orderId) {
  if (!orderId) return;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const uid = user?.id;
  if (!uid) return;
  await AsyncStorage.setItem(storageKey(uid, orderId), new Date().toISOString());
  notifyTripChatReadUpdated();
}

export function useTripChatUnread({ order, userId, enabled }) {
  const [hasUnread, setHasUnread] = useState(false);
  const orderId = order?.id;
  const mounted = useRef(true);

  const recompute = useCallback(async () => {
    if (!mounted.current) return;
    if (!enabled || !orderId || !userId) {
      setHasUnread(false);
      return;
    }
    try {
      const lastReadStr = await AsyncStorage.getItem(storageKey(userId, orderId));
      const lastRead = lastReadStr ? new Date(lastReadStr).getTime() : 0;

      const { data: rows, error } = await supabase
        .from('trip_messages')
        .select('created_at')
        .eq('order_id', orderId)
        .neq('sender_id', userId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error || !rows?.length) {
        setHasUnread(false);
        return;
      }
      const latest = new Date(rows[0].created_at).getTime();
      setHasUnread(Number.isFinite(latest) && latest > lastRead);
    } catch {
      setHasUnread(false);
    }
  }, [enabled, orderId, userId]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    recompute();
  }, [recompute]);

  useEffect(() => {
    readListeners.add(recompute);
    return () => {
      readListeners.delete(recompute);
    };
  }, [recompute]);

  useEffect(() => {
    if (!enabled || !orderId) return undefined;

    const ch = supabase
      .channel(`trip-chat-unread:${orderId}:${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'trip_messages',
          filter: `order_id=eq.${orderId}`,
        },
        () => {
          recompute();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [enabled, orderId, recompute]);

  return { hasUnread };
}
