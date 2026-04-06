import React, { useCallback, useContext, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import i18n, { initI18n } from '../i18n';
import { colors, ios } from '../theme';
import { useAuth } from '../context/AuthContext';
import { LocaleTabContext } from '../context/LocaleTabContext';
import LanguageToggle from '../components/LanguageToggle';
import WalletModal from '../components/WalletModal';
import { useFocusEffect } from '@react-navigation/native';

export default function AccountScreen() {
  const { signOut, profile } = useAuth();
  const bumpTabs = useContext(LocaleTabContext);
  const [walletVisible, setWalletVisible] = useState(false);
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

  const refreshLocale = useCallback(() => {
    setLocaleState(i18n.locale);
    bumpTabs();
  }, [bumpTabs]);

  const header = (
    <View style={[styles.headerWrapper, Platform.OS !== 'ios' && styles.headerWrapperAndroid]}>
      {Platform.OS === 'ios' ? (
        <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
      ) : null}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{i18n.t('account_title')}</Text>
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
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.profileCard}>
            <View style={styles.avatarLarge}>
              <Text style={styles.avatarLargeText}>
                {(String(profile?.full_name || '?').trim().slice(0, 1) || '?').toUpperCase()}
              </Text>
            </View>
            <Text style={styles.profileName}>{String(profile?.full_name || '—').trim() || '—'}</Text>
            <Text style={styles.profilePhone}>{String(profile?.phone || '').trim() || '—'}</Text>
          </View>

          <TouchableOpacity
            style={styles.row}
            onPress={() => setWalletVisible(true)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={i18n.t('wallet_title')}
          >
            <View style={styles.rowIconWrap}>
              <Ionicons name="wallet-outline" size={22} color={colors.primary} />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>{i18n.t('wallet_title')}</Text>
              <Text style={styles.rowSub}>{i18n.t('account_wallet_hint')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.placeholder} />
          </TouchableOpacity>

          <View style={styles.langRow}>
            <Text style={styles.langLabel}>{i18n.t('account_language')}</Text>
            <LanguageToggle onToggle={refreshLocale} />
          </View>

          <TouchableOpacity
            style={styles.signOutRow}
            onPress={() => signOut()}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={i18n.t('sign_out')}
          >
            <Ionicons name="log-out-outline" size={22} color={colors.error} />
            <Text style={styles.signOutText}>{i18n.t('sign_out')}</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
      <WalletModal visible={walletVisible} onClose={() => setWalletVisible(false)} />
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
  profileCard: {
    alignItems: 'center',
    paddingVertical: ios.spacing.xl,
    marginBottom: ios.spacing.md,
  },
  avatarLarge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: ios.spacing.md,
  },
  avatarLargeText: {
    fontSize: 32,
    fontWeight: ios.fontWeight.bold,
    color: colors.primaryDark,
  },
  profileName: {
    fontSize: ios.fontSize.title3,
    fontWeight: ios.fontWeight.semibold,
    color: colors.text,
    textAlign: 'center',
  },
  profilePhone: {
    marginTop: ios.spacing.xs,
    fontSize: ios.fontSize.subhead,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: ios.radius.lg,
    padding: ios.spacing.md,
    marginBottom: ios.spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  rowIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: ios.spacing.md,
  },
  rowBody: { flex: 1 },
  rowTitle: {
    fontSize: ios.fontSize.callout,
    fontWeight: ios.fontWeight.semibold,
    color: colors.text,
  },
  rowSub: {
    fontSize: ios.fontSize.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: ios.radius.lg,
    paddingHorizontal: ios.spacing.md,
    paddingVertical: ios.spacing.sm,
    marginBottom: ios.spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  langLabel: {
    fontSize: ios.fontSize.subhead,
    fontWeight: ios.fontWeight.medium,
    color: colors.text,
  },
  signOutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: ios.spacing.sm,
    paddingVertical: ios.spacing.md,
  },
  signOutText: {
    fontSize: ios.fontSize.callout,
    fontWeight: ios.fontWeight.semibold,
    color: colors.error,
  },
});
