import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import i18n, { initI18n } from '../i18n';
import { ios } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { getDriverOrders, postDriverOrderAction } from '../api';
import {
  getRouteLabel,
  statusLabel,
  pickupSummary,
  destinationSummary,
  formatBookingDate,
} from '../utils/bookings';

function nextActionForStatus(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'confirmed') return { labelKey: 'driver_start_driving', next: 'driver_en_route' };
  if (s === 'driver_en_route') return { labelKey: 'driver_passenger_on_board', next: 'in_route' };
  if (s === 'in_route') return { labelKey: 'driver_complete_trip', next: 'completed' };
  return null;
}

function createStyles(colors) {
  return StyleSheet.create({
    wrap: {
      marginHorizontal: ios.spacing.lg,
      marginTop: 4,
      marginBottom: 4,
    },
    sectionHead: { marginBottom: ios.spacing.sm },
    sectionTitle: {
      fontSize: ios.fontSize.title3,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.2,
    },
    sectionSub: {
      fontSize: ios.fontSize.footnote,
      color: colors.placeholder,
      marginTop: 4,
      fontWeight: '500',
      lineHeight: 18,
    },
    center: { paddingVertical: ios.spacing.lg, alignItems: 'center' },
    empty: { fontSize: ios.fontSize.subhead, color: colors.placeholder, lineHeight: 22 },
    card: {
      backgroundColor: colors.surface,
      borderRadius: ios.radius.lg,
      padding: ios.spacing.md,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    routeText: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.text },
    badge: {
      backgroundColor: colors.background,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
    },
    badgeText: { fontSize: 11, fontWeight: '700', color: colors.primary },
    whenText: { fontSize: 13, color: colors.textSecondary, marginTop: 6 },
    rowText: { fontSize: 14, color: colors.text, marginTop: 8 },
    rowLabel: { fontWeight: '700', color: colors.textSecondary },
    addrText: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
    primaryBtn: {
      marginTop: 14,
      backgroundColor: colors.primary,
      paddingVertical: 12,
      borderRadius: ios.radius.md,
      alignItems: 'center',
    },
    primaryBtnText: { color: colors.white, fontWeight: '700', fontSize: 15 },
    btnDisabled: { opacity: 0.6 },
  });
}

/**
 * Lists the driver’s active assignments (same `mine` payload as Jobs). Refreshes on screen focus.
 * @param {{ onAssignmentsChanged?: () => void }} props — e.g. refresh dashboard stats after a trip completes.
 */
export default function DriverActiveOrdersBlock({ onAssignmentsChanged }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { accessToken } = useAuth();
  const [mine, setMine] = useState([]);
  const [sectionLoading, setSectionLoading] = useState(true);
  const [actingId, setActingId] = useState(null);
  const [locale, setLocale] = useState(i18n.locale);
  const loadGen = useRef(0);
  const firstLoad = useRef(true);

  const loadMine = useCallback(async () => {
    const myGen = ++loadGen.current;
    const showSpinner = firstLoad.current;
    if (showSpinner) setSectionLoading(true);

    let token = accessToken;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      token = sessionData?.session?.access_token ?? accessToken ?? null;
    } catch {
      token = accessToken ?? null;
    }

    if (!token) {
      if (myGen !== loadGen.current) return;
      setMine([]);
      firstLoad.current = false;
      setSectionLoading(false);
      return;
    }

    try {
      const data = await getDriverOrders(token);
      if (myGen !== loadGen.current) return;
      setMine(data.mine || []);
    } catch {
      if (myGen !== loadGen.current) return;
      setMine([]);
    } finally {
      if (myGen === loadGen.current) {
        firstLoad.current = false;
        setSectionLoading(false);
      }
    }
  }, [accessToken]);

  useFocusEffect(
    useCallback(() => {
      loadMine();
    }, [loadMine])
  );

  useEffect(() => {
    let c = false;
    initI18n()
      .then((lang) => {
        if (!c) setLocale(lang);
      })
      .catch(() => {
        if (!c) setLocale('ar');
      });
    return () => {
      c = true;
    };
  }, []);

  const onSetStatus = async (orderId, status) => {
    let token = accessToken;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      token = sessionData?.session?.access_token ?? accessToken ?? null;
    } catch {
      token = accessToken ?? null;
    }
    if (!token) return;

    setActingId(orderId);
    try {
      await postDriverOrderAction(token, { orderId, action: 'set_status', status });
      await loadMine();
      if (status === 'completed') onAssignmentsChanged?.();
    } catch (e) {
      Alert.alert('', e?.message || 'Failed');
    } finally {
      setActingId(null);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{i18n.t('driver_dashboard_active_rides')}</Text>
        <Text style={styles.sectionSub}>{i18n.t('driver_dashboard_active_rides_sub')}</Text>
      </View>
      {sectionLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : mine.length === 0 ? (
        <Text style={styles.empty}>{i18n.t('driver_no_mine')}</Text>
      ) : (
        mine.map((item) => {
          const routeText = getRouteLabel(item.route);
          const when = formatBookingDate(item.scheduled_at, locale);
          const pickup = pickupSummary(item.pickup);
          const dest = destinationSummary(item.destination);
          const passName = item.passenger_name || '—';
          const passPhone = item.passenger_phone || '';
          const st = item.status;
          const nextAct = nextActionForStatus(st);

          return (
            <View key={item.id} style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.routeText}>{routeText}</Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{statusLabel(st)}</Text>
                </View>
              </View>
              <Text style={styles.whenText}>
                {i18n.t('driver_scheduled')}: {when}
              </Text>
              <Text style={styles.rowText} numberOfLines={2}>
                <Text style={styles.rowLabel}>{i18n.t('driver_passenger')}: </Text>
                {passName}
                {passPhone ? ` · ${passPhone}` : ''}
              </Text>
              {pickup ? (
                <Text style={styles.addrText} numberOfLines={2}>
                  ↑ {pickup}
                </Text>
              ) : null}
              {dest ? (
                <Text style={styles.addrText} numberOfLines={2}>
                  ↓ {dest}
                </Text>
              ) : null}
              {nextAct ? (
                <TouchableOpacity
                  style={[styles.primaryBtn, actingId === item.id && styles.btnDisabled]}
                  onPress={() => onSetStatus(item.id, nextAct.next)}
                  disabled={!!actingId}
                >
                  {actingId === item.id ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <Text style={styles.primaryBtnText}>{i18n.t(nextAct.labelKey)}</Text>
                  )}
                </TouchableOpacity>
              ) : null}
            </View>
          );
        })
      )}
    </View>
  );
}
