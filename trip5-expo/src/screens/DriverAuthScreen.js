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
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { Config } from '../config';
import { colors, ios } from '../theme';
import i18n from '../i18n';
import LanguageToggle from '../components/LanguageToggle';
import { isValidJordanPhone } from '../utils/phoneAuth';

/** +962 77 218 2987 style from E.164-ish string */
function formatContactForDisplay(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('962') && digits.length >= 12) {
    const rest = digits.slice(3);
    return `+962 ${rest.slice(0, 2)} ${rest.slice(2, 5)} ${rest.slice(5)}`;
  }
  return phone;
}

export default function DriverAuthScreen({ onBack }) {
  const { signIn } = useAuth();
  const [step, setStep] = useState('menu');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [localeTick, setLocaleTick] = useState(0);

  const contact = Config.driverRegistrationPhone;
  const contactDigits = contact.replace(/\D/g, '');
  const displayPhone = formatContactForDisplay(contact);

  const refreshLocale = useCallback(() => {
    setLocaleTick((n) => n + 1);
  }, []);

  const openCall = () => {
    Linking.openURL(`tel:+${contactDigits}`).catch(() => {});
  };

  const openWhatsApp = () => {
    Linking.openURL(`https://wa.me/${contactDigits}`).catch(() => {});
  };

  const onLogin = async () => {
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
      await signIn(phone, password);
    } catch (e) {
      Alert.alert('', e.message || 'Auth failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <LinearGradient
        colors={['#EEF2FF', colors.background, colors.background]}
        locations={[0, 0.35, 1]}
        style={styles.gradient}
      >
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            key={localeTick}
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <TouchableOpacity style={styles.backRow} onPress={step === 'menu' ? onBack : () => setStep('menu')} hitSlop={12}>
              <Ionicons name="chevron-back" size={22} color={colors.primaryDark} style={{ marginRight: 4 }} />
              <Text style={styles.backText}>{step === 'menu' ? i18n.t('driver_auth_back_passenger') : i18n.t('driver_auth_back')}</Text>
            </TouchableOpacity>

            <View style={styles.headerRow}>
              <Ionicons name="car-outline" size={36} color={colors.primary} />
            </View>

            {step === 'menu' && (
              <>
                <Text style={styles.heroTitle}>{i18n.t('driver_auth_title')}</Text>
                <Text style={styles.heroSub}>{i18n.t('driver_auth_menu_sub')}</Text>

                <TouchableOpacity style={styles.primaryBtn} onPress={() => setStep('login')} activeOpacity={0.85}>
                  <Ionicons name="log-in-outline" size={22} color={colors.white} style={styles.btnIcon} />
                  <Text style={styles.primaryBtnText}>{i18n.t('driver_auth_login')}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.secondaryBtn} onPress={() => setStep('signup')} activeOpacity={0.85}>
                  <Ionicons name="person-add-outline" size={22} color={colors.primaryDark} style={styles.btnIcon} />
                  <Text style={styles.secondaryBtnText}>{i18n.t('driver_auth_signup')}</Text>
                </TouchableOpacity>
              </>
            )}

            {step === 'signup' && (
              <View style={styles.card}>
                <Text style={styles.heroTitle}>{i18n.t('driver_auth_signup_title')}</Text>
                <Text style={styles.signupBody}>{i18n.t('driver_auth_signup_body')}</Text>
                <Text style={styles.phoneHuge} selectable>
                  {displayPhone}
                </Text>
                <View style={styles.contactActions}>
                  <TouchableOpacity style={styles.contactBtn} onPress={openCall}>
                    <Ionicons name="call" size={20} color={colors.white} style={styles.contactBtnIcon} />
                    <Text style={styles.contactBtnText}>{i18n.t('driver_auth_call')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.contactBtn, styles.waBtn]} onPress={openWhatsApp}>
                    <Ionicons name="logo-whatsapp" size={20} color={colors.white} style={styles.contactBtnIcon} />
                    <Text style={styles.contactBtnText}>{i18n.t('driver_auth_whatsapp')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {step === 'login' && (
              <>
                <Text style={styles.heroTitle}>{i18n.t('driver_auth_login_title')}</Text>
                <Text style={styles.heroSub}>{i18n.t('driver_auth_login_sub')}</Text>
                <View style={styles.card}>
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
                  <TouchableOpacity style={[styles.primaryBtn, busy && styles.btnDisabled]} onPress={onLogin} disabled={busy}>
                    {busy ? (
                      <ActivityIndicator color={colors.white} />
                    ) : (
                      <View style={styles.primaryBtnInner}>
                        <Text style={styles.primaryBtnText}>{i18n.t('auth_sign_in')}</Text>
                        <Ionicons name="arrow-forward" size={20} color={colors.white} style={{ marginLeft: 8 }} />
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}

            <View style={styles.footerBar}>
              <View style={{ width: 40 }} />
              <LanguageToggle onToggle={refreshLocale} buttonStyle={styles.langBtn} textStyle={styles.langBtnText} />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
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
    paddingTop: ios.spacing.sm,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: ios.spacing.md,
  },
  backText: {
    fontSize: ios.fontSize.body,
    fontWeight: ios.fontWeight.semibold,
    color: colors.primaryDark,
  },
  headerRow: { alignItems: 'center', marginBottom: ios.spacing.md },
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
  signupBody: {
    fontSize: ios.fontSize.body,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: ios.spacing.lg,
  },
  phoneHuge: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.primary,
    textAlign: 'center',
    marginBottom: ios.spacing.lg,
    letterSpacing: 0.5,
  },
  contactActions: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap' },
  btnIcon: { marginRight: 8 },
  contactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 5,
    marginBottom: 8,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: ios.radius.lg,
  },
  waBtn: { backgroundColor: '#25D366' },
  contactBtnText: { color: colors.white, fontWeight: '700', fontSize: 15 },
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
  contactBtnIcon: { marginRight: 8 },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: ios.radius.lg,
    paddingVertical: 16,
    marginTop: ios.spacing.sm,
    minHeight: 52,
  },
  primaryBtnInner: { flexDirection: 'row', alignItems: 'center' },
  primaryBtnText: {
    color: colors.white,
    fontWeight: ios.fontWeight.semibold,
    fontSize: ios.fontSize.body,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: ios.radius.lg,
    paddingVertical: 16,
    marginTop: ios.spacing.md,
    minHeight: 52,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  secondaryBtnText: {
    color: colors.primaryDark,
    fontWeight: ios.fontWeight.semibold,
    fontSize: ios.fontSize.body,
  },
  btnDisabled: { opacity: 0.55 },
  footerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingTop: ios.spacing.xl,
  },
  langBtn: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
  },
  langBtnText: { color: colors.primary },
});
