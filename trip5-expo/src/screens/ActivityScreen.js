import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import i18n, { initI18n } from '../i18n';
import { colors, ios } from '../theme';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useUserOrders } from '../hooks/useUserOrders';
import {
  partitionBookings,
  formatBookingDate,
  pickupSummary,
  destinationSummary,
  isTerminalStatus,
  getRouteLabel,
  statusLabel,
} from '../utils/bookings';

export default function ActivityScreen() {
  const navigation = useNavigation();
  const { loading, error, rows, refreshing, onRefresh } = useUserOrders();
  const [localeState, setLocaleState] = useState(i18n.locale);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      initI18n()
        .then((lang) => {
          if (!cancelled) setLocaleState(lang);
        })
        .catch(() => {
          if (!cancelled) setLocaleState('ar');
        });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const { active, history } = partitionBookings(rows);
  const now = new Date();
  const activeInRoute = String(active?.status || '').toLowerCase() === 'in_route';

  const renderHistoryRow = (item) => {
    const scheduled = new Date(item.scheduled_at);
    const isFuture = scheduled.getTime() >= now.getTime() && !isTerminalStatus(item.status);
    return (
      <View key={item.id} style={styles.historyCard}>
        <View style={styles.historyRowTop}>
          <Text style={styles.historyRoute} numberOfLines={2}>
            {getRouteLabel(item.route)}
          </Text>
          {isFuture ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{i18n.t('dashboard_upcoming_badge')}</Text>
            </View>
          ) : (
            <Text style={styles.historyStatus}>{statusLabel(item.status)}</Text>
          )}
        </View>
        <Text style={styles.historyWhen}>{formatBookingDate(item.scheduled_at, i18n.locale)}</Text>
        <Text style={styles.historyLine} numberOfLines={1}>
          {i18n.t('pickup_location')}: {pickupSummary(item.pickup) || '—'}
        </Text>
        <Text style={styles.historyLine} numberOfLines={1}>
          {i18n.t('destination')}:{' '}
          {item.destination?.pending ? i18n.t('no_destination_selected') : destinationSummary(item.destination) || '—'}
        </Text>
      </View>
    );
  };

  const header = (
    <View style={[styles.headerWrapper, Platform.OS !== 'ios' && styles.headerWrapperAndroid]}>
      {Platform.OS === 'ios' ? (
        <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
      ) : null}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{i18n.t('activity_title')}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.safe}>
      <SafeAreaView style={styles.safeInner} edges={['top', 'left', 'right']}>
        {header}
        <ScrollView
          key={localeState}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          keyboardShouldPersistTaps="handled"
        >
          {loading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.muted}>{i18n.t('dashboard_loading')}</Text>
            </View>
          ) : error ? (
            <View style={styles.centerBox}>
              <Text style={styles.errorText}>{i18n.t('dashboard_error')}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={onRefresh}>
                <Text style={styles.retryBtnText}>{i18n.t('dashboard_retry')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {active ? (
                <>
                  <Text style={styles.sectionLabel}>{i18n.t('activity_active_section')}</Text>
                  <View style={styles.activeCard}>
                    <View style={styles.historyRowTop}>
                      <Text style={styles.historyRoute} numberOfLines={2}>
                        {getRouteLabel(active.route)}
                      </Text>
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{statusLabel(active.status)}</Text>
                      </View>
                    </View>
                    <Text style={styles.historyWhen}>{formatBookingDate(active.scheduled_at, i18n.locale)}</Text>
                    <Text style={styles.historyLine} numberOfLines={1}>
                      {i18n.t('pickup_location')}: {pickupSummary(active.pickup) || '—'}
                    </Text>
                    <Text style={styles.historyLine} numberOfLines={1}>
                      {i18n.t('destination')}:{' '}
                      {active.destination?.pending
                        ? i18n.t('no_destination_selected')
                        : destinationSummary(active.destination) || '—'}
                    </Text>
                    {activeInRoute ? (
                      <TouchableOpacity
                        style={styles.trackBtn}
                        onPress={() => navigation.navigate('TripTracking', { orderId: active.id })}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                        accessibilityLabel={i18n.t('dashboard_in_route_banner_title')}
                      >
                        <Ionicons name="navigate" size={20} color={colors.white} />
                        <Text style={styles.trackBtnText}>{i18n.t('dashboard_in_route_banner_title')}</Text>
                        <Ionicons name="chevron-forward" size={20} color={colors.white} />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </>
              ) : null}

              <Text style={styles.sectionLabel}>{i18n.t('dashboard_history_section')}</Text>
              {history.length === 0 ? (
                !active ? (
                  <View style={styles.emptyWrap}>
                    <Ionicons name="receipt-outline" size={48} color={colors.border} />
                    <Text style={styles.emptyHint}>{i18n.t('dashboard_no_history')}</Text>
                  </View>
                ) : (
                  <Text style={styles.mutedHistoryEmpty}>{i18n.t('activity_no_past_trips')}</Text>
                )
              ) : (
                history.map(renderHistoryRow)
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  safeInner: { flex: 1 },
  headerWrapper: {
    position: 'relative',
    overflow: 'hidden',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerWrapperAndroid: {
    backgroundColor: colors.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: ios.spacing.lg,
    paddingVertical: ios.spacing.md,
    minHeight: 44,
  },
  headerTitle: {
    fontSize: ios.fontSize.title3,
    fontWeight: ios.fontWeight.bold,
    color: colors.text,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: ios.spacing.lg,
    paddingBottom: ios.spacing.xxl + 24,
  },
  sectionLabel: {
    fontSize: ios.fontSize.subhead,
    fontWeight: ios.fontWeight.semibold,
    color: colors.text,
    marginBottom: ios.spacing.sm,
    marginTop: ios.spacing.sm,
  },
  centerBox: {
    paddingVertical: ios.spacing.lg,
    alignItems: 'center',
  },
  muted: {
    marginTop: ios.spacing.sm,
    fontSize: ios.fontSize.footnote,
    color: colors.textSecondary,
  },
  errorText: {
    fontSize: ios.fontSize.footnote,
    color: colors.error,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: ios.spacing.md,
    paddingVertical: ios.spacing.sm,
    paddingHorizontal: ios.spacing.lg,
    backgroundColor: colors.primaryLight,
    borderRadius: ios.radius.md,
  },
  retryBtnText: {
    color: colors.primaryDark,
    fontWeight: ios.fontWeight.semibold,
    fontSize: ios.fontSize.subhead,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: ios.spacing.xxl,
    gap: ios.spacing.md,
  },
  emptyHint: {
    fontSize: ios.fontSize.footnote,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  historyCard: {
    backgroundColor: colors.surface,
    borderRadius: ios.radius.md,
    padding: ios.spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginBottom: ios.spacing.sm,
  },
  historyRowTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: ios.spacing.sm,
  },
  historyRoute: {
    flex: 1,
    fontSize: ios.fontSize.subhead,
    fontWeight: ios.fontWeight.medium,
    color: colors.text,
  },
  historyStatus: {
    fontSize: ios.fontSize.caption,
    color: colors.textSecondary,
    fontWeight: ios.fontWeight.medium,
  },
  historyWhen: {
    fontSize: ios.fontSize.caption,
    color: colors.textSecondary,
    marginTop: 4,
    marginBottom: ios.spacing.xs,
  },
  historyLine: {
    fontSize: ios.fontSize.caption,
    color: colors.text,
  },
  badge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: ios.spacing.sm,
    paddingVertical: 4,
    borderRadius: ios.radius.sm,
  },
  badgeText: {
    fontSize: ios.fontSize.caption,
    fontWeight: ios.fontWeight.semibold,
    color: colors.primaryDark,
  },
  activeCard: {
    backgroundColor: colors.surface,
    borderRadius: ios.radius.md,
    padding: ios.spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primary,
    marginBottom: ios.spacing.lg,
  },
  trackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: ios.spacing.sm,
    marginTop: ios.spacing.md,
    paddingVertical: ios.spacing.sm,
    paddingHorizontal: ios.spacing.md,
    backgroundColor: colors.primary,
    borderRadius: ios.radius.md,
  },
  trackBtnText: {
    flex: 1,
    fontSize: ios.fontSize.subhead,
    fontWeight: ios.fontWeight.semibold,
    color: colors.white,
    textAlign: 'center',
  },
  mutedHistoryEmpty: {
    fontSize: ios.fontSize.footnote,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: ios.spacing.md,
  },
});
