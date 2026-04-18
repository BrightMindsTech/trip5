import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import i18n from '../i18n';
import { ios } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { useDriverJobs } from '../context/DriverOrdersContext';

function formatSyncTime(ts) {
  if (ts == null || !Number.isFinite(ts)) return null;
  try {
    return new Date(ts).toLocaleTimeString(i18n.locale === 'ar' ? 'ar-JO' : undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return new Date(ts).toLocaleTimeString();
  }
}

/**
 * Driver-orders errors, subscription notice, and a **persistent** status line so a working API
 * does not look like “nothing” when no offer exists yet.
 */
export default function DriverShellAlerts() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { jobsError, subscriptionOk, refresh, lastJobsSyncAt, jobsEndpointInfo, incomingOffer } = useDriverJobs();

  const syncLabel = formatSyncTime(lastJobsSyncAt);
  const endpointKind = jobsEndpointInfo?.kind;
  const endpointLine = jobsEndpointInfo?.label || '';

  const statusAccent = useMemo(() => {
    if (endpointKind === 'misconfigured') return colors.error;
    if (jobsError) return colors.error;
    if (lastJobsSyncAt) return '#16A34A';
    return colors.placeholder;
  }, [colors, endpointKind, jobsError, lastJobsSyncAt]);

  return (
    <View style={[styles.wrap, { paddingTop: Math.max(insets.top, 8), backgroundColor: colors.background }]}>
      {jobsError ? (
        <View style={[styles.row, styles.errorRow, { backgroundColor: colors.primaryLight, borderColor: colors.border }]}>
          <Ionicons name="warning-outline" size={18} color={colors.error} style={styles.errorIcon} />
          <ScrollView
            style={styles.errorScroll}
            contentContainerStyle={styles.errorScrollContent}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={jobsError.length > 280}
          >
            <Text style={[styles.text, { color: colors.text }]} selectable>
              {jobsError}
            </Text>
          </ScrollView>
          <TouchableOpacity onPress={() => refresh()} style={[styles.retry, { backgroundColor: colors.primary }]} hitSlop={8}>
            <Text style={[styles.retryText, { color: colors.white }]}>{i18n.t('driver_retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {!subscriptionOk && !jobsError ? (
        <View style={[styles.row, { backgroundColor: colors.primaryLight, borderColor: colors.border }]}>
          <Ionicons name="information-circle" size={18} color={colors.primaryDark} style={styles.icon} />
          <Text style={[styles.text, { color: colors.text, flex: 1 }]}>{i18n.t('driver_jobs_sub_banner')}</Text>
        </View>
      ) : null}

      <View style={[styles.statusCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        <View style={styles.statusTop}>
          <View style={[styles.dot, { backgroundColor: statusAccent }]} />
          <Text style={[styles.statusTitle, { color: colors.text }]}>{i18n.t('driver_jobs_feed_status')}</Text>
          {incomingOffer ? (
            <View style={styles.offerPill}>
              <Text style={[styles.offerPillText, { color: colors.primaryDark }]}>{i18n.t('driver_jobs_offer_incoming')}</Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.syncLine, { color: colors.textSecondary }]}>
          {syncLabel ? i18n.t('driver_jobs_last_ok', { time: syncLabel }) : i18n.t('driver_jobs_no_sync_yet')}
        </Text>
        <Text
          style={[
            styles.apiLine,
            { color: colors.placeholder, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
          ]}
          selectable
          numberOfLines={3}
        >
          {endpointLine}
        </Text>
        <Text style={[styles.hintLine, { color: colors.textSecondary }]}>{i18n.t('driver_jobs_queue_hint')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: ios.spacing.md,
    marginBottom: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: ios.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  icon: { marginRight: 8 },
  errorRow: { alignItems: 'flex-start' },
  errorIcon: { marginRight: 8, marginTop: 2 },
  errorScroll: { flex: 1, maxHeight: 200 },
  errorScrollContent: { flexGrow: 1, paddingRight: 4 },
  text: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  retry: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: ios.radius.sm, flexShrink: 0 },
  retryText: { fontWeight: '800', fontSize: 13 },
  statusCard: {
    marginHorizontal: ios.spacing.md,
    marginBottom: 10,
    padding: 12,
    borderRadius: ios.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  statusTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  statusTitle: { flex: 1, fontSize: 13, fontWeight: '800' },
  offerPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
  },
  offerPillText: { fontSize: 11, fontWeight: '800' },
  syncLine: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  apiLine: { fontSize: 10, lineHeight: 14, marginBottom: 6 },
  hintLine: { fontSize: 11, lineHeight: 16, fontWeight: '500' },
});
