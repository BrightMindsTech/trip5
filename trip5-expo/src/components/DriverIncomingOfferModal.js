import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Pressable,
  Animated,
  Easing,
  useWindowDimensions,
  Alert,
} from 'react-native';
import i18n from '../i18n';
import { ios } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { useDriverJobs } from '../context/DriverOrdersContext';
import { getRouteLabel, pickupSummary, destinationSummary } from '../utils/bookings';

/**
 * Mounted once at driver navigator root so incoming offers show on any tab (Dashboard/Jobs/Account).
 */
export default function DriverIncomingOfferModal() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { width: windowWidth } = useWindowDimensions();
  const barMaxWidth = Math.min(windowWidth - 48, 400);
  const { incomingOffer, respondOffer } = useDriverJobs();
  const [actingId, setActingId] = useState(null);
  const progressAnim = useRef(new Animated.Value(1)).current;
  const animOfferId = useRef(null);

  const offerVisible = !!incomingOffer;
  const offerOrder = incomingOffer?.order;
  const offerCanAccept = incomingOffer?.canAccept !== false;
  const offerRoute = offerOrder ? getRouteLabel(offerOrder.route) : '';
  const offerPickup = offerOrder ? pickupSummary(offerOrder.pickup) : '';
  const offerDest = offerOrder ? destinationSummary(offerOrder.destination) : '';

  const barWidthAnimated = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, barMaxWidth],
  });

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

  const onRespond = async (accept) => {
    if (!incomingOffer?.offerId) return;
    setActingId(incomingOffer.offerId);
    try {
      await respondOffer(accept);
    } catch (e) {
      Alert.alert('', e?.message || 'Failed');
    } finally {
      setActingId(null);
    }
  };

  return (
    <Modal
      visible={offerVisible}
      transparent
      animationType="fade"
      {...(Platform.OS === 'ios' ? { presentationStyle: 'overFullScreen' } : {})}
      statusBarTranslucent
      onRequestClose={() => {}}
    >
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
          {!offerCanAccept ? (
            <Text style={styles.modalSubOnlyHint}>{i18n.t('driver_offer_accept_needs_subscription')}</Text>
          ) : null}
          <View style={[styles.timerTrack, { width: barMaxWidth }]}>
            <Animated.View style={[styles.timerBar, { width: barWidthAnimated }]} />
          </View>
          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.declineBtn, actingId && styles.btnDisabled]}
              onPress={() => onRespond(false)}
              disabled={!!actingId}
            >
              <Text style={styles.declineBtnText}>{i18n.t('driver_offer_decline')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.acceptBtn, (actingId || !offerCanAccept) && styles.btnDisabled]}
              onPress={() => onRespond(true)}
              disabled={!!actingId || !offerCanAccept}
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
  );
}

function createStyles(colors) {
  return StyleSheet.create({
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
    modalSubOnlyHint: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.primaryDark,
      textAlign: 'center',
      marginBottom: 8,
      paddingHorizontal: 8,
      lineHeight: 17,
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
    btnDisabled: { opacity: 0.6 },
  });
}
