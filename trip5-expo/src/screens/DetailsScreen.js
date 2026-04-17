import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as Location from 'expo-location';
import i18n from '../i18n';
import { useTheme } from '../context/ThemeContext';

function createDetailsStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 24, paddingTop: 48, paddingBottom: 48 },
    title: { fontSize: 22, fontWeight: '600', marginBottom: 24, color: colors.text },
    label: { fontSize: 16, fontWeight: '600', marginBottom: 8, color: colors.text },
    selectedAddress: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 8,
      padding: 8,
      backgroundColor: colors.primaryLight,
      borderRadius: 6,
    },
    locationRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
    setAddressBtn: {
      flex: 1,
      backgroundColor: colors.primary,
      padding: 14,
      borderRadius: 8,
      alignItems: 'center',
    },
    setAddressText: { color: colors.white, fontWeight: '600', fontSize: 14 },
    useLocationBtn: {
      flex: 1,
      backgroundColor: colors.primaryLight,
      padding: 14,
      borderRadius: 8,
      alignItems: 'center',
    },
    useLocationBtnText: { color: colors.primary, fontWeight: '600', fontSize: 14 },
    btnDisabled: { opacity: 0.6 },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 14,
      marginBottom: 16,
      fontSize: 16,
      backgroundColor: colors.surface,
      color: colors.text,
    },
    error: { color: colors.error, fontSize: 12, marginBottom: 12 },
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

export default function DetailsScreen({ order, updateOrder, goNext, canProceed, isValidPhone }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createDetailsStyles(colors), [colors]);
  const [pickupManualText, setPickupManualText] = useState('');
  const [destManualText, setDestManualText] = useState('');
  const [loadingPickup, setLoadingPickup] = useState(false);
  const [loadingDest, setLoadingDest] = useState(false);
  const [geocodingPickup, setGeocodingPickup] = useState(false);
  const [geocodingDest, setGeocodingDest] = useState(false);

  const fullNameError = !order.fullName.trim() ? i18n.t('error_required') : null;
  const phoneError = !order.phoneNumber
    ? i18n.t('error_required')
    : !isValidPhone(order.phoneNumber)
      ? i18n.t('error_invalid_phone')
      : null;
  const pickupError = !order.pickup ? i18n.t('error_select_location') : null;
  const destError = !order.destination ? i18n.t('error_select_location') : null;

  const getMyLocation = async (isPickup) => {
    const setLoading = isPickup ? setLoadingPickup : setLoadingDest;
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('', i18n.t('error_select_location'));
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = loc.coords;
      const [addr] = await Location.reverseGeocodeAsync({ latitude, longitude });
      const addressStr = addr
        ? [addr.street, addr.city, addr.region, addr.country].filter(Boolean).join(', ') ||
          `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
        : `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
      const result = { latitude, longitude, address: addressStr };
      if (isPickup) {
        updateOrder({ pickup: result });
        setPickupManualText(addressStr);
      } else {
        updateOrder({ destination: result });
        setDestManualText(addressStr);
      }
    } catch {
      Alert.alert('', i18n.t('error_select_location'));
    } finally {
      setLoading(false);
    }
  };

  const setAddressFromText = async (isPickup) => {
    const text = isPickup ? pickupManualText.trim() : destManualText.trim();
    if (!text) {
      Alert.alert('', i18n.t('error_select_location'));
      return;
    }
    const setGeocoding = isPickup ? setGeocodingPickup : setGeocodingDest;
    setGeocoding(true);
    try {
      const results = await Location.geocodeAsync(text);
      if (!results || results.length === 0) {
        Alert.alert('', i18n.t('error_geocode_failed'));
        return;
      }
      const { latitude, longitude } = results[0];
      const result = { latitude, longitude, address: text };
      if (isPickup) {
        updateOrder({ pickup: result });
      } else {
        updateOrder({ destination: result });
      }
    } catch {
      Alert.alert('', i18n.t('error_geocode_failed'));
    } finally {
      setGeocoding(false);
    }
  };


  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={100}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>{i18n.t('your_details')}</Text>

        <Text style={styles.label}>{i18n.t('pickup_location')}</Text>
        <TextInput
          style={styles.input}
          placeholder={i18n.t('enter_address')}
          value={pickupManualText}
          onChangeText={setPickupManualText}
          placeholderTextColor={colors.placeholder}
        />
        <View style={styles.locationRow}>
          <TouchableOpacity
            style={[styles.setAddressBtn, geocodingPickup && styles.btnDisabled]}
            onPress={() => setAddressFromText(true)}
            disabled={geocodingPickup}
          >
            {geocodingPickup ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={styles.setAddressText}>{i18n.t('set_address')}</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.useLocationBtn, loadingPickup && styles.btnDisabled]}
            onPress={() => getMyLocation(true)}
            disabled={loadingPickup}
          >
            {loadingPickup ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={styles.useLocationBtnText}>{i18n.t('use_my_location')}</Text>
            )}
          </TouchableOpacity>
        </View>
        {order.pickup && (
          <Text style={styles.selectedAddress}>{order.pickup.address}</Text>
        )}
        {pickupError && <Text style={styles.error}>{pickupError}</Text>}

        <Text style={styles.label}>{i18n.t('destination')}</Text>
        <TextInput
          style={styles.input}
          placeholder={i18n.t('enter_address')}
          value={destManualText}
          onChangeText={setDestManualText}
          placeholderTextColor={colors.placeholder}
        />
        <View style={styles.locationRow}>
          <TouchableOpacity
            style={[styles.setAddressBtn, geocodingDest && styles.btnDisabled]}
            onPress={() => setAddressFromText(false)}
            disabled={geocodingDest}
          >
            {geocodingDest ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={styles.setAddressText}>{i18n.t('set_address')}</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.useLocationBtn, loadingDest && styles.btnDisabled]}
            onPress={() => getMyLocation(false)}
            disabled={loadingDest}
          >
            {loadingDest ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={styles.useLocationBtnText}>{i18n.t('use_my_location')}</Text>
            )}
          </TouchableOpacity>
        </View>
        {order.destination && (
          <Text style={styles.selectedAddress}>{order.destination.address}</Text>
        )}
        {destError && <Text style={styles.error}>{destError}</Text>}

        <Text style={styles.label}>{i18n.t('full_name')}</Text>
        <TextInput
          style={styles.input}
          placeholder={i18n.t('enter_full_name')}
          placeholderTextColor={colors.placeholder}
          value={order.fullName}
          onChangeText={(t) => updateOrder({ fullName: t })}
        />
        {fullNameError && <Text style={styles.error}>{fullNameError}</Text>}

        <Text style={styles.label}>{i18n.t('phone_number')}</Text>
        <TextInput
          style={styles.input}
          placeholder={i18n.t('enter_phone')}
          placeholderTextColor={colors.placeholder}
          value={order.phoneNumber}
          onChangeText={(t) => updateOrder({ phoneNumber: t })}
          keyboardType="phone-pad"
        />
        {phoneError && <Text style={styles.error}>{phoneError}</Text>}

        <TouchableOpacity
          style={[styles.button, !canProceed && styles.buttonDisabled]}
          onPress={goNext}
          disabled={!canProceed}
        >
          <Text style={styles.buttonText}>{i18n.t('next')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
