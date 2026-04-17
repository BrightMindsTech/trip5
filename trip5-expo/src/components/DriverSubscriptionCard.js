import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, I18nManager, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import i18n from '../i18n';
import { ios } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { Config } from '../config';
import { isDriverSubscriptionActive } from '../utils/driverSubscription';

const ACCENT_DONE = '#22C55E';

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

function createStyles(colors) {
  return StyleSheet.create({
    subCard: {
      marginBottom: ios.spacing.md,
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
  });
}

/** Trip5 driver subscription status + WhatsApp renew CTA — used on Account (drivers). */
export default function DriverSubscriptionCard() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { profile } = useAuth();
  const locale = i18n.locale;

  const subActive = isDriverSubscriptionActive(profile?.driver_subscription_valid_until);
  const contactDigits = String(Config.driverRegistrationPhone || '').replace(/\D/g, '');

  const openWhatsAppSubscribe = useCallback(() => {
    const text = encodeURIComponent(i18n.t('driver_subscription_wa_prefill'));
    Linking.openURL(`https://wa.me/${contactDigits}?text=${text}`).catch(() => {});
  }, [contactDigits]);

  return (
    <View style={[styles.subCard, cardShadow, subActive ? styles.subCardOk : styles.subCardWarn]}>
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
  );
}
