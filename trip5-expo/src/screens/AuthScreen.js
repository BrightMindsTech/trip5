import React, { useState } from 'react';
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
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { colors, ios } from '../theme';
import i18n from '../i18n';

export default function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    if (!email.trim() || !password) {
      Alert.alert('', i18n.t('error_required'));
      return;
    }
    setBusy(true);
    try {
      if (mode === 'signIn') {
        await signIn(email, password);
      } else {
        if (!fullName.trim() || !phone.trim()) {
          Alert.alert('', i18n.t('profile_required_hint'));
          setBusy(false);
          return;
        }
        await signUp(email, password, fullName, phone);
      }
    } catch (e) {
      Alert.alert('', e.message || 'Auth failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Trip5</Text>
        <Text style={styles.sub}>{mode === 'signIn' ? i18n.t('auth_sign_in') : i18n.t('auth_create_account')}</Text>

        {mode === 'signUp' && (
          <>
            <Text style={styles.label}>{i18n.t('full_name')}</Text>
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder={i18n.t('enter_full_name')}
              autoCapitalize="words"
            />
            <Text style={styles.label}>{i18n.t('phone_number')}</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="+962 7X XXX XXXX"
              keyboardType="phone-pad"
            />
          </>
        )}

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <Text style={styles.label}>{i18n.t('auth_password')}</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          secureTextEntry
        />

        <TouchableOpacity style={[styles.btn, busy && styles.btnDisabled]} onPress={onSubmit} disabled={busy}>
          {busy ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.btnText}>{mode === 'signIn' ? i18n.t('auth_sign_in') : i18n.t('auth_sign_up')}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.switchMode}
          onPress={() => setMode(mode === 'signIn' ? 'signUp' : 'signIn')}
          disabled={busy}
        >
          <Text style={styles.switchText}>
            {mode === 'signIn' ? i18n.t('auth_need_account') : i18n.t('auth_have_account')}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: ios.spacing.lg, paddingTop: 48 },
  title: { fontSize: 28, fontWeight: '700', color: colors.primary, marginBottom: 8 },
  sub: { fontSize: ios.fontSize.body, color: colors.textSecondary, marginBottom: 24 },
  label: { fontSize: 13, color: colors.textSecondary, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: ios.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: ios.fontSize.body,
    color: colors.text,
    marginBottom: 16,
    backgroundColor: colors.surface,
  },
  btn: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: ios.radius.md,
    alignItems: 'center',
    marginTop: 8,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: colors.white, fontWeight: '600', fontSize: ios.fontSize.body },
  switchMode: { marginTop: 20, alignItems: 'center' },
  switchText: { color: colors.primary, fontSize: ios.fontSize.subhead },
});
