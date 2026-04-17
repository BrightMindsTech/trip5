import React, { useMemo } from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import i18n, { setLanguage } from '../i18n';
import { ios } from '../theme';
import { useTheme } from '../context/ThemeContext';

function createStyles(colors) {
  return StyleSheet.create({
    btn: {
      paddingHorizontal: ios.spacing.md,
      paddingVertical: ios.spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: 20,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    btnPressed: { opacity: 0.7 },
    text: {
      color: colors.primary,
      fontWeight: ios.fontWeight.semibold,
      fontSize: ios.fontSize.footnote,
    },
  });
}

export default function LanguageToggle({ onToggle, textStyle, buttonStyle }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isArabic = i18n.locale === 'ar';
  const toggle = async () => {
    const next = isArabic ? 'en' : 'ar';
    await setLanguage(next);
    onToggle?.();
  };
  return (
    <Pressable
      onPress={toggle}
      style={({ pressed }) => [styles.btn, buttonStyle, pressed && styles.btnPressed]}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
    >
      <Text style={[styles.text, textStyle]}>{isArabic ? 'English' : 'العربية'}</Text>
    </Pressable>
  );
}
