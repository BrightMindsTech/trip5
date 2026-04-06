import React from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import i18n from '../i18n';
import { colors, ios } from '../theme';

const DEMO_BALANCE = '15.00';

const MOCK_ROWS = [
  { id: '1', amountKey: 'wallet_mock_amt_1', lineKey: 'wallet_mock_1', icon: 'car-outline' },
  { id: '2', amountKey: 'wallet_mock_amt_2', lineKey: 'wallet_mock_2', icon: 'car-sport-outline' },
  { id: '3', amountKey: 'wallet_mock_amt_3', lineKey: 'wallet_mock_3', icon: 'airplane-outline' },
  { id: '4', amountKey: 'wallet_mock_amt_4', lineKey: 'wallet_mock_4', icon: 'add-circle-outline' },
  { id: '5', amountKey: 'wallet_mock_amt_5', lineKey: 'wallet_mock_5', icon: 'gift-outline' },
];

export default function WalletModal({ visible, onClose }) {
  const isArabic = i18n.locale === 'ar';

  const onAddFunds = () => {
    Alert.alert(i18n.t('wallet_add_funds'), i18n.t('wallet_coming_soon'));
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
        <View style={[styles.topBar, isArabic && styles.topBarRtl]}>
          <Text style={styles.topTitle}>{i18n.t('wallet_title')}</Text>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel={i18n.t('done')}
          >
            <Text style={styles.closeText}>{i18n.t('done')}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <LinearGradient
            colors={[colors.primaryDark, colors.primary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.balanceCard}
          >
            <Text style={styles.balanceLabel}>{i18n.t('wallet_balance_label')}</Text>
            <View style={[styles.balanceRow, isArabic && styles.balanceRowRtl]}>
              <Text style={styles.balanceAmount}>{DEMO_BALANCE}</Text>
              <Text style={styles.balanceJod}>{i18n.t('jod')}</Text>
            </View>
          </LinearGradient>

          <TouchableOpacity
            style={styles.addFundsBtn}
            onPress={onAddFunds}
            activeOpacity={0.85}
          >
            <Ionicons name="wallet-outline" size={20} color={colors.primary} />
            <Text style={styles.addFundsText}>{i18n.t('wallet_add_funds')}</Text>
            <Ionicons
              name={isArabic ? 'chevron-back' : 'chevron-forward'}
              size={18}
              color={colors.textSecondary}
            />
          </TouchableOpacity>

          <Text style={styles.sectionTitle}>{i18n.t('wallet_activity')}</Text>

          <View style={styles.list}>
            {MOCK_ROWS.map((row) => (
              <View
                key={row.id}
                style={[styles.txRow, isArabic && styles.txRowRtl]}
              >
                <View style={[styles.txIconWrap, isArabic && styles.txIconWrapRtl]}>
                  <Ionicons name={row.icon} size={22} color={colors.primary} />
                </View>
                <View style={styles.txBody}>
                  <Text style={styles.txLine} numberOfLines={2}>
                    {i18n.t(row.lineKey)}
                  </Text>
                </View>
                <Text style={styles.txAmount}>{i18n.t(row.amountKey)}</Text>
              </View>
            ))}
          </View>

          <View style={styles.disclaimer}>
            <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
            <Text style={styles.disclaimerText}>{i18n.t('wallet_demo_notice')}</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: ios.spacing.lg,
    paddingVertical: ios.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  topBarRtl: {
    flexDirection: 'row-reverse',
  },
  topTitle: {
    fontSize: ios.fontSize.title3,
    fontWeight: ios.fontWeight.bold,
    color: colors.text,
  },
  closeBtn: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  closeText: {
    fontSize: ios.fontSize.body,
    fontWeight: ios.fontWeight.semibold,
    color: colors.primary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: ios.spacing.lg,
    paddingBottom: ios.spacing.xxl,
  },
  balanceCard: {
    borderRadius: ios.radius.xxl,
    padding: ios.spacing.xl,
    marginTop: ios.spacing.md,
    marginBottom: ios.spacing.lg,
  },
  balanceLabel: {
    fontSize: ios.fontSize.footnote,
    fontWeight: ios.fontWeight.medium,
    color: 'rgba(255,255,255,0.85)',
    marginBottom: ios.spacing.xs,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  balanceRowRtl: {
    flexDirection: 'row-reverse',
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: '700',
    color: colors.white,
    letterSpacing: -1,
  },
  balanceJod: {
    fontSize: ios.fontSize.title3,
    fontWeight: ios.fontWeight.semibold,
    color: 'rgba(255,255,255,0.9)',
    marginStart: 8,
  },
  addFundsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: ios.radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: ios.spacing.md,
    paddingHorizontal: ios.spacing.lg,
    marginBottom: ios.spacing.xl,
    gap: 10,
  },
  addFundsText: {
    flex: 1,
    fontSize: ios.fontSize.body,
    fontWeight: ios.fontWeight.semibold,
    color: colors.text,
  },
  sectionTitle: {
    fontSize: ios.fontSize.subhead,
    fontWeight: ios.fontWeight.semibold,
    color: colors.textSecondary,
    marginBottom: ios.spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  list: {
    backgroundColor: colors.surface,
    borderRadius: ios.radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: ios.spacing.md,
    paddingHorizontal: ios.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  txRowRtl: {
    flexDirection: 'row-reverse',
  },
  txIconWrap: {
    marginRight: ios.spacing.md,
  },
  txIconWrapRtl: {
    marginRight: 0,
    marginLeft: ios.spacing.md,
  },
  txBody: {
    flex: 1,
    minWidth: 0,
  },
  txLine: {
    fontSize: ios.fontSize.callout,
    color: colors.text,
    lineHeight: 22,
  },
  txAmount: {
    fontSize: ios.fontSize.callout,
    fontWeight: ios.fontWeight.semibold,
    color: colors.text,
    marginStart: ios.spacing.sm,
  },
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: ios.spacing.xl,
    paddingHorizontal: ios.spacing.xs,
  },
  disclaimerText: {
    flex: 1,
    fontSize: ios.fontSize.caption,
    color: colors.textSecondary,
    lineHeight: 18,
  },
});
