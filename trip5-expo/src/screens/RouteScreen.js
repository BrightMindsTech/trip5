import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import i18n from '../i18n';
import { useTheme } from '../context/ThemeContext';

function createStyles(colors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      padding: 24,
      paddingTop: 48,
      backgroundColor: colors.background,
    },
    title: {
      fontSize: 24,
      fontWeight: '700',
      marginBottom: 20,
      textAlign: 'center',
      color: colors.text,
      letterSpacing: 0.2,
    },
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 18,
      paddingHorizontal: 18,
      borderRadius: 12,
      marginBottom: 14,
      shadowColor: '#0B1220',
      shadowOpacity: 0.06,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 6 },
      elevation: 2,
    },
    cardSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primaryLight,
      shadowOpacity: 0.12,
      elevation: 4,
    },
    cardRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    cardRowArabic: {
      flexDirection: 'row-reverse',
    },
    titleStack: { flex: 1, alignItems: 'center' },
    cardTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      textAlign: 'center',
    },
    cardTitleSelected: {
      color: colors.text,
    },
    checkWrap: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.checkBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    check: {
      color: colors.white,
      fontSize: 18,
      fontWeight: '800',
      lineHeight: 18,
    },
    subtitle: {
      marginTop: 6,
      fontSize: 12,
      color: colors.primary,
      fontWeight: '700',
      textAlign: 'center',
      lineHeight: 16,
    },
    button: {
      backgroundColor: colors.primary,
      paddingVertical: 16,
      paddingHorizontal: 18,
      borderRadius: 12,
      marginTop: 'auto',
      alignItems: 'center',
      shadowColor: '#0B1220',
      shadowOpacity: 0.1,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 8 },
      elevation: 3,
    },
    buttonDisabled: {
      backgroundColor: colors.disabled,
      shadowOpacity: 0,
      elevation: 0,
    },
    buttonText: {
      color: colors.white,
      fontSize: 18,
      fontWeight: '700',
      letterSpacing: 0.2,
    },
    cardRowGrid: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
    },
    cardRowGridArabic: {
      flexDirection: 'row-reverse',
    },
    cardGridItem: {
      flex: 1,
    },
  });
}

export default function RouteScreen({ order, updateOrder, goNext, canProceed }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isArabic = i18n.locale === 'ar';

  const RouteCard = ({ title, subtitle, route, isSelected }) => (
    <TouchableOpacity
      style={[styles.card, isSelected && styles.cardSelected]}
      onPress={() => updateOrder({ route })}
      activeOpacity={0.9}
      hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
    >
      <View style={[styles.cardRow, isArabic && styles.cardRowArabic]}>
        <View style={styles.titleStack}>
          <Text style={[styles.cardTitle, isSelected && styles.cardTitleSelected]}>{title}</Text>
          {isSelected && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
        {isSelected && (
          <View style={styles.checkWrap}>
            <Text style={styles.check}>✓</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{i18n.t('choose_route')}</Text>
      <View style={[styles.cardRowGrid, isArabic && styles.cardRowGridArabic]}>
        <View style={styles.cardGridItem}>
          <RouteCard
            title={i18n.t('to_amman')}
            subtitle={i18n.t('from_irbid_to_amman')}
            route="irbid_to_amman"
            isSelected={order.route === 'irbid_to_amman'}
          />
        </View>
        <View style={styles.cardGridItem}>
          <RouteCard
            title={i18n.t('to_irbid')}
            subtitle={i18n.t('from_amman_to_irbid')}
            route="amman_to_irbid"
            isSelected={order.route === 'amman_to_irbid'}
          />
        </View>
      </View>
      <TouchableOpacity
        style={[styles.button, !canProceed && styles.buttonDisabled]}
        onPress={goNext}
        disabled={!canProceed}
      >
        <Text style={styles.buttonText}>{i18n.t('next')}</Text>
      </TouchableOpacity>
    </View>
  );
}
