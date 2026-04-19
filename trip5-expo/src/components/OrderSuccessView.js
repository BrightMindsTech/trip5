import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import i18n from '../i18n';
import { ios } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { formatTripRefLine } from '../utils/tripReference';

function dispatchFailureHint(orderDispatch) {
  if (!orderDispatch || orderDispatch.offerCreated) return '';
  const r = orderDispatch.reason;
  const keyByReason = {
    no_eligible_drivers: 'order_dispatch_reason_no_eligible',
    all_drivers_already_offered: 'order_dispatch_reason_all_offered',
    offer_insert_failed: 'order_dispatch_reason_offer_failed',
    assign_exception: 'order_dispatch_reason_error',
    drivers_query_failed: 'order_dispatch_reason_error',
    past_offers_query_failed: 'order_dispatch_reason_error',
    order_not_found: 'order_dispatch_reason_error',
    order_not_dispatchable: 'order_dispatch_reason_error',
  };
  const key = keyByReason[r] || 'order_dispatch_no_offer';
  return i18n.t(key);
}

export default function OrderSuccessView({
  orderDispatch,
  submittedTripReference,
  onExit,
  exitLabel,
  contentTopInset,
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const dispatchHint = orderDispatch
    ? orderDispatch.offerCreated
      ? i18n.t('order_dispatch_ok_sub')
      : dispatchFailureHint(orderDispatch)
    : i18n.t('order_sent_desc');

  return (
    <View
      style={[
        styles.container,
        contentTopInset != null && { paddingTop: contentTopInset },
      ]}
    >
      <View style={styles.card}>
        <Text style={styles.successIcon}>✓</Text>
        <Text style={styles.successTitle}>{i18n.t('order_sent')}</Text>
        <Text
          style={[
            styles.successDesc,
            orderDispatch && !orderDispatch.offerCreated ? styles.successDescWarn : null,
          ]}
        >
          {dispatchHint}
        </Text>
        {submittedTripReference ? (
          <>
            <Text style={styles.successTripRef} selectable>
              {formatTripRefLine(i18n, submittedTripReference)}
            </Text>
            <Text style={styles.successRefHint}>{i18n.t('booking_reference_support_hint')}</Text>
          </>
        ) : null}
        <TouchableOpacity style={styles.primaryButton} onPress={onExit} activeOpacity={0.85}>
          <Text style={styles.primaryButtonText}>{exitLabel || i18n.t('new_order')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      padding: ios.spacing.lg,
      paddingTop: ios.spacing.md,
      backgroundColor: colors.background,
      justifyContent: 'center',
      paddingHorizontal: ios.spacing.lg,
    },
    card: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: ios.radius.xxl,
      padding: ios.spacing.xxl,
      ...Platform.select({
        ios: {
          shadowColor: '#0B1220',
          shadowOpacity: 0.08,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 8 },
        },
        android: { elevation: 3 },
      }),
      justifyContent: 'center',
    },
    successIcon: { fontSize: 56, color: colors.primary, textAlign: 'center', marginTop: 24 },
    successTitle: { fontSize: 22, fontWeight: '600', textAlign: 'center', marginTop: 16, color: colors.text },
    successDesc: {
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 12,
      paddingHorizontal: 16,
    },
    successDescWarn: {
      color: colors.text,
      fontWeight: '600',
    },
    successTripRef: {
      fontSize: ios.fontSize.title3,
      fontWeight: ios.fontWeight.bold,
      color: colors.primaryDark,
      textAlign: 'center',
      marginTop: ios.spacing.lg,
      paddingHorizontal: ios.spacing.md,
      letterSpacing: 0.5,
    },
    successRefHint: {
      fontSize: ios.fontSize.caption,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: ios.spacing.sm,
      paddingHorizontal: ios.spacing.lg,
      lineHeight: 18,
    },
    primaryButton: {
      backgroundColor: colors.primary,
      paddingVertical: ios.spacing.lg,
      paddingHorizontal: ios.spacing.xxl,
      borderRadius: ios.radius.lg,
      marginTop: ios.spacing.lg,
      alignItems: 'center',
      minHeight: 50,
    },
    primaryButtonText: {
      color: colors.white,
      fontSize: ios.fontSize.body,
      fontWeight: ios.fontWeight.semibold,
    },
  });
}
