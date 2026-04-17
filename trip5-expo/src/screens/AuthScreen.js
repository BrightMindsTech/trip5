import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  Linking,
  ImageBackground,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { ios } from '../theme';
import { useTheme } from '../context/ThemeContext';
import i18n from '../i18n';
import { TERMS_AND_PRIVACY_TEXT } from '../legal/termsPrivacyText';
import LanguageToggle from '../components/LanguageToggle';
import { isValidJordanPhone } from '../utils/phoneAuth';

const FLAG_JO = '🇯🇴';

/** Semantic colors for auth screen — dark matches branded mockup; light follows app theme. */
function buildAuthTheme(colors, isDark) {
  if (isDark) {
    return {
      overlay: ['rgba(8, 6, 22, 0.88)', 'rgba(10, 8, 24, 0.9)', 'rgba(6, 4, 18, 0.94)'],
      rootBg: '#0a0818',
      text: '#F8FAFC',
      textMuted: 'rgba(203, 213, 225, 0.9)',
      placeholder: 'rgba(148, 163, 184, 0.85)',
      inputBg: 'rgba(26, 22, 44, 0.92)',
      inputBorder: 'rgba(255, 255, 255, 0.1)',
      brand: colors.primary,
      link: colors.primary,
      primaryBtnBg: '#9333EA',
      primaryBtnText: '#FFFFFF',
      shadowAccent: colors.primary,
      driverBg: 'rgba(18, 14, 34, 0.92)',
      langBtnBg: 'rgba(255,255,255,0.06)',
      modalBg: '#1a1530',
      modalBody: 'rgba(203, 213, 225, 0.92)',
      legalMuted: 'rgba(148, 163, 184, 0.85)',
    };
  }
  return {
    overlay: ['rgba(255, 255, 255, 0.9)', 'rgba(243, 232, 255, 0.94)', colors.background],
    rootBg: colors.background,
    text: colors.text,
    textMuted: colors.textSecondary,
    placeholder: colors.placeholder,
    inputBg: colors.surface,
    inputBorder: colors.border,
    brand: colors.primary,
    link: colors.primaryDark,
    primaryBtnBg: colors.primaryDark,
    primaryBtnText: colors.white,
    shadowAccent: colors.primaryDark,
    driverBg: colors.surface,
    langBtnBg: colors.primaryLight,
    modalBg: colors.surface,
    modalBody: colors.textSecondary,
    legalMuted: colors.placeholder,
  };
}

function renderWelcomeTitle(fullTitle, styles) {
  const brand = 'Trip5';
  const i = fullTitle.indexOf(brand);
  if (i < 0) {
    return <Text style={styles.heroTitle}>{fullTitle}</Text>;
  }
  return (
    <Text style={styles.heroTitle}>
      <Text style={styles.heroTitleLight}>{fullTitle.slice(0, i)}</Text>
      <Text style={styles.heroTitleBrand}>{brand}</Text>
      <Text style={styles.heroTitleLight}>{fullTitle.slice(i + brand.length)}</Text>
    </Text>
  );
}

export default function AuthScreen({ onPressDriver }) {
  const { colors, isDark, setPreference } = useTheme();
  const authTheme = useMemo(() => buildAuthTheme(colors, isDark), [colors, isDark]);
  const styles = useMemo(() => createAuthStyles(authTheme), [authTheme]);
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState('signIn');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [localeTick, setLocaleTick] = useState(0);
  const [showTermsModal, setShowTermsModal] = useState(false);

  const refreshLocale = useCallback(() => {
    setLocaleTick((n) => n + 1);
  }, []);

  const onToggleTheme = useCallback(() => {
    setPreference(isDark ? 'light' : 'dark');
  }, [isDark, setPreference]);

  const onSubmit = async () => {
    if (!phone.trim() || !password) {
      Alert.alert('', i18n.t('error_required'));
      return;
    }
    if (!isValidJordanPhone(phone)) {
      Alert.alert('', i18n.t('error_invalid_phone'));
      return;
    }
    setBusy(true);
    try {
      if (mode === 'signIn') {
        await signIn(phone, password);
      } else {
        if (!fullName.trim()) {
          Alert.alert('', i18n.t('auth_signup_name_required'));
          setBusy(false);
          return;
        }
        await signUp(phone, password, fullName);
      }
    } catch (e) {
      Alert.alert('', e.message || 'Auth failed');
    } finally {
      setBusy(false);
    }
  };

  const openHelp = () => {
    Linking.openURL('mailto:support@trip5.app?subject=Trip5%20support').catch(() => {
      Alert.alert('', i18n.t('auth_help'));
    });
  };

  const openForgotPassword = () => {
    Alert.alert(i18n.t('auth_forgot_password'), i18n.t('auth_forgot_password_hint'), [
      { text: i18n.t('cancel'), style: 'cancel' },
      {
        text: i18n.t('auth_help'),
        onPress: () => openHelp(),
      },
    ]);
  };

  const heroTitle =
    mode === 'signIn' ? i18n.t('auth_welcome_title_signin') : i18n.t('auth_welcome_title_signup');
  const heroSub =
    mode === 'signIn' ? i18n.t('auth_welcome_sub_signin') : i18n.t('auth_welcome_sub_signup');

  const ph = authTheme.placeholder;

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={styles.root}>
        <ImageBackground
          source={require('../../assets/amman-photo.png')}
          style={styles.bgImage}
          resizeMode="cover"
          blurRadius={Platform.OS === 'ios' ? (isDark ? 18 : 14) : 12}
        >
          <LinearGradient colors={authTheme.overlay} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
          <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
            <KeyboardAvoidingView
              style={styles.flex}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
              <ScrollView
                key={localeTick}
                contentContainerStyle={styles.scroll}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {renderWelcomeTitle(heroTitle, styles)}

                <Text style={styles.heroSub}>{heroSub}</Text>

                {mode === 'signUp' && (
                  <>
                    <Text style={styles.fieldLabel}>{i18n.t('full_name')}</Text>
                    <View style={styles.inputWell}>
                      <TextInput
                        style={styles.inputField}
                        value={fullName}
                        onChangeText={setFullName}
                        placeholder={i18n.t('enter_full_name')}
                        placeholderTextColor={ph}
                        autoCapitalize="words"
                      />
                    </View>
                  </>
                )}

                <Text style={styles.fieldLabel}>{i18n.t('phone_number')}</Text>
                <View style={styles.inputWell}>
                  <Text style={styles.phonePrefixFlag}>{FLAG_JO}</Text>
                  <Text style={styles.phonePrefixCode}>+962</Text>
                  <View style={styles.phoneSep} />
                  <TextInput
                    style={styles.inputFieldPhone}
                    value={phone}
                    onChangeText={setPhone}
                    placeholder={i18n.t('auth_phone_placeholder')}
                    placeholderTextColor={ph}
                    keyboardType="phone-pad"
                  />
                </View>

                {mode === 'signIn' ? (
                  <View style={styles.passwordLabelRow}>
                    <Text style={styles.passwordLabel}>{i18n.t('auth_password')}</Text>
                    <TouchableOpacity onPress={openForgotPassword} hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}>
                      <Text style={styles.forgotLink}>{i18n.t('auth_forgot_password')}</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <Text style={styles.fieldLabel}>{i18n.t('auth_password')}</Text>
                )}
                <View style={styles.inputWell}>
                  <TextInput
                    style={styles.inputField}
                    value={password}
                    onChangeText={setPassword}
                    placeholder={i18n.t('auth_placeholder_password')}
                    placeholderTextColor={ph}
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity onPress={() => setShowPassword((p) => !p)} style={styles.eyeBtn} accessibilityRole="button">
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={22}
                      color={authTheme.textMuted}
                    />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={[styles.primaryBtn, busy && styles.btnDisabled]}
                  onPress={onSubmit}
                  disabled={busy}
                  activeOpacity={0.88}
                >
                  {busy ? (
                    <ActivityIndicator color={authTheme.primaryBtnText} />
                  ) : (
                    <Text style={styles.primaryBtnText}>
                      {mode === 'signIn' ? i18n.t('auth_sign_in') : i18n.t('auth_sign_up')}
                    </Text>
                  )}
                </TouchableOpacity>

                <View style={styles.switchRow}>
                  <Text style={styles.switchPlain}>
                    {mode === 'signIn' ? i18n.t('auth_footer_no_account') : i18n.t('auth_footer_have_account')}
                  </Text>
                  <TouchableOpacity onPress={() => setMode(mode === 'signIn' ? 'signUp' : 'signIn')} disabled={busy}>
                    <Text style={styles.switchLink}>
                      {mode === 'signIn' ? i18n.t('auth_footer_create') : i18n.t('auth_footer_sign_in_link')}
                    </Text>
                  </TouchableOpacity>
                </View>

                {typeof onPressDriver === 'function' ? (
                  <TouchableOpacity
                    style={styles.driverEntry}
                    onPress={onPressDriver}
                    disabled={busy}
                    accessibilityRole="button"
                    accessibilityLabel={i18n.t('auth_im_a_driver')}
                    activeOpacity={0.88}
                  >
                    <Ionicons name="car-sport" size={22} color={authTheme.link} style={styles.driverIcon} />
                    <Text style={styles.driverEntryText}>{i18n.t('auth_im_a_driver')}</Text>
                  </TouchableOpacity>
                ) : null}

                <Text style={styles.legal}>
                  {i18n.t('auth_legal_prefix')}
                  <Text style={styles.legalLink} onPress={() => setShowTermsModal(true)}>
                    {i18n.t('auth_legal_terms')}
                  </Text>
                  {i18n.t('auth_legal_and')}
                  <Text style={styles.legalLink} onPress={() => setShowTermsModal(true)}>
                    {i18n.t('auth_legal_privacy')}
                  </Text>
                  {i18n.t('auth_legal_suffix')}
                </Text>

                <View style={styles.footerBar}>
                  <TouchableOpacity style={styles.helpBtn} onPress={openHelp}>
                    <Ionicons name="help-circle-outline" size={22} color={authTheme.textMuted} />
                    <Text style={styles.helpLabel}>{i18n.t('auth_help')}</Text>
                  </TouchableOpacity>
                  <View style={styles.footerRight}>
                    <Pressable
                      onPress={onToggleTheme}
                      style={({ pressed }) => [styles.themeToggle, pressed && styles.themeTogglePressed]}
                      accessibilityRole="button"
                      accessibilityLabel={
                        isDark ? i18n.t('auth_toggle_theme_to_light_a11y') : i18n.t('auth_toggle_theme_to_dark_a11y')
                      }
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons
                        name={isDark ? 'sunny-outline' : 'moon-outline'}
                        size={22}
                        color={authTheme.link}
                      />
                    </Pressable>
                    <LanguageToggle
                      onToggle={refreshLocale}
                      buttonStyle={styles.langBtn}
                      textStyle={styles.langBtnText}
                    />
                  </View>
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </ImageBackground>
      </View>

      <Modal visible={showTermsModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowTermsModal(false)} />
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{i18n.t('terms_modal_title')}</Text>
              <TouchableOpacity onPress={() => setShowTermsModal(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Text style={styles.modalClose}>{i18n.t('done')}</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent}>
              <Text style={styles.modalBody}>{TERMS_AND_PRIVACY_TEXT}</Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

function createAuthStyles(t) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: t.rootBg },
    bgImage: { flex: 1, width: '100%', height: '100%' },
    safe: { flex: 1, backgroundColor: 'transparent' },
    flex: { flex: 1 },
    scroll: {
      paddingHorizontal: ios.spacing.lg,
      paddingBottom: ios.spacing.xxl,
      paddingTop: ios.spacing.md,
    },
    heroTitle: {
      fontSize: ios.fontSize.title1 + 2,
      fontWeight: ios.fontWeight.bold,
      marginBottom: ios.spacing.sm,
      letterSpacing: -0.6,
      lineHeight: 36,
    },
    heroTitleLight: {
      color: t.text,
    },
    heroTitleBrand: {
      color: t.brand,
      fontWeight: ios.fontWeight.bold,
    },
    heroSub: {
      fontSize: ios.fontSize.subhead,
      color: t.textMuted,
      lineHeight: 22,
      marginBottom: ios.spacing.xl,
    },
    fieldLabel: {
      fontSize: ios.fontSize.footnote,
      fontWeight: ios.fontWeight.medium,
      color: t.textMuted,
      marginBottom: ios.spacing.sm,
    },
    inputWell: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: t.inputBg,
      borderRadius: ios.radius.lg,
      paddingHorizontal: ios.spacing.md,
      marginBottom: ios.spacing.lg,
      minHeight: 52,
      borderWidth: 1,
      borderColor: t.inputBorder,
    },
    inputField: {
      flex: 1,
      fontSize: ios.fontSize.body,
      color: t.text,
      paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    },
    inputFieldPhone: {
      flex: 1,
      fontSize: ios.fontSize.body,
      color: t.text,
      paddingVertical: Platform.OS === 'ios' ? 14 : 12,
      letterSpacing: 0.5,
    },
    phonePrefixFlag: {
      fontSize: 22,
      marginRight: ios.spacing.sm,
    },
    phonePrefixCode: {
      fontSize: ios.fontSize.body,
      fontWeight: ios.fontWeight.semibold,
      color: t.textMuted,
    },
    phoneSep: {
      width: 1,
      height: 24,
      backgroundColor: t.inputBorder,
      marginHorizontal: ios.spacing.md,
    },
    passwordLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: ios.spacing.sm,
    },
    passwordLabel: {
      fontSize: ios.fontSize.footnote,
      fontWeight: ios.fontWeight.medium,
      color: t.textMuted,
    },
    forgotLink: {
      fontSize: ios.fontSize.footnote,
      fontWeight: ios.fontWeight.semibold,
      color: t.link,
    },
    eyeBtn: { padding: ios.spacing.xs, marginLeft: ios.spacing.xs },
    primaryBtn: {
      backgroundColor: t.primaryBtnBg,
      borderRadius: ios.radius.lg,
      paddingVertical: 16,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: ios.spacing.sm,
      minHeight: 54,
      ...Platform.select({
        ios: {
          shadowColor: t.shadowAccent,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.35,
          shadowRadius: 12,
        },
        android: { elevation: 6 },
      }),
    },
    primaryBtnText: {
      color: t.primaryBtnText,
      fontWeight: ios.fontWeight.bold,
      fontSize: ios.fontSize.body,
    },
    btnDisabled: { opacity: 0.55 },
    switchRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      marginTop: ios.spacing.xl,
      marginBottom: ios.spacing.md,
    },
    switchPlain: {
      fontSize: ios.fontSize.subhead,
      color: t.textMuted,
    },
    switchLink: {
      fontSize: ios.fontSize.subhead,
      fontWeight: ios.fontWeight.bold,
      color: t.link,
    },
    driverEntry: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      marginTop: ios.spacing.sm,
      marginBottom: ios.spacing.md,
      paddingVertical: 16,
      paddingHorizontal: ios.spacing.lg,
      backgroundColor: t.driverBg,
      borderRadius: ios.radius.lg,
      borderWidth: 1,
      borderColor: t.inputBorder,
    },
    driverIcon: { marginRight: 10 },
    driverEntryText: {
      fontSize: ios.fontSize.subhead,
      fontWeight: ios.fontWeight.semibold,
      color: t.text,
    },
    legal: {
      fontSize: ios.fontSize.caption,
      color: t.legalMuted,
      textAlign: 'center',
      lineHeight: 18,
      marginBottom: ios.spacing.lg,
      paddingHorizontal: ios.spacing.sm,
    },
    legalLink: {
      color: t.link,
      fontWeight: ios.fontWeight.semibold,
      textDecorationLine: 'underline',
    },
    footerBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: ios.spacing.sm,
    },
    footerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ios.spacing.sm,
    },
    themeToggle: {
      width: ios.minTouchTarget,
      height: ios.minTouchTarget,
      borderRadius: ios.minTouchTarget / 2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.langBtnBg,
      borderWidth: 1,
      borderColor: t.inputBorder,
    },
    themeTogglePressed: { opacity: 0.75 },
    helpBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    helpLabel: {
      fontSize: 11,
      fontWeight: ios.fontWeight.bold,
      color: t.textMuted,
      letterSpacing: 0.6,
    },
    langBtn: {
      backgroundColor: t.langBtnBg,
      borderColor: t.inputBorder,
      borderWidth: 1,
    },
    langBtnText: {
      color: t.link,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.65)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: ios.spacing.lg,
    },
    modalCard: {
      backgroundColor: t.modalBg,
      borderRadius: 16,
      width: '100%',
      maxWidth: 400,
      height: '80%',
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: t.inputBorder,
      ...Platform.select({
        ios: { shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 24, shadowOffset: { width: 0, height: 8 } },
        android: { elevation: 12 },
      }),
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: ios.spacing.lg,
      paddingVertical: ios.spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.inputBorder,
    },
    modalTitle: {
      fontSize: ios.fontSize.title3,
      fontWeight: ios.fontWeight.bold,
      color: t.text,
    },
    modalClose: {
      fontSize: ios.fontSize.body,
      color: t.link,
      fontWeight: ios.fontWeight.semibold,
    },
    modalScroll: { flex: 1, minHeight: 0 },
    modalScrollContent: { padding: ios.spacing.lg, paddingBottom: ios.spacing.xxl },
    modalBody: {
      fontSize: ios.fontSize.footnote,
      color: t.modalBody,
      lineHeight: 22,
    },
  });
}
