import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView } from 'react-native';
import i18n from '../i18n';
import { useTheme } from '../context/ThemeContext';

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 24, paddingTop: 48, paddingBottom: 48 },
    title: { fontSize: 22, fontWeight: '600', marginBottom: 24, textAlign: 'center', color: colors.text },
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 20,
      borderRadius: 12,
      marginBottom: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    cardSelected: { backgroundColor: colors.primaryLight, borderColor: colors.primary, borderWidth: 1 },
    cardTitle: { fontSize: 18, fontWeight: '600', color: colors.text },
    cardTitleSelected: { color: colors.text },
    cardSubtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },
    cardSubtitleSelected: { color: colors.textSecondary },
    price: { fontSize: 18, fontWeight: '600', color: colors.primary },
    priceSelected: { color: colors.primary },
    check: { color: colors.primary, fontSize: 20 },
    subOptions: { flexDirection: 'row', gap: 12, marginBottom: 16, marginLeft: 8 },
    subBtn: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      backgroundColor: colors.border,
      borderRadius: 8,
    },
    subBtnSelected: { backgroundColor: colors.primary },
    subBtnText: { color: colors.text },
    subBtnTextSelected: { color: colors.white, fontWeight: '600' },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      marginBottom: 16,
      minHeight: 80,
      textAlignVertical: 'top',
      backgroundColor: colors.surface,
      color: colors.text,
    },
    button: {
      backgroundColor: colors.primary,
      padding: 16,
      borderRadius: 12,
      marginTop: 16,
      alignItems: 'center',
    },
    buttonDisabled: { backgroundColor: colors.disabled },
    buttonText: { color: colors.white, fontSize: 18, fontWeight: '600' },
  });
}

export default function ServiceScreen({ order, updateOrder, goNext, canProceed }) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [showPrivate, setShowPrivate] = useState(false);
  const [showAirport, setShowAirport] = useState(false);
  const [showInstant, setShowInstant] = useState(false);
  const [instantDesc, setInstantDesc] = useState(order.service?.description || '');

  const airportPrice = order.route === 'irbid_to_amman' ? 25 : 15;

  const ServiceCard = ({ title, subtitle, price, onPress, isSelected }) => (
    <TouchableOpacity
      style={[styles.card, isSelected && styles.cardSelected]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View>
        <Text style={[styles.cardTitle, isSelected && styles.cardTitleSelected]}>{title}</Text>
        <Text style={[styles.cardSubtitle, isSelected && styles.cardSubtitleSelected]}>
          {subtitle}
        </Text>
      </View>
      {price != null && (
        <Text style={[styles.price, isSelected && styles.priceSelected]}>{price} {i18n.t('jod')}</Text>
      )}
      {isSelected && <Text style={styles.check}>✓</Text>}
    </TouchableOpacity>
  );

  const setService = (service) => {
    updateOrder({ service });
    if (service?.type === 'instant') setInstantDesc(service.description || '');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{i18n.t('choose_service')}</Text>

      <ServiceCard
        title={i18n.t('service_basic')}
        subtitle={i18n.t('service_basic_desc')}
        price={5}
        onPress={() => {
          setService({ type: 'basic' });
          setShowPrivate(false);
          setShowAirport(false);
          setShowInstant(false);
        }}
        isSelected={order.service?.type === 'basic'}
      />

      <ServiceCard
        title={i18n.t('service_private')}
        subtitle={i18n.t('service_private_desc')}
        price={15}
        onPress={() => {
          setShowPrivate(true);
          setShowAirport(false);
          setShowInstant(false);
        }}
        isSelected={order.service?.type === 'private'}
      />
      {showPrivate && (
        <View style={styles.subOptions}>
          <TouchableOpacity
            style={[styles.subBtn, order.service?.alone && styles.subBtnSelected]}
            onPress={() => setService({ type: 'private', alone: true })}
          >
            <Text style={order.service?.alone ? styles.subBtnTextSelected : styles.subBtnText}>
              {i18n.t('alone')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.subBtn, order.service?.alone === false && styles.subBtnSelected]}
            onPress={() => setService({ type: 'private', alone: false })}
          >
            <Text style={order.service?.alone === false ? styles.subBtnTextSelected : styles.subBtnText}>
              {i18n.t('family')}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <ServiceCard
        title={i18n.t('service_airport')}
        subtitle={i18n.t('service_airport_desc')}
        price={airportPrice}
        onPress={() => {
          setShowAirport(true);
          setShowPrivate(false);
          setShowInstant(false);
        }}
        isSelected={order.service?.type === 'airport'}
      />
      {showAirport && (
        <View style={styles.subOptions}>
          <TouchableOpacity
            style={[styles.subBtn, order.service?.toAirport && styles.subBtnSelected]}
            onPress={() => setService({ type: 'airport', toAirport: true })}
          >
            <Text style={order.service?.toAirport ? styles.subBtnTextSelected : styles.subBtnText}>
              {i18n.t('to_airport')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.subBtn, order.service?.toAirport === false && styles.subBtnSelected]}
            onPress={() => setService({ type: 'airport', toAirport: false })}
          >
            <Text style={order.service?.toAirport === false ? styles.subBtnTextSelected : styles.subBtnText}>
              {i18n.t('from_airport')}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <ServiceCard
        title={i18n.t('service_instant')}
        subtitle={i18n.t('service_instant_desc')}
        price={null}
        onPress={() => {
          setShowInstant(true);
          setShowPrivate(false);
          setShowAirport(false);
        }}
        isSelected={order.service?.type === 'instant'}
      />
      {showInstant && (
        <TextInput
          style={styles.input}
          placeholder={i18n.t('enter_description')}
          placeholderTextColor={isDark ? colors.textMuted : colors.placeholder}
          value={instantDesc}
          onChangeText={(t) => {
            setInstantDesc(t);
            setService({ type: 'instant', description: t });
          }}
          multiline
        />
      )}

      <TouchableOpacity
        style={[styles.button, !canProceed && styles.buttonDisabled]}
        onPress={goNext}
        disabled={!canProceed}
      >
        <Text style={styles.buttonText}>{i18n.t('next')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
