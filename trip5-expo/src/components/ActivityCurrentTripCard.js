import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import i18n from '../i18n';
import { ios } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../lib/supabase';
import ChatUnreadDot from './ChatUnreadDot';
import {
  formatBookingDate,
  pickupSummary,
  destinationSummary,
  getRouteLabel,
  statusLabel,
  isTerminalStatus,
} from '../utils/bookings';
import { getTripReference, formatTripRefLine } from '../utils/tripReference';

function canRiderCancel(status) {
  const s = String(status || '').toLowerCase();
  return ['pending', 'confirmed', 'driver_en_route', 'in_route'].includes(s);
}

function createActivityCurrentTripCardStyles(colors) {
  return StyleSheet.create({
    activeGradient: {
      borderRadius: ios.radius.xl,
      padding: ios.spacing.lg,
      marginBottom: ios.spacing.sm,
    },
    activeTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: ios.spacing.sm,
    },
    activeLabel: {
      fontSize: ios.fontSize.caption,
      fontWeight: ios.fontWeight.bold,
      color: 'rgba(255,255,255,0.85)',
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    statusPill: {
      backgroundColor: 'rgba(255,255,255,0.22)',
      paddingHorizontal: ios.spacing.sm,
      paddingVertical: 4,
      borderRadius: ios.radius.md,
    },
    statusPillText: {
      fontSize: ios.fontSize.caption,
      fontWeight: ios.fontWeight.semibold,
      color: colors.white,
    },
    activeRoute: {
      fontSize: ios.fontSize.title3,
      fontWeight: ios.fontWeight.bold,
      color: colors.white,
      marginBottom: ios.spacing.xs,
    },
    activeWhen: {
      fontSize: ios.fontSize.footnote,
      color: 'rgba(255,255,255,0.9)',
      marginBottom: ios.spacing.xs,
    },
    activeTripRef: {
      fontSize: ios.fontSize.subhead,
      fontWeight: '800',
      color: 'rgba(255,255,255,0.98)',
      marginBottom: ios.spacing.md,
    },
    activeDetails: {
      backgroundColor: 'rgba(0,0,0,0.15)',
      borderRadius: ios.radius.lg,
      padding: ios.spacing.md,
    },
    activeLine: {
      fontSize: ios.fontSize.footnote,
      color: colors.white,
      marginTop: 4,
      lineHeight: ios.lineHeight.footnote,
    },
    trackCta: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: ios.radius.lg,
      paddingVertical: ios.spacing.md,
      paddingHorizontal: ios.spacing.lg,
      marginBottom: ios.spacing.md,
      gap: ios.spacing.sm,
    },
    trackCtaText: {
      flex: 1,
      fontSize: ios.fontSize.callout,
      fontWeight: ios.fontWeight.semibold,
      color: colors.text,
    },
    dashboardChatCta: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primaryDark,
      borderRadius: ios.radius.lg,
      paddingVertical: ios.spacing.md,
      paddingHorizontal: ios.spacing.lg,
      marginBottom: ios.spacing.md,
      gap: ios.spacing.sm,
    },
    chatIconWrap: {
      position: 'relative',
      width: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chatUnreadDot: { top: -4, right: -8 },
    dashboardChatCtaText: {
      flex: 1,
      fontSize: ios.fontSize.callout,
      fontWeight: ios.fontWeight.semibold,
      color: colors.white,
    },
    cancelBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: ios.spacing.sm,
      paddingVertical: ios.spacing.md,
      marginBottom: ios.spacing.sm,
    },
    cancelBtnText: {
      fontSize: ios.fontSize.callout,
      fontWeight: ios.fontWeight.semibold,
      color: colors.error,
    },
  });
}

export default function ActivityCurrentTripCard({
  order,
  locale,
  navigation,
  activeChatOk,
  activityChatUnread,
  onCancelled,
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createActivityCurrentTripCardStyles(colors), [colors]);
  const [cancelling, setCancelling] = useState(false);

  const openTracking = () => {
    if (order?.id) navigation.navigate('TripTracking', { orderId: order.id });
  };

  const confirmCancel = () => {
    if (!order?.id || cancelling) return;
    Alert.alert(i18n.t('rider_cancel_trip_confirm_title'), i18n.t('rider_cancel_trip_confirm_body'), [
      { text: i18n.t('cancel'), style: 'cancel' },
      {
        text: i18n.t('rider_cancel_trip'),
        style: 'destructive',
        onPress: async () => {
          setCancelling(true);
          try {
            const { error } = await supabase.rpc('cancel_my_trip', { p_order_id: order.id });
            if (error) throw error;
            Alert.alert('', i18n.t('rider_cancel_trip_success'));
            onCancelled?.();
          } catch (e) {
            Alert.alert('', e?.message || i18n.t('rider_cancel_trip_error'));
          } finally {
            setCancelling(false);
          }
        },
      },
    ]);
  };

  const showCancel = order && canRiderCancel(order.status) && !isTerminalStatus(order.status);

  return (
    <View>
      <LinearGradient
        colors={[colors.primary, colors.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.activeGradient}
      >
        <TouchableOpacity activeOpacity={0.92} onPress={openTracking}>
          <View style={styles.activeTop}>
            <Text style={styles.activeLabel}>{i18n.t('dashboard_ongoing_trip')}</Text>
            <View style={styles.statusPill}>
              <Text style={styles.statusPillText}>{statusLabel(order.status)}</Text>
            </View>
          </View>
          <Text style={styles.activeRoute}>{getRouteLabel(order.route)}</Text>
          <Text style={styles.activeWhen}>{formatBookingDate(order.scheduled_at, locale)}</Text>
          {getTripReference(order) ? (
            <Text style={styles.activeTripRef} numberOfLines={1}>
              {formatTripRefLine(i18n, getTripReference(order))}
            </Text>
          ) : null}
          <View style={styles.activeDetails}>
            <Text style={styles.activeLine} numberOfLines={2}>
              {i18n.t('pickup_location')}: {pickupSummary(order.pickup) || '—'}
            </Text>
            <Text style={styles.activeLine} numberOfLines={2}>
              {i18n.t('destination')}:{' '}
              {order.destination?.pending
                ? i18n.t('no_destination_selected')
                : destinationSummary(order.destination) || '—'}
            </Text>
          </View>
        </TouchableOpacity>
      </LinearGradient>

      <TouchableOpacity style={styles.trackCta} onPress={openTracking} activeOpacity={0.85}>
        <Ionicons name="map-outline" size={22} color={colors.primary} />
        <Text style={styles.trackCtaText}>{i18n.t('activity_live_map')}</Text>
        <Ionicons name="chevron-forward" size={20} color={colors.placeholder} />
      </TouchableOpacity>

      {activeChatOk ? (
        <TouchableOpacity style={styles.dashboardChatCta} onPress={openTracking} activeOpacity={0.85}>
          <View style={styles.chatIconWrap}>
            <Ionicons name="chatbubbles-outline" size={22} color={colors.white} />
            {activityChatUnread ? <ChatUnreadDot style={styles.chatUnreadDot} /> : null}
          </View>
          <Text style={styles.dashboardChatCtaText}>{i18n.t('dashboard_message_driver')}</Text>
          <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.85)" />
        </TouchableOpacity>
      ) : null}

      {showCancel ? (
        <TouchableOpacity style={styles.cancelBtn} onPress={confirmCancel} disabled={cancelling}>
          {cancelling ? (
            <ActivityIndicator color={colors.error} />
          ) : (
            <>
              <Ionicons name="close-circle-outline" size={22} color={colors.error} />
              <Text style={styles.cancelBtnText}>{i18n.t('rider_cancel_trip')}</Text>
            </>
          )}
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
