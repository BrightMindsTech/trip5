import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import i18n from '../i18n';
import { colors } from '../theme';

export default function ConfirmationScreen({
  order,
  orderDate,
  goBack,
  submit,
  isSubmitting,
  submitError,
  orderSent,
  resetOrder,
}) {
  if (orderSent) {
    return (
      <View style={styles.container}>
        <Text style={styles.successIcon}>✓</Text>
        <Text style={styles.successTitle}>{i18n.t('order_sent')}</Text>
        <Text style={styles.successDesc}>{i18n.t('order_sent_desc')}</Text>
        <TouchableOpacity style={styles.button} onPress={resetOrder}>
          <Text style={styles.buttonText}>{i18n.t('new_order')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const routeText =
    order.route === 'irbid_to_amman' ? i18n.t('route_irbid_to_amman') : i18n.t('route_amman_to_irbid');
  const serviceText = getServiceText();

  function getServiceText() {
    const s = order.service;
    if (!s) return '';
    if (s.type === 'basic') return `${i18n.t('service_basic')} - 5 ${i18n.t('jod')}`;
    if (s.type === 'private') {
      const party =
        typeof s.alone === 'boolean' ? (s.alone ? i18n.t('alone') : i18n.t('family')) : null;
      return party
        ? `${i18n.t('service_private')} - 15 ${i18n.t('jod')} (${party})`
        : `${i18n.t('service_private')} - 15 ${i18n.t('jod')}`;
    }
    if (s.type === 'airport') {
      const price = ['airport_to_irbid', 'irbid_to_airport'].includes(order.route) ? 25 : 15;
      return `${i18n.t('service_airport')} - ${price} ${i18n.t('jod')} (${s.toAirport ? i18n.t('to_airport') : i18n.t('from_airport')})`;
    }
    if (s.type === 'instant') return `${i18n.t('service_instant')}: ${s.description}`;
    return '';
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{i18n.t('order_summary')}</Text>
      <SummaryRow label="Route" value={routeText} />
      <SummaryRow
        label="Date & Time"
        value={`${orderDate.toLocaleDateString()} ${orderDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
      />
      <SummaryRow label="Service" value={serviceText} />
      <SummaryRow label={i18n.t('pickup_location')} value={order.pickup?.address || ''} />
      <SummaryRow label={i18n.t('destination')} value={order.destination?.address || ''} />
      <SummaryRow label={i18n.t('full_name')} value={order.fullName} />
      <SummaryRow label={i18n.t('phone_number')} value={order.phoneNumber} />

      {submitError && (
        <View style={styles.errorBox}>
          <Text style={styles.error}>{submitError}</Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.button, isSubmitting && styles.buttonDisabled]}
        onPress={submit}
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.buttonText}>{i18n.t('submit_order')}</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

function SummaryRow({ label, value }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 24, paddingTop: 48, paddingBottom: 48 },
  title: { fontSize: 22, fontWeight: '600', marginBottom: 24, color: colors.text },
  row: {
    backgroundColor: colors.primaryLight,
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowLabel: { fontSize: 12, color: colors.textSecondary, marginBottom: 4 },
  rowValue: { fontSize: 16, color: colors.text },
  errorBox: { backgroundColor: colors.errorBg, padding: 12, borderRadius: 8, marginBottom: 16 },
  error: { color: colors.error, fontSize: 14 },
  button: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: colors.white, fontSize: 18, fontWeight: '600' },
  successIcon: { fontSize: 64, color: colors.primary, textAlign: 'center', marginTop: 80 },
  successTitle: { fontSize: 24, fontWeight: '600', textAlign: 'center', marginTop: 24, color: colors.text },
  successDesc: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 12,
    paddingHorizontal: 24,
  },
});
