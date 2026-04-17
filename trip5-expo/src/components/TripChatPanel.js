import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import i18n from '../i18n';
import { ios } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { markTripChatRead } from '../hooks/useTripChatUnread';

const SELECT_COLS = 'id, sender_id, kind, message_text, image_url, created_at';

function mergeRow(prev, row) {
  if (!row?.id) return prev;
  const idx = prev.findIndex((r) => r.id === row.id);
  if (idx >= 0) {
    const next = [...prev];
    next[idx] = { ...next[idx], ...row };
    return next.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  }
  return [...prev, row].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}

function createTripChatStyles(colors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.surface },
    rootCompact: { minHeight: 120 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    listContent: { padding: ios.spacing.md, paddingBottom: ios.spacing.sm },
    bubbleRow: { marginBottom: ios.spacing.sm, flexDirection: 'row' },
    bubbleRowMine: { justifyContent: 'flex-end' },
    bubbleRowTheirs: { justifyContent: 'flex-start' },
    bubble: { maxWidth: '82%', borderRadius: ios.radius.lg, paddingHorizontal: ios.spacing.md, paddingVertical: ios.spacing.sm },
    bubbleMine: { backgroundColor: colors.primary },
    bubbleTheirs: { backgroundColor: colors.metallic },
    bubbleText: { fontSize: ios.fontSize.body, color: colors.text, lineHeight: ios.lineHeight.body },
    bubbleTextMine: { color: colors.white },
    closed: {
      textAlign: 'center',
      padding: ios.spacing.md,
      color: colors.textMuted,
      fontSize: ios.fontSize.footnote,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      padding: ios.spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      gap: ios.spacing.sm,
    },
    input: {
      flex: 1,
      minHeight: 40,
      maxHeight: 100,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: ios.radius.md,
      paddingHorizontal: ios.spacing.md,
      paddingVertical: ios.spacing.sm,
      fontSize: ios.fontSize.body,
      color: colors.text,
      backgroundColor: colors.background,
    },
    sendBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendBtnDisabled: { opacity: 0.5 },
  });
}

export default function TripChatPanel({ orderId, userId, chatClosed, compact }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createTripChatStyles(colors), [colors]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

  const load = useCallback(async () => {
    if (!orderId) {
      setRows([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('trip_messages')
      .select(SELECT_COLS)
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });
    if (!error && data) setRows(data);
    setLoading(false);
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!orderId || !userId || chatClosed) return undefined;
    markTripChatRead(orderId).catch(() => {});
    return undefined;
  }, [orderId, userId, chatClosed]);

  useEffect(() => {
    if (!orderId) return undefined;
    const ch = supabase
      .channel(`trip-messages:${orderId}:${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'trip_messages',
          filter: `order_id=eq.${orderId}`,
        },
        (payload) => {
          if (payload.new) {
            setRows((prev) => mergeRow(prev, payload.new));
            setTimeout(() => listRef.current?.scrollToEnd?.({ animated: true }), 80);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          load();
        }
      });
    return () => {
      supabase.removeChannel(ch);
    };
  }, [orderId, load]);

  const send = async () => {
    const t = text.trim();
    if (!t || !orderId || !userId || chatClosed || sending) return;
    setSending(true);
    const { data, error } = await supabase
      .from('trip_messages')
      .insert({
        order_id: orderId,
        sender_id: userId,
        kind: 'text',
        message_text: t,
        image_url: null,
      })
      .select(SELECT_COLS)
      .single();
    setSending(false);
    if (error) {
      return;
    }
    if (data) {
      setRows((prev) => mergeRow(prev, data));
      setText('');
      Keyboard.dismiss();
      setTimeout(() => listRef.current?.scrollToEnd?.({ animated: true }), 100);
    }
  };

  const renderItem = ({ item }) => {
    const mine = item.sender_id === userId;
    const isImage = item.kind === 'image' && item.image_url;
    return (
      <View style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
        <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
          {isImage ? (
            <Text style={styles.bubbleText}>{i18n.t('trip_chat_image_placeholder')}</Text>
          ) : (
            <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{item.message_text || ''}</Text>
          )}
        </View>
      </View>
    );
  };

  if (!orderId) return null;

  return (
    <KeyboardAvoidingView
      style={[styles.root, compact && styles.rootCompact]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
    >
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={rows}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={() => listRef.current?.scrollToEnd?.({ animated: false })}
        />
      )}
      {chatClosed ? (
        <Text style={styles.closed}>{i18n.t('trip_chat_closed')}</Text>
      ) : (
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder={i18n.t('trip_chat_placeholder')}
            placeholderTextColor={colors.placeholder}
            editable={!chatClosed && !!userId}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!text.trim() || sending || chatClosed) && styles.sendBtnDisabled]}
            onPress={send}
            disabled={!text.trim() || sending || chatClosed}
          >
            {sending ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <Ionicons name="send" size={22} color={colors.white} />
            )}
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
