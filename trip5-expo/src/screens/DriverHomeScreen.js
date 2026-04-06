import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Platform,
  Alert,
  Modal,
  Animated,
  Easing,
  useWindowDimensions,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import i18n, { initI18n } from '../i18n';
import { colors, ios } from '../theme';
import { useAuth } from '../context/AuthContext';
import { getDriverOrders, postDriverOrderAction } from '../api';
import { getRouteLabel, statusLabel, pickupSummary, destinationSummary, formatBookingDate } from '../utils/bookings';
import { isDriverSubscriptionActive } from '../utils/driverSubscription';

function nextActionForStatus(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'confirmed') return { labelKey: 'driver_start_driving', next: 'driver_en_route' };
  if (s === 'driver_en_route') return { labelKey: 'driver_passenger_on_board', next: 'in_route' };
  if (s === 'in_route') return { labelKey: 'driver_complete_trip', next: 'completed' };
  return null;
}

export default function DriverHomeScreen() {
  const { accessToken, profile } = useAuth();
  const { width: windowWidth } = useWindowDimensions();
  const barMaxWidth = Math.min(windowWidth - 48, 400);
  const [locale, setLocale] = useState(i18n.locale);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [incomingOffer, setIncomingOffer] = useState(null);
  const [mine, setMine] = useState([]);
  const [actingId, setActingId] = useState(null);
  const [offerVisible, setOfferVisible] = useState(false);
  const [subscriptionOk, setSubscriptionOk] = useState(true);
  const progressAnim = useRef(new Animated.Value(1)).current;
  const animOfferId = useRef(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await getDriverOrders(accessToken);
      if (typeof data.subscriptionActive === 'boolean') {
        setSubscriptionOk(data.subscriptionActive);
      } else {
        setSubscriptionOk(isDriverSubscriptionActive(profile?.driver_subscription_valid_until));
      }
      const inc = data.incomingOffer || null;
      setIncomingOffer(inc);
      setMine(data.mine || []);
      if (inc) {
        setOfferVisible(true);
      } else {
        setOfferVisible(false);
      }
    } catch (e) {
      setError(e?.message || i18n.t('driver_error'));
      setIncomingOffer(null);
      setMine([]);
      setOfferVisible(false);
      setSubscriptionOk(isDriverSubscriptionActive(profile?.driver_subscription_valid_until));
    }
  }, [accessToken, profile?.driver_subscription_valid_until]);

  useEffect(() => {
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
  }, []);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
    const poll = setInterval(() => {
      load();
    }, 1000);
    return () => clearInterval(poll);
  }, [load]);

  useEffect(() => {
    if (!incomingOffer?.offerId) {
      animOfferId.current = null;
      return;
    }
    if (animOfferId.current === incomingOffer.offerId) return;
    animOfferId.current = incomingOffer.offerId;

    const end = new Date(incomingOffer.expiresAt).getTime();
    const start = new Date(incomingOffer.createdAt).getTime();
    const total = Math.max(1, end - start);
    const remaining = Math.max(0, end - Date.now());
    const startFrac = total > 0 ? remaining / total : 0;

    progressAnim.stopAnimation();
    progressAnim.setValue(startFrac);
    Animated.timing(progressAnim, {
      toValue: 0,
      duration: remaining,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();
  }, [incomingOffer?.offerId, incomingOffer?.expiresAt, incomingOffer?.createdAt, progressAnim]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const respondOffer = async (accept) => {
    if (!incomingOffer) return;
    setActingId(incomingOffer.offerId);
    try {
      await postDriverOrderAction(accessToken, {
        action: 'respond_offer',
        offerId: incomingOffer.offerId,
        accept,
      });
      setOfferVisible(false);
      setIncomingOffer(null);
      await load();
    } catch (e) {
      Alert.alert('', e?.message || 'Failed');
      await load();
    } finally {
      setActingId(null);
    }
  };

  const onSetStatus = async (orderId, status) => {
    setActingId(orderId);
    try {
      await postDriverOrderAction(accessToken, { orderId, action: 'set_status', status });
      await load();
    } catch (e) {
      Alert.alert('', e?.message || 'Failed');
    } finally {
      setActingId(null);
    }
  };

  const sections = [{ title: i18n.t('driver_my_jobs'), data: mine.length ? mine : [] }];

  const renderOrder = ({ item }) => {
    const routeText = getRouteLabel(item.route);
    const when = formatBookingDate(item.scheduled_at, locale);
    const pickup = pickupSummary(item.pickup);
    const dest = destinationSummary(item.destination);
    const passName = item.passenger_name || '—';
    const passPhone = item.passenger_phone || '';
    const st = item.status;
    const nextAct = nextActionForStatus(st);

    return (
      <View style={styles.card}>
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
  };

  const renderSectionHeader = ({ section: { title, data } }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {data.length === 0 && !loading ? <Text style={styles.emptyHint}>{i18n.t('driver_no_mine')}</Text> : null}
    </View>
  );

  const offerOrder = incomingOffer?.order;
  const offerRoute = offerOrder ? getRouteLabel(offerOrder.route) : '';
  const offerPickup = offerOrder ? pickupSummary(offerOrder.pickup) : '';
  const offerDest = offerOrder ? destinationSummary(offerOrder.destination) : '';

  const barWidthAnimated = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, barMaxWidth],
  });

  const header = (
    <View style={[styles.headerWrapper, Platform.OS !== 'ios' && styles.headerWrapperAndroid]}>
      {Platform.OS === 'ios' ? <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} /> : null}
      <View style={styles.headerInner}>
        <Ionicons name="car-outline" size={26} color={colors.primary} style={{ marginRight: 10 }} />
        <Text style={styles.headerTitle}>{i18n.t('driver_section_title')}</Text>
      </View>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        {header}
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>{i18n.t('driver_loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {header}
      {error ? (
        <View style={styles.bannerErr}>
          <Text style={styles.bannerErrText}>{error}</Text>
          <TouchableOpacity onPress={() => load()} hitSlop={12}>
            <Text style={styles.bannerRetry}>{i18n.t('driver_retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      {!subscriptionOk ? (
        <View style={styles.subBanner}>
          <Ionicons name="information-circle" size={18} color={colors.primaryDark} style={{ marginRight: 8 }} />
          <Text style={styles.subBannerText}>{i18n.t('driver_jobs_sub_banner')}</Text>
        </View>
      ) : null}

      <SectionList
        key={locale}
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={renderOrder}
        renderSectionHeader={renderSectionHeader}
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      />

      <Modal visible={offerVisible && !!incomingOffer} transparent animationType="fade" onRequestClose={() => {}}>
        <Pressable style={styles.modalBackdrop}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{i18n.t('driver_offer_title')}</Text>
            <Text style={styles.modalRoute}>{offerRoute}</Text>
            {offerPickup ? (
              <Text style={styles.modalLine} numberOfLines={3}>
                <Text style={styles.modalLineLabel}>{i18n.t('pickup_location')}: </Text>
                {offerPickup}
              </Text>
            ) : null}
            {offerDest ? (
              <Text style={styles.modalLine} numberOfLines={3}>
                <Text style={styles.modalLineLabel}>{i18n.t('destination')}: </Text>
                {offerDest}
              </Text>
            ) : null}
            <Text style={styles.timerHint}>{i18n.t('driver_offer_timer_hint')}</Text>
            <View style={[styles.timerTrack, { width: barMaxWidth }]}>
              <Animated.View style={[styles.timerBar, { width: barWidthAnimated }]} />
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.declineBtn, actingId && styles.btnDisabled]}
                onPress={() => respondOffer(false)}
                disabled={!!actingId}
              >
                <Text style={styles.declineBtnText}>{i18n.t('driver_offer_decline')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.acceptBtn, actingId && styles.btnDisabled]}
                onPress={() => respondOffer(true)}
                disabled={!!actingId}
              >
                {actingId ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.acceptBtnText}>{i18n.t('driver_offer_accept')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: ios.spacing.lg,
    paddingVertical: ios.spacing.md,
  },
  headerTitle: {
    fontSize: ios.fontSize.title,
    fontWeight: ios.fontWeight.bold,
    color: colors.text,
  },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: colors.textSecondary },
  bannerErr: {
    paddingHorizontal: ios.spacing.lg,
    paddingVertical: 10,
    backgroundColor: colors.primaryLight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bannerErrText: { flex: 1, color: colors.text, fontSize: 13 },
  bannerRetry: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  subBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: ios.spacing.lg,
    paddingVertical: 10,
    backgroundColor: colors.primaryLight,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  subBannerText: { flex: 1, color: colors.text, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  listContent: { paddingHorizontal: ios.spacing.lg, paddingBottom: 32 },
  sectionHeader: { paddingTop: 16, paddingBottom: 8 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  emptyHint: { fontSize: 14, color: colors.placeholder, marginTop: 6 },
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: ios.radius.xxl,
    borderTopRightRadius: ios.radius.xxl,
    paddingHorizontal: ios.spacing.lg,
    paddingTop: ios.spacing.sm,
    paddingBottom: ios.spacing.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  modalHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: ios.spacing.md,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  modalRoute: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
    textAlign: 'center',
    marginBottom: 12,
  },
  modalLine: { fontSize: 14, color: colors.text, marginBottom: 8, lineHeight: 20 },
  modalLineLabel: { fontWeight: '700', color: colors.textSecondary },
  timerHint: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  timerTrack: {
    alignSelf: 'center',
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.metallic,
    overflow: 'hidden',
    marginBottom: 20,
  },
  timerBar: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between' },
  declineBtn: {
    flex: 1,
    marginRight: 6,
    paddingVertical: 14,
    borderRadius: ios.radius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
  },
  declineBtnText: { fontWeight: '700', color: colors.text },
  acceptBtn: {
    flex: 1,
    marginLeft: 6,
    paddingVertical: 14,
    borderRadius: ios.radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  acceptBtnText: { fontWeight: '700', color: colors.white, fontSize: 16 },
});
