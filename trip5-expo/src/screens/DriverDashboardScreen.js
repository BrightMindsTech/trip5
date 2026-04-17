import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import i18n, { initI18n } from '../i18n';
import { ios } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { getDriverTripRank } from '../utils/driverTripRank';
import DriverActiveOrdersBlock from '../components/DriverActiveOrdersBlock';
import { useFocusEffect } from '@react-navigation/native';

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
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createDriverDashboardStyles(colors), [colors]);
  const { session, profile, loadProfile } = useAuth();
  const userId = session?.user?.id;
  const [locale, setLocale] = useState(i18n.locale);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);

  const score = profile?.driver_score != null && !Number.isNaN(Number(profile.driver_score)) ? Number(profile.driver_score) : null;
  const ratingCount =
    profile?.driver_rating_count != null && Number.isFinite(Number(profile.driver_rating_count))
      ? Math.max(0, Math.floor(Number(profile.driver_rating_count)))
      : null;
  const tripRank = useMemo(() => getDriverTripRank(completedCount), [completedCount]);
  const firstName = useMemo(() => getFirstName(profile?.full_name), [profile?.full_name]);
  const greeting = useMemo(() => i18n.t(greetingKey()), [locale]);

  const loadCompletedCount = useCallback(async () => {
    if (!userId) {
      setCompletedCount(0);
      return;
    }
    const { count, error } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('driver_id', userId)
      .eq('status', 'completed');
    if (error) {
      setCompletedCount(0);
      return;
    }
    setCompletedCount(count ?? 0);
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
    loadCompletedCount().finally(() => setLoading(false));
  }, [userId, loadCompletedCount]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (userId) await loadProfile(userId, { silent: true });
    await loadCompletedCount();
    setRefreshing(false);
  }, [userId, loadProfile, loadCompletedCount]);

  /** Light: soft lavender hero. Dark: only dark stops so `colors.text` (light) is not drawn on pale bands. */
  const heroGradientColors = useMemo(
    () =>
      isDark
        ? [colors.primaryLight, colors.surface, colors.background]
        : ['#EDE9FE', '#FAF5FF', colors.background],
    [isDark, colors.background, colors.primaryLight, colors.surface]
  );

  const header = (
    <View style={[styles.headerWrapper, Platform.OS !== 'ios' && styles.headerWrapperAndroid]}>
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
          colors={heroGradientColors}
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
            accessibilityLabel={
              ratingCount != null
                ? `${i18n.t('driver_score_label')}: ${score != null ? score.toFixed(1) : '—'}. ${i18n.t('driver_score_ratings_count', { count: ratingCount })}`
                : `${i18n.t('driver_score_label')}: ${score != null ? score.toFixed(1) : '—'}`
            }
          >
            <View style={styles.statIconCircle}>
              <Ionicons name="star" size={24} color={colors.primaryDark} />
            </View>
            <Text style={styles.statValue}>{score != null ? score.toFixed(1) : '—'}</Text>
            <Text style={styles.statLabel}>{i18n.t('driver_score_label')}</Text>
            <Text style={styles.statHint}>{i18n.t('driver_score_out_of')}</Text>
            {ratingCount != null ? (
              <Text style={styles.statRatingCount} numberOfLines={2}>
                {ratingCount === 0
                  ? i18n.t('driver_score_no_ratings_yet')
                  : ratingCount === 1
                    ? i18n.t('driver_score_rating_singular')
                    : i18n.t('driver_score_ratings_count', { count: ratingCount })}
              </Text>
            ) : null}
          </View>
          <View
            style={[styles.statCard, cardShadow]}
            accessibilityLabel={`${i18n.t('driver_trips_completed')}: ${completedCount}. ${i18n.t(
              `driver_rank_${tripRank.key}`
            )}`}
          >
            <View
              style={[
                styles.statIconCircle,
                { backgroundColor: tripRank.softBg, borderWidth: StyleSheet.hairlineWidth, borderColor: tripRank.accent },
              ]}
            >
              <Ionicons name={tripRank.icon} size={24} color={tripRank.iconColor} />
            </View>
            <Text style={styles.statValue}>{completedCount}</Text>
            <Text style={styles.statLabel}>{i18n.t('driver_trips_completed')}</Text>
            <Text style={[styles.statRankName, { color: tripRank.accent }]}>{i18n.t(`driver_rank_${tripRank.key}`)}</Text>
            <Text style={styles.statHint}>{i18n.t('driver_trips_completed_hint')}</Text>
          </View>
        </View>

        <DriverActiveOrdersBlock onAssignmentsChanged={loadCompletedCount} />

        <Text style={styles.footerHint}>{i18n.t('driver_pull_refresh_hint')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function createDriverDashboardStyles(colors) {
  return StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  headerWrapper: {
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  headerWrapperAndroid: { backgroundColor: 'transparent' },
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
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: ios.spacing.lg,
    marginTop: 8,
    marginBottom: ios.spacing.sm,
  },
  statCardFirst: { marginRight: 12 },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: ios.radius.xl,
    padding: ios.spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 168,
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
  statRatingCount: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '600',
    color: colors.placeholder,
    textAlign: 'center',
    lineHeight: 15,
    paddingHorizontal: 2,
  },
  statRankName: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  footerHint: {
    textAlign: 'center',
    fontSize: 12,
    color: colors.placeholder,
    marginTop: 20,
    paddingHorizontal: ios.spacing.lg,
    fontWeight: '500',
  },
});
}
