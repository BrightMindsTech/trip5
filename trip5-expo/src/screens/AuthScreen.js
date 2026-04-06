import React, { useState, useCallback } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { colors, ios } from '../theme';
import i18n from '../i18n';
import { TERMS_AND_PRIVACY_TEXT } from '../legal/termsPrivacyText';
import LanguageToggle from '../components/LanguageToggle';
import { isValidJordanPhone } from '../utils/phoneAuth';

export default function AuthScreen() {
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

  const heroTitle =
    mode === 'signIn' ? i18n.t('auth_welcome_title_signin') : i18n.t('auth_welcome_title_signup');
  const heroSub =
    mode === 'signIn' ? i18n.t('auth_welcome_sub_signin') : i18n.t('auth_welcome_sub_signup');

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <LinearGradient
        colors={['#F3E8FF', colors.background, colors.background]}
        locations={[0, 0.35, 1]}
        style={styles.gradient}
      >
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
            <View style={styles.headerRow}>
              <View style={styles.headerSide} />
              <Text style={styles.brandCenter}>
                Trip<Text style={styles.brandAccent}>5</Text>
              </Text>
              <View style={styles.headerSide} />
            </View>

            <Text style={styles.heroTitle}>{heroTitle}</Text>
            <Text style={styles.heroSub}>{heroSub}</Text>

            <View style={styles.card}>
              {mode === 'signUp' && (
                <>
                  <Text style={styles.labelCaps}>{i18n.t('full_name')}</Text>
                  <View style={styles.inputRow}>
                    <Ionicons name="person-outline" size={20} color={colors.primaryDark} style={styles.inputIcon} />
                    <TextInput
                      style={styles.inputField}
                      value={fullName}
                      onChangeText={setFullName}
                      placeholder={i18n.t('enter_full_name')}
                      placeholderTextColor={colors.placeholder}
                      autoCapitalize="words"
                    />
                  </View>
                </>
              )}

              <Text style={styles.labelCaps}>{i18n.t('phone_number')}</Text>
              <View style={styles.inputRow}>
                <Ionicons name="call-outline" size={20} color={colors.primaryDark} style={styles.inputIcon} />
                <TextInput
                  style={styles.inputField}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder={i18n.t('enter_phone')}
                  placeholderTextColor={colors.placeholder}
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.passwordLabelRow}>
                <Text style={styles.labelCapsInline}>{i18n.t('auth_password')}</Text>
              </View>
              <View style={styles.inputRow}>
                <Ionicons name="lock-closed-outline" size={20} color={colors.primaryDark} style={styles.inputIcon} />
                <TextInput
                  style={styles.inputField}
                  value={password}
                  onChangeText={setPassword}
                  placeholder={i18n.t('auth_placeholder_password')}
                  placeholderTextColor={colors.placeholder}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword((p) => !p)} style={styles.eyeBtn}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.primaryDark} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={[styles.primaryBtn, busy && styles.btnDisabled]} onPress={onSubmit} disabled={busy}>
                {busy ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <View style={styles.primaryBtnInner}>
                    <Text style={styles.primaryBtnText}>
                      {mode === 'signIn' ? i18n.t('auth_sign_in') : i18n.t('auth_sign_up')}
                    </Text>
                    <Ionicons name="arrow-forward" size={20} color={colors.white} />
                  </View>
                )}
              </TouchableOpacity>
            </View>

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
                <Ionicons name="help-circle-outline" size={22} color={colors.primaryDark} />
                <Text style={styles.helpLabel}>{i18n.t('auth_help')}</Text>
              </TouchableOpacity>
              <LanguageToggle
                onToggle={refreshLocale}
                buttonStyle={styles.langBtn}
                textStyle={styles.langBtnText}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>

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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  gradient: { flex: 1 },
  flex: { flex: 1 },
  scroll: {
    paddingHorizontal: ios.spacing.lg,
    paddingBottom: ios.spacing.xxl,
    paddingTop: ios.spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: ios.spacing.lg,
  },
  headerSide: { width: 72 },
  brandCenter: {
    fontSize: ios.fontSize.title2,
    fontWeight: ios.fontWeight.bold,
    color: colors.text,
    letterSpacing: -0.3,
  },
  brandAccent: {
    color: colors.primary,
  },
  heroTitle: {
    fontSize: ios.fontSize.title1,
    fontWeight: ios.fontWeight.bold,
    color: colors.text,
    marginBottom: ios.spacing.sm,
    letterSpacing: -0.5,
  },
  heroSub: {
    fontSize: ios.fontSize.subhead,
    color: colors.placeholder,
    lineHeight: 22,
    marginBottom: ios.spacing.xl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: ios.radius.xxl,
    padding: ios.spacing.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...Platform.select({
      ios: {
        shadowColor: colors.logoDark,
        shadowOpacity: 0.12,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 6 },
      },
      android: { elevation: 4 },
    }),
  },
  labelCaps: {
    fontSize: 11,
    fontWeight: ios.fontWeight.semibold,
    color: colors.primaryDark,
    letterSpacing: 0.8,
    marginBottom: ios.spacing.sm,
    textTransform: 'uppercase',
  },
  labelCapsInline: {
    fontSize: 11,
    fontWeight: ios.fontWeight.semibold,
    color: colors.primaryDark,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: ios.radius.lg,
    paddingHorizontal: ios.spacing.md,
    marginBottom: ios.spacing.md,
    minHeight: 48,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  inputIcon: { marginRight: ios.spacing.sm },
  inputField: {
    flex: 1,
    fontSize: ios.fontSize.body,
    color: colors.text,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
  },
  eyeBtn: { padding: ios.spacing.xs },
  passwordLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: ios.spacing.sm,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: ios.radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: ios.spacing.sm,
    minHeight: 50,
  },
  primaryBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  primaryBtnText: {
    color: colors.white,
    fontWeight: ios.fontWeight.semibold,
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
    color: colors.placeholder,
  },
  switchLink: {
    fontSize: ios.fontSize.subhead,
    fontWeight: ios.fontWeight.bold,
    color: colors.primaryDark,
  },
  legal: {
    fontSize: ios.fontSize.caption,
    color: colors.placeholder,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: ios.spacing.xl,
    paddingHorizontal: ios.spacing.sm,
  },
  legalLink: {
    color: colors.primaryDark,
    fontWeight: ios.fontWeight.semibold,
    textDecorationLine: 'underline',
  },
  footerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: ios.spacing.sm,
  },
  helpBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  helpLabel: {
    fontSize: 11,
    fontWeight: ios.fontWeight.bold,
    color: colors.primaryDark,
    letterSpacing: 0.6,
  },
  langBtn: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
  },
  langBtnText: {
    color: colors.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: ios.spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    height: '80%',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 20, shadowOffset: { width: 0, height: 4 } },
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
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: ios.fontSize.title3,
    fontWeight: ios.fontWeight.bold,
    color: colors.text,
  },
  modalClose: {
    fontSize: ios.fontSize.body,
    color: colors.primaryDark,
    fontWeight: ios.fontWeight.semibold,
  },
  modalScroll: { flex: 1, minHeight: 0 },
  modalScrollContent: { padding: ios.spacing.lg, paddingBottom: ios.spacing.xxl },
  modalBody: {
    fontSize: ios.fontSize.footnote,
    color: colors.text,
    lineHeight: 22,
  },
});
