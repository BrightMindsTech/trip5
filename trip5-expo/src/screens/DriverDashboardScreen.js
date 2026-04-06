import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Platform,
  TouchableOpacity,
  Linking,
  I18nManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import i18n, { initI18n } from '../i18n';
import { colors, ios } from '../theme';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Config } from '../config';
import { isDriverSubscriptionActive } from '../utils/driverSubscription';
import { getRouteLabel, statusLabel, pickupSummary, destinationSummary, formatBookingDate } from '../utils/bookings';
import { useFocusEffect } from '@react-navigation/native';

const ACCENT_DONE = '#22C55E';
const ACCENT_CANCEL = '#94A3B8';

function getFirstName(fullName) {
  const s = String(fullName || '').trim();
  if (!s) return '';
  return s.split(/\s+/)[0];
}

function greetingKey() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'driver_greeting_morning';
  if (h >= 12 && h < 18) return 'driver_greeting_afternoon';
  return 'driver_greeting_evening';
}

function formatSubUntil(iso, locale) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleString(locale === 'ar' ? 'ar-JO' : 'en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return String(iso);
  }
}

const cardShadow =
  Platform.OS === 'ios'
    ? {
        shadowColor: '#1E1B4B',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      }
    : { elevation: 3 };

export default function DriverDashboardScreen() {
  const { session, profile, loadProfile } = useAuth();
  const userId = session?.user?.id;
  const [locale, setLocale] = useState(i18n.locale);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pastRides, setPastRides] = useState([]);
  const [loadErr, setLoadErr] = useState(null);

  const subActive = isDriverSubscriptionActive(profile?.driver_subscription_valid_until);
  const score = profile?.driver_score != null && !Number.isNaN(Number(profile.driver_score)) ? Number(profile.driver_score) : null;
  const firstName = useMemo(() => getFirstName(profile?.full_name), [profile?.full_name]);
  const greeting = useMemo(() => i18n.t(greetingKey()), [locale]);

  const contactDigits = String(Config.driverRegistrationPhone || '').replace(/\D/g, '');

  const openWhatsAppSubscribe = useCallback(() => {
    const text = encodeURIComponent(i18n.t('driver_subscription_wa_prefill'));
    Linking.openURL(`https://wa.me/${contactDigits}?text=${text}`).catch(() => {});
  }, [contactDigits]);

  const loadPastRides = useCallback(async () => {
    if (!userId) {
      setPastRides([]);
      return;
    }
    setLoadErr(null);
    const { data, error } = await supabase
      .from('orders')
      .select('id, route, scheduled_at, status, created_at, pickup, destination, passenger_name')
      .eq('driver_id', userId)
      .in('status', ['completed', 'cancelled'])
      .order('created_at', { ascending: false })
      .limit(40);

    if (error) {
      setLoadErr(error.message);
      setPastRides([]);
      return;
    }
    setPastRides(data || []);
  }, [userId]);

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
      return () => {
        cancelled = true;
      };
    }, [])
  );

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    loadPastRides().finally(() => setLoading(false));
  }, [userId, loadPastRides]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (userId) await loadProfile(userId, { silent: true });
    await loadPastRides();
    setRefreshing(false);
  }, [userId, loadProfile, loadPastRides]);

  const completedCount = pastRides.filter((r) => String(r.status).toLowerCase() === 'completed').length;

  const header = (
    <View style={[styles.headerWrapper, Platform.OS !== 'ios' && styles.headerWrapperAndroid]}>
      {Platform.OS === 'ios' ? <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} /> : null}
      <View style={styles.headerInner}>
        <Text style={styles.headerTitle}>{i18n.t('driver_dashboard_title')}</Text>
      </View>
    </View>
  );

  const welcomeLine = firstName
    ? `${greeting}, ${firstName}`
    : greeting;

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        {header}
        <View style={styles.centered} accessibilityState={{ busy: true }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingHint}>{i18n.t('driver_dashboard_loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {header}
      <ScrollView
        key={locale}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={['#EDE9FE', '#FAF5FF', colors.background]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <Text style={styles.heroGreeting} accessibilityRole="header">
            {welcomeLine}
          </Text>
          <Text style={styles.heroSub}>{i18n.t('driver_dashboard_welcome_sub')}</Text>
        </LinearGradient>

        <View style={styles.statsRow}>
          <View
            style={[styles.statCard, styles.statCardFirst, cardShadow]}
            accessibilityLabel={`${i18n.t('driver_score_label')}: ${score != null ? score.toFixed(1) : '—'}`}
          >
            <View style={styles.statIconCircle}>
              <Ionicons name="star" size={24} color={colors.primaryDark} />
            </View>
            <Text style={styles.statValue}>{score != null ? score.toFixed(1) : '—'}</Text>
            <Text style={styles.statLabel}>{i18n.t('driver_score_label')}</Text>
            <Text style={styles.statHint}>{i18n.t('driver_score_out_of')}</Text>
          </View>
          <View
            style={[styles.statCard, cardShadow]}
            accessibilityLabel={`${i18n.t('driver_trips_completed')}: ${completedCount}`}
          >
            <View style={styles.statIconCircle}>
              <Ionicons name="ribbon-outline" size={24} color={colors.primaryDark} />
            </View>
            <Text style={styles.statValue}>{completedCount}</Text>
            <Text style={styles.statLabel}>{i18n.t('driver_trips_completed')}</Text>
            <Text style={styles.statHint}>{i18n.t('driver_trips_completed_hint')}</Text>
          </View>
        </View>

        <View
          style={[
            styles.subCard,
            cardShadow,
            subActive ? styles.subCardOk : styles.subCardWarn,
          ]}
        >
          <View style={styles.subHeaderRow}>
            <View style={[styles.subBadge, subActive ? styles.subBadgeOk : styles.subBadgeWarn]}>
              <Ionicons
                name={subActive ? 'checkmark-circle' : 'alert-circle'}
                size={18}
                color={subActive ? ACCENT_DONE : colors.error}
              />
              <Text style={[styles.subBadgeText, subActive ? styles.subBadgeTextOk : styles.subBadgeTextWarn]}>
                {subActive ? i18n.t('driver_subscription_active_title') : i18n.t('driver_subscription_expired_title')}
              </Text>
            </View>
            <Text style={styles.subCardTitle}>{i18n.t('driver_subscription_title')}</Text>
          </View>
          <Text style={styles.subPrice}>{i18n.t('driver_subscription_price')}</Text>
          <Text style={styles.subStatus}>
            {subActive ? i18n.t('driver_subscription_active') : i18n.t('driver_subscription_expired')}
          </Text>
          {subActive && profile?.driver_subscription_valid_until ? (
            <View style={styles.subUntilRow}>
              <Ionicons name="calendar-outline" size={16} color={colors.primaryDark} style={styles.subUntilIcon} />
              <Text style={styles.subUntil}>
                {i18n.t('driver_subscription_expires')}: {formatSubUntil(profile.driver_subscription_valid_until, locale)}
              </Text>
            </View>
          ) : null}
          {!subActive ? (
            <TouchableOpacity
              style={styles.subCta}
              onPress={openWhatsAppSubscribe}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={i18n.t('driver_subscription_cta')}
            >
              <Ionicons name="logo-whatsapp" size={22} color={colors.white} style={styles.subCtaIcon} />
              <Text style={styles.subCtaText}>{i18n.t('driver_subscription_cta')}</Text>
              <Ionicons
                name={I18nManager.isRTL ? 'chevron-back' : 'chevron-forward'}
                size={18}
                color="rgba(255,255,255,0.9)"
              />
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.sectionHead}>
          <View style={styles.sectionHeadText}>
            <Text style={styles.sectionHeading}>{i18n.t('driver_past_rides')}</Text>
            <Text style={styles.sectionSub}>{i18n.t('driver_past_rides_sub')}</Text>
          </View>
        </View>

        {loadErr ? (
          <View style={[styles.errorCard, cardShadow]}>
            <Ionicons name="cloud-offline-outline" size={32} color={colors.error} />
            <Text style={styles.errorTitle}>{loadErr}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={loadPastRides} accessibilityRole="button">
              <Text style={styles.retryBtnText}>{i18n.t('driver_past_rides_retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : pastRides.length === 0 ? (
          <View style={[styles.emptyCard, cardShadow]} accessibilityRole="text">
            <View style={styles.emptyIconWrap}>
              <Ionicons name="car-outline" size={40} color={colors.placeholder} />
            </View>
            <Text style={styles.emptyTitle}>{i18n.t('driver_no_past_rides_title')}</Text>
            <Text style={styles.emptyBody}>{i18n.t('driver_no_past_rides')}</Text>
          </View>
        ) : (
          pastRides.map((item) => {
            const routeText = getRouteLabel(item.route);
            const when = formatBookingDate(item.scheduled_at, locale);
            const pickup = pickupSummary(item.pickup);
            const dest = destinationSummary(item.destination);
            const done = String(item.status).toLowerCase() === 'completed';
            const borderColor = done ? ACCENT_DONE : ACCENT_CANCEL;
            return (
              <View
                key={item.id}
                style={[styles.rideCard, cardShadow, { borderLeftColor: borderColor }]}
                accessibilityLabel={`${routeText}. ${statusLabel(item.status)}. ${when}`}
              >
                <View style={styles.rideTop}>
                  <Text style={styles.rideRoute} numberOfLines={2}>
                    {routeText}
                  </Text>
                  <View style={[styles.statusPill, done ? styles.statusPillDone : styles.statusPillCancelled]}>
                    <Text style={[styles.statusPillText, done ? styles.statusPillTextDone : styles.statusPillTextCancelled]}>
                      {statusLabel(item.status)}
                    </Text>
                  </View>
                </View>
                <View style={styles.whenRow}>
                  <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
                  <Text style={styles.rideWhen}>{when}</Text>
                </View>
                {pickup ? (
                  <View style={styles.addrRow}>
                    <View style={styles.addrDot} />
                    <Text style={styles.rideAddr} numberOfLines={2}>
                      {pickup}
                    </Text>
                  </View>
                ) : null}
                {dest ? (
                  <View style={styles.addrRow}>
                    <View style={[styles.addrDot, styles.addrDotDest]} />
                    <Text style={styles.rideAddr} numberOfLines={2}>
                      {dest}
                    </Text>
                  </View>
                ) : null}
              </View>
            );
          })
        )}

        <Text style={styles.footerHint}>{i18n.t('driver_pull_refresh_hint')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  headerWrapper: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    overflow: 'hidden',
  },
  headerWrapperAndroid: { backgroundColor: colors.surface },
  headerInner: {
    paddingHorizontal: ios.spacing.lg,
    paddingVertical: ios.spacing.md,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: ios.fontSize.title2,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
  },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  loadingHint: {
    marginTop: 16,
    fontSize: ios.fontSize.subhead,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  scrollContent: { paddingBottom: 48 },
  hero: {
    marginHorizontal: ios.spacing.lg,
    marginTop: 4,
    marginBottom: 8,
    paddingHorizontal: ios.spacing.lg,
    paddingVertical: ios.spacing.xl,
    borderRadius: ios.radius.xxl,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.15)',
  },
  heroGreeting: {
    fontSize: ios.fontSize.title1,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
    lineHeight: 34,
  },
  heroSub: {
    marginTop: 8,
    fontSize: ios.fontSize.subhead,
    color: colors.textSecondary,
    lineHeight: 22,
    fontWeight: '500',
  },
  statsRow: { flexDirection: 'row', paddingHorizontal: ios.spacing.lg, marginTop: 8 },
  statCardFirst: { marginRight: 12 },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: ios.radius.xl,
    padding: ios.spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 148,
    justifyContent: 'center',
  },
  statIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -1,
  },
  statLabel: {
    fontSize: ios.fontSize.footnote,
    fontWeight: '700',
    color: colors.text,
    marginTop: 4,
    textAlign: 'center',
  },
  statHint: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.placeholder,
    marginTop: 4,
    textAlign: 'center',
  },
  subCard: {
    marginHorizontal: ios.spacing.lg,
    marginTop: 16,
    borderRadius: ios.radius.xl,
    padding: ios.spacing.lg,
    borderWidth: 1,
  },
  subCardOk: {
    backgroundColor: colors.surface,
    borderColor: 'rgba(34, 197, 94, 0.35)',
  },
  subCardWarn: {
    backgroundColor: '#FFFBEB',
    borderColor: 'rgba(245, 158, 11, 0.45)',
  },
  subHeaderRow: { marginBottom: 4 },
  subBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 8,
  },
  subBadgeOk: { backgroundColor: 'rgba(34, 197, 94, 0.12)' },
  subBadgeWarn: { backgroundColor: 'rgba(220, 38, 38, 0.1)' },
  subBadgeText: { marginStart: 6, fontSize: 13, fontWeight: '800' },
  subBadgeTextOk: { color: '#15803D' },
  subBadgeTextWarn: { color: colors.error },
  subCardTitle: { fontSize: ios.fontSize.callout, fontWeight: '800', color: colors.text },
  subPrice: {
    fontSize: ios.fontSize.footnote,
    fontWeight: '700',
    color: colors.primaryDark,
    marginTop: 6,
    lineHeight: 20,
  },
  subStatus: { fontSize: ios.fontSize.subhead, color: colors.text, marginTop: 10, lineHeight: 22, fontWeight: '500' },
  subUntilRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  subUntilIcon: { marginRight: 8 },
  subUntil: { fontSize: ios.fontSize.footnote, color: colors.textSecondary, flex: 1, fontWeight: '600' },
  subCta: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#25D366',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: ios.radius.lg,
    minHeight: ios.minTouchTarget,
  },
  subCtaIcon: { marginEnd: 10 },
  subCtaText: { color: colors.white, fontWeight: '800', fontSize: ios.fontSize.callout, flex: 1, textAlign: 'center' },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: ios.spacing.lg,
    marginTop: 28,
    marginBottom: 12,
  },
  sectionHeadText: { flex: 1 },
  sectionHeading: {
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
  },
  errorCard: {
    marginHorizontal: ios.spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: ios.radius.xl,
    padding: ios.spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  errorTitle: {
    marginTop: 12,
    fontSize: ios.fontSize.subhead,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 22,
  },
  retryBtn: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: colors.primaryLight,
    borderRadius: ios.radius.md,
  },
  retryBtnText: { color: colors.primaryDark, fontWeight: '800', fontSize: ios.fontSize.callout },
  emptyCard: {
    marginHorizontal: ios.spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: ios.radius.xl,
    padding: ios.spacing.xxl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: ios.fontSize.title3,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  emptyBody: {
    marginTop: 8,
    fontSize: ios.fontSize.subhead,
    color: colors.placeholder,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 300,
  },
  rideCard: {
    marginHorizontal: ios.spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: ios.radius.lg,
    padding: ios.spacing.md,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
  },
  rideTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  rideRoute: { flex: 1, fontSize: ios.fontSize.callout, fontWeight: '800', color: colors.text, marginRight: 10, lineHeight: 22 },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    maxWidth: '42%',
  },
  statusPillDone: { backgroundColor: 'rgba(34, 197, 94, 0.12)' },
  statusPillCancelled: { backgroundColor: colors.metallic },
  statusPillText: { fontSize: 11, fontWeight: '800', textAlign: 'center' },
  statusPillTextDone: { color: '#15803D' },
  statusPillTextCancelled: { color: colors.placeholder },
  whenRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  rideWhen: { marginLeft: 6, fontSize: ios.fontSize.footnote, color: colors.textSecondary, fontWeight: '600' },
  addrRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 8 },
  addrDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: 6,
    marginRight: 10,
  },
  addrDotDest: { backgroundColor: colors.primaryDark },
  rideAddr: { flex: 1, fontSize: ios.fontSize.footnote, color: colors.text, lineHeight: 20, fontWeight: '500' },
  footerHint: {
    textAlign: 'center',
    fontSize: 12,
    color: colors.placeholder,
    marginTop: 20,
    paddingHorizontal: ios.spacing.lg,
    fontWeight: '500',
  },
});
