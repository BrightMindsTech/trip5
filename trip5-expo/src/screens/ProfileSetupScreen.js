import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { colors, ios } from '../theme';
import i18n from '../i18n';

export default function ProfileSetupScreen() {
  const { profile, updateProfile } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setFullName(profile?.full_name || '');
    setPhone(profile?.phone || '');
  }, [profile?.full_name, profile?.phone]);

  const save = async () => {
    if (!fullName.trim() || !phone.trim()) {
      Alert.alert('', i18n.t('profile_required_hint'));
      return;
    }
    setBusy(true);
    try {
      await updateProfile({ full_name: fullName.trim(), phone: phone.trim() });
    } catch (e) {
      Alert.alert('', e.message || 'Failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <Text style={styles.title}>{i18n.t('profile_setup_title')}</Text>
      <Text style={styles.sub}>{i18n.t('profile_setup_sub')}</Text>
      <Text style={styles.label}>{i18n.t('full_name')}</Text>
      <TextInput style={styles.input} value={fullName} onChangeText={setFullName} placeholder={i18n.t('enter_full_name')} />
      <Text style={styles.label}>{i18n.t('phone_number')}</Text>
      <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="+962 7X XXX XXXX" keyboardType="phone-pad" />
      <TouchableOpacity style={[styles.btn, busy && styles.btnDisabled]} onPress={save} disabled={busy}>
        {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.btnText}>{i18n.t('confirm')}</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: ios.spacing.lg, paddingTop: 48, backgroundColor: colors.background },
  title: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: 8 },
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
  btnText: { color: colors.white, fontWeight: '600' },
});
