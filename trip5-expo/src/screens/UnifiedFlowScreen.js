import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Animated,
  ActivityIndicator,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Modal,
  Alert,
  ImageBackground,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Location from 'expo-location';
import i18n from '../i18n';
import { colors, ios } from '../theme';
import EmbeddedTripMap from '../components/EmbeddedTripMap';
import { useAuth } from '../context/AuthContext';
import { TERMS_AND_PRIVACY_TEXT } from '../legal/termsPrivacyText';

const AMMAN_PHOTO = require('../../assets/amman-photo.png');
const IRBID_PHOTO = require('../../assets/irbid-photo.png');
const AIRPORT_PHOTO = require('../../assets/airport-photo.png');

const HOLD_DURATION = 140;
const FADE_DURATION = 260;

export default function UnifiedFlowScreen({
  order,
  updateOrder,
  goNext,
  goBack,
  currentStep,
  canProceedFromRoute,
  canProceedFromLocations,
  canProceedFromServiceSchedule,
  scheduleStep,
  setScheduleStep,
  orderDate,
  isSubmitting,
  submitError,
  orderSent,
  submit,
  resetOrder,
  onExitAfterSuccess,
  exitAfterSuccessLabel,
  initialOpenAirportModal = false,
}) {
  const isArabic = i18n.locale === 'ar';
  const { profile } = useAuth();
  const [mapMode, setMapMode] = useState('pickup');
  const [isSaving, setIsSaving] = useState(false);
  const [contentOpacity] = useState(() => new Animated.Value(1));
  const [contentScale] = useState(() => new Animated.Value(1));
  const animationRef = useRef(null);
  const currentStepRef = useRef(currentStep);
  currentStepRef.current = currentStep;

  useEffect(() => {
    if (animationRef.current) {
      animationRef.current.stop();
    }
    contentOpacity.setValue(1);
    contentScale.setValue(1);
    setIsSaving(false);
  }, [currentStep]);

  const LOADING_PHRASES = [
    'loading_phrase_1', 'loading_phrase_2', 'loading_phrase_3', 'loading_phrase_4',
    'loading_phrase_5', 'loading_phrase_6', 'loading_phrase_7',
  ];
  const [displayedPhraseIndex, setDisplayedPhraseIndex] = useState(0);
  const phraseOpacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!isSubmitting) return;
    setDisplayedPhraseIndex(0);
    phraseOpacity.setValue(1);
    const interval = setInterval(() => {
      Animated.timing(phraseOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setDisplayedPhraseIndex((i) => (i + 1) % LOADING_PHRASES.length);
        Animated.timing(phraseOpacity, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }).start();
      });
    }, 3200);
    return () => clearInterval(interval);
  }, [isSubmitting]);

  useEffect(() => {
    return () => {
      if (animationRef.current) {
        animationRef.current.stop();
      }
    };
  }, []);

  useEffect(() => {
    if (currentStep !== 1) {
      setAirportFlowStep(null);
      setShowAirportModal(false);
    }
  }, [currentStep]);

  const QUEEN_ALIA = {
    latitude: 31.7225,
    longitude: 35.9933,
    address: i18n.t('queen_alia_airport'),
  };

  useEffect(() => {
    if (currentStep !== 2) return;
    const r = order.route;
    if (['airport_to_amman', 'airport_to_irbid'].includes(r)) {
      updateOrder({ pickup: QUEEN_ALIA });
    } else if (['amman_to_airport', 'irbid_to_airport'].includes(r)) {
      updateOrder({ destination: QUEEN_ALIA });
    }
  }, [currentStep, order.route]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [pendingDate, setPendingDate] = useState(null);
  const [pendingTime, setPendingTime] = useState(null);
  const [pickupManualText, setPickupManualText] = useState('');
  const [destManualText, setDestManualText] = useState('');
  const [loadingPickup, setLoadingPickup] = useState(false);
  const [loadingDest, setLoadingDest] = useState(false);
  const [geocodingPickup, setGeocodingPickup] = useState(false);
  const [geocodingDest, setGeocodingDest] = useState(false);
  const [instantDesc, setInstantDesc] = useState(order.service?.description || '');
  const [showPrivate, setShowPrivate] = useState(false);
  const [showInstant, setShowInstant] = useState(false);

  useEffect(() => {
    if (currentStep !== 3 || scheduleStep !== 'service') return;
    if (order.service?.type === 'private') setShowPrivate(true);
    if (order.service?.type === 'instant') setShowInstant(true);
  }, [currentStep, scheduleStep, order.service?.type]);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [airportFlowStep, setAirportFlowStep] = useState(null);
  const [showAirportModal, setShowAirportModal] = useState(false);
  const airportModalFromHomeRef = useRef(false);

  useEffect(() => {
    if (!initialOpenAirportModal || airportModalFromHomeRef.current) return;
    if (currentStep !== 1) return;
    airportModalFromHomeRef.current = true;
    setAirportFlowStep('from_to');
    setShowAirportModal(true);
  }, [initialOpenAirportModal, currentStep]);

  const now = new Date();
  const minDate = new Date(now);
  minDate.setHours(0, 0, 0, 0);
  const getDefaultTime = () => {
    const d = new Date();
    d.setMinutes(Math.ceil(d.getMinutes() / 30) * 30);
    d.setSeconds(0, 0);
    return d;
  };
  const scheduledDateTime =
    order.scheduledDate instanceof Date
      ? order.scheduledDate
      : new Date(order.scheduledDate || getDefaultTime());
  const displayDate = order.isToday ? now : scheduledDateTime;
  const displayTime = order.isToday ? (order.scheduledDate || getDefaultTime()) : scheduledDateTime;
  const timeToShow = displayTime instanceof Date ? displayTime : new Date(displayTime);

  const playSaveAnimation = (onComplete) => {
    const stepWhenStarted = currentStep;
    setIsSaving(true);
    contentOpacity.setValue(1);
    contentScale.setValue(1);

    if (animationRef.current) {
      animationRef.current.stop();
    }
    animationRef.current = Animated.sequence([
      Animated.spring(contentScale, {
        toValue: 1.06,
        friction: 8,
        tension: 260,
        useNativeDriver: false,
      }),
      Animated.delay(HOLD_DURATION),
      Animated.parallel([
        Animated.timing(contentOpacity, {
          toValue: 0,
          duration: FADE_DURATION,
          useNativeDriver: false,
        }),
        Animated.timing(contentScale, {
          toValue: 1.05,
          duration: FADE_DURATION,
          useNativeDriver: false,
        }),
      ]),
    ]);
    animationRef.current.start(({ finished }) => {
      animationRef.current = null;
      contentOpacity.setValue(1);
      contentScale.setValue(1);
      setIsSaving(false);
      if (finished && stepWhenStarted === currentStepRef.current) {
        onComplete?.();
      }
    });
  };

  const handleSelectOption = (saveFn) => {
    if (isSaving) return;
    saveFn();
    playSaveAnimation(() => {
      goNext();
    });
  };

  const openDatePicker = () => {
    setPendingDate(new Date(displayDate));
    setShowDatePicker(true);
  };
  const openTimePicker = () => {
    setPendingTime(new Date(timeToShow));
    setShowTimePicker(true);
  };
  const onDateChange = (e, date) => {
    if (Platform.OS === 'android') {
      if (e?.type === 'dismissed') {
        setShowDatePicker(false);
        return;
      }
      if (date) {
        const merged = new Date(date);
        merged.setHours(scheduledDateTime.getHours(), scheduledDateTime.getMinutes(), 0, 0);
        updateOrder({ scheduledDate: merged });
        setShowDatePicker(false);
      }
      return;
    }
    if (e?.type === 'dismissed') {
      setShowDatePicker(false);
      return;
    }
    if (date) setPendingDate(new Date(date));
  };
  const onTimeChange = (e, time) => {
    if (Platform.OS === 'android') {
      if (e?.type === 'dismissed') {
        setShowTimePicker(false);
        return;
      }
      if (time) {
        const merged = order.isToday ? new Date() : new Date(scheduledDateTime);
        merged.setHours(time.getHours(), time.getMinutes(), 0, 0);
        if (order.isToday && merged < now) merged.setDate(merged.getDate() + 1);
        updateOrder({ scheduledDate: merged });
        setShowTimePicker(false);
      }
      return;
    }
    if (e?.type === 'dismissed') {
      setShowTimePicker(false);
      return;
    }
    if (time) setPendingTime(new Date(time));
  };
  const confirmDate = () => {
    if (pendingDate) {
      const merged = new Date(pendingDate);
      merged.setHours(scheduledDateTime.getHours(), scheduledDateTime.getMinutes(), 0, 0);
      updateOrder({ scheduledDate: merged });
    }
    setShowDatePicker(false);
    setPendingDate(null);
  };
  const confirmTime = () => {
    if (pendingTime) {
      const merged = order.isToday ? new Date() : new Date(scheduledDateTime);
      merged.setHours(pendingTime.getHours(), pendingTime.getMinutes(), 0, 0);
      if (order.isToday && merged < now) merged.setDate(merged.getDate() + 1);
      updateOrder({ scheduledDate: merged });
    }
    setShowTimePicker(false);
    setPendingTime(null);
  };

  const toggleAmPm = () => {
    const d = order.isToday ? new Date(displayTime) : new Date(scheduledDateTime);
    const h = d.getHours();
    const m = d.getMinutes();
    const newHour = h >= 12 ? h - 12 : h + 12;
    const merged = order.isToday ? new Date() : new Date(scheduledDateTime);
    merged.setHours(newHour, m, 0, 0);
    if (order.isToday && merged < now) merged.setDate(merged.getDate() + 1);
    updateOrder({ scheduledDate: merged });
  };

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
    const text = (isPickup ? (pickupManualText || order.pickup?.address) : (destManualText || order.destination?.address))?.trim() || '';
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
      if (isPickup) updateOrder({ pickup: result });
      else updateOrder({ destination: result });
    } catch {
      Alert.alert('', i18n.t('error_geocode_failed'));
    } finally {
      setGeocoding(false);
    }
  };

  const setService = (service) => {
    updateOrder({ service });
    if (service?.type === 'instant') setInstantDesc(service.description || '');
  };

  const getServiceText = () => {
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
  };

  const getRouteText = () => {
    const r = order.route;
    if (!r) return '';
    if (r === 'irbid_to_amman') return i18n.locale === 'ar' ? i18n.t('from_irbid_to_amman') : i18n.t('route_irbid_to_amman');
    if (r === 'amman_to_irbid') return i18n.locale === 'ar' ? i18n.t('from_amman_to_irbid') : i18n.t('route_amman_to_irbid');
    if (r === 'airport_to_amman') return i18n.t('route_airport_to_amman');
    if (r === 'airport_to_irbid') return i18n.t('route_airport_to_irbid');
    if (r === 'amman_to_airport') return i18n.t('route_amman_to_airport');
    if (r === 'irbid_to_airport') return i18n.t('route_irbid_to_airport');
    return '';
  };
  const routeText = getRouteText();

  if (orderSent) {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.successIcon}>✓</Text>
          <Text style={styles.successTitle}>{i18n.t('order_sent')}</Text>
          <Text style={styles.successDesc}>{i18n.t('order_sent_desc')}</Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => {
              if (onExitAfterSuccess) {
                onExitAfterSuccess();
              } else {
                resetOrder();
              }
            }}
          >
            <Text style={styles.primaryButtonText}>
              {exitAfterSuccessLabel || i18n.t('new_order')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 1: {
        const isAirportRoute = ['airport_to_amman', 'airport_to_irbid', 'amman_to_airport', 'irbid_to_airport'].includes(order.route);
        return (
          <ScrollView style={styles.routeScroll} contentContainerStyle={styles.routeContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.routePageTitle}>{i18n.t('step_heading_1')}</Text>
            <RouteCardNew
              city={i18n.locale === 'ar' ? 'إربد' : 'Irbid'}
              variant="grey"
              subtitle={i18n.t('route_card_irbid')}
              imageSource={IRBID_PHOTO}
              isSelected={order.route === 'amman_to_irbid'}
              onPress={() => {
                if (isSaving) return;
                setShowAirportModal(false);
                handleSelectOption(() => updateOrder({ route: 'amman_to_irbid', service: null }));
              }}
              disabled={isSaving}
            />
            <RouteCardNew
              city={i18n.locale === 'ar' ? 'عمّان' : 'Amman'}
              variant="light"
              subtitle={i18n.t('route_card_amman')}
              imageSource={AMMAN_PHOTO}
              isSelected={order.route === 'irbid_to_amman'}
              onPress={() => {
                if (isSaving) return;
                setShowAirportModal(false);
                handleSelectOption(() => updateOrder({ route: 'irbid_to_amman', service: null }));
              }}
              disabled={isSaving}
            />
            <RouteCardNew
              city={i18n.t('airport')}
              variant="grey"
              subtitle={i18n.t('service_airport_desc')}
              imageSource={AIRPORT_PHOTO}
              isSelected={isAirportRoute}
              onPress={() => {
                if (isSaving) return;
                setAirportFlowStep('from_to');
                setShowAirportModal(true);
              }}
              disabled={isSaving}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            />
          </ScrollView>
        );
      }

      case 2: {
        return (
          <View style={styles.step2Fullscreen}>
            <EmbeddedTripMap
              order={order}
              updateOrder={updateOrder}
              activeMode={mapMode}
              setActiveMode={setMapMode}
              onNext={() => canProceedFromLocations && handleSelectOption(() => {})}
              nextDisabled={!canProceedFromLocations || isSaving}
            />
          </View>
        );
      }

      case 3: {
        const hour12 = timeToShow.getHours() % 12 || 12;
        const minute = timeToShow.getMinutes();
        const isPM = timeToShow.getHours() >= 12;
        const etaEarliest = new Date(timeToShow.getTime() + 1.5 * 60 * 60 * 1000);
        const etaLatest = new Date(timeToShow.getTime() + 2 * 60 * 60 * 1000);
        const formatEtaTime = (d) => {
          const h = d.getHours() % 12 || 12;
          const m = d.getMinutes();
          return `${h}:${String(m).padStart(2, '0')}`;
        };
        const etaSuffix = etaLatest.getHours() >= 12 ? 'PM' : 'AM';
        const etaStr = `${i18n.t('eta')} ${formatEtaTime(etaEarliest)}–${formatEtaTime(etaLatest)} ${etaSuffix}`;
        const isAirportRoute = ['airport_to_amman', 'airport_to_irbid', 'amman_to_airport', 'irbid_to_airport'].includes(
          order.route
        );
        return (
          <ScrollView style={styles.stepScroll} contentContainerStyle={styles.step3Content} showsVerticalScrollIndicator={false}>
            {scheduleStep === 'date' && (
              <>
                <ScheduleOptionCard
                  icon="calendar"
                  title={i18n.t('today')}
                  subtitle={i18n.t('instant_booking_available')}
                  isSelected={order.isToday}
                  onPress={() => !isSaving && updateOrder({ isToday: true, scheduledDate: getDefaultTime() })}
                  disabled={isSaving}
                />
                <ScheduleOptionCard
                  icon="calendar"
                  title={i18n.t('scheduled')}
                  subtitle={i18n.t('plan_for_later')}
                  isSelected={!order.isToday}
                  onPress={() => !isSaving && updateOrder({ isToday: false, scheduledDate: scheduledDateTime })}
                  disabled={isSaving}
                />
                {!order.isToday && (
                  <Pressable style={styles.dateRow} onPress={openDatePicker}>
                    <Text style={styles.dateRowLabel}>{i18n.t('select_date')}</Text>
                    <Text style={styles.dateRowValue}>{displayDate.toLocaleDateString()}</Text>
                    <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                  </Pressable>
                )}
                <Pressable
                  style={({ pressed }) => [styles.primaryButton, styles.primaryButtonWithArrow, pressed && styles.primaryButtonPressed]}
                  onPress={() => setScheduleStep('time')}
                >
                  <Text style={styles.primaryButtonText}>{i18n.t('pick_time')}</Text>
                  <Text style={styles.primaryButtonArrow}>→</Text>
                </Pressable>
              </>
            )}
            {scheduleStep === 'time' && (
              <>
                <Text style={styles.selectPickupTimeLabel}>{i18n.t('select_pickup_time')}</Text>
                <View style={styles.timePickerCard}>
                  <View style={styles.timeDisplayRow}>
                    <Pressable style={styles.timeDigitsWrap} onPress={openTimePicker}>
                      <Text style={styles.timeDigit}>{String(hour12).padStart(2, '0')}</Text>
                      <Text style={styles.timeColon}>:</Text>
                      <Text style={styles.timeDigit}>{String(minute).padStart(2, '0')}</Text>
                    </Pressable>
                    <View style={styles.ampmWrap}>
                      <Pressable
                        style={[styles.ampmBtn, !isPM && styles.ampmBtnSelected]}
                        onPress={() => isPM && toggleAmPm()}
                      >
                        <Text style={[styles.ampmText, !isPM && styles.ampmTextSelected]}>AM</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.ampmBtn, isPM && styles.ampmBtnSelected]}
                        onPress={() => !isPM && toggleAmPm()}
                      >
                        <Text style={[styles.ampmText, isPM && styles.ampmTextSelected]}>PM</Text>
                      </Pressable>
                    </View>
                  </View>
                  <Text style={styles.etaText}>{etaStr}</Text>
                </View>
                {isAirportRoute ? (
                  <Pressable
                    style={({ pressed }) => [
                      styles.primaryButton,
                      styles.primaryButtonWithArrow,
                      !canProceedFromServiceSchedule && styles.buttonDisabled,
                      pressed && styles.primaryButtonPressed,
                    ]}
                    onPress={() => canProceedFromServiceSchedule && handleSelectOption(() => {})}
                    disabled={!canProceedFromServiceSchedule || isSaving}
                  >
                    <Text style={styles.primaryButtonText}>{i18n.t('next')}</Text>
                    <Text style={styles.primaryButtonArrow}>→</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    style={({ pressed }) => [styles.primaryButton, styles.primaryButtonWithArrow, pressed && styles.primaryButtonPressed]}
                    onPress={() => !isSaving && setScheduleStep('service')}
                    disabled={isSaving}
                  >
                    <Text style={styles.primaryButtonText}>{i18n.t('continue_to_services')}</Text>
                    <Text style={styles.primaryButtonArrow}>→</Text>
                  </Pressable>
                )}
              </>
            )}
            {scheduleStep === 'service' && !isAirportRoute && (
              <>
                <ServiceCardNew
                  icon="people"
                  title={i18n.t('service_basic')}
                  subtitle={i18n.t('service_basic_desc_card')}
                  price={5}
                  isSelected={order.service?.type === 'basic'}
                  showWatermark
                  onPress={() => {
                    if (isSaving) return;
                    setService({ type: 'basic' });
                    setShowPrivate(false);
                    setShowInstant(false);
                  }}
                  disabled={isSaving}
                />
                <ServiceCardNew
                  icon="car"
                  title={i18n.t('service_private')}
                  subtitle={i18n.t('service_private_desc_card')}
                  price={15}
                  isSelected={order.service?.type === 'private'}
                  onPress={() => {
                    if (isSaving) return;
                    setShowPrivate(true);
                    setShowInstant(false);
                    setService({ type: 'private' });
                  }}
                />
                {showPrivate && (
                  <View
                    style={[
                      styles.privateChoiceWrap,
                      typeof order.service?.alone !== 'boolean' && styles.privateChoiceWrapPending,
                    ]}
                  >
                    <View style={[styles.privateChoiceHeader, isArabic && styles.privateChoiceHeaderRtl]}>
                      <Ionicons name="people" size={22} color={colors.primary} style={styles.privateChoiceIcon} />
                      <View style={styles.privateChoiceHeaderText}>
                        <Text style={[styles.privateChoiceTitle, isArabic && styles.privateChoiceTextRtl]}>
                          {i18n.t('private_ride_choose_title')}
                        </Text>
                        <Text style={[styles.privateChoiceHint, isArabic && styles.privateChoiceTextRtl]}>
                          {i18n.t('private_ride_choose_hint')}
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.subOptions, isArabic && styles.subOptionsArabic]}>
                      <TouchableOpacity
                        style={[styles.subBtn, styles.subBtnLarge, order.service?.alone === true && styles.subBtnSelected]}
                        onPress={() => !isSaving && setService({ type: 'private', alone: true })}
                        disabled={isSaving}
                      >
                        <Text style={order.service?.alone === true ? styles.subBtnTextSelected : styles.subBtnText}>
                          {i18n.t('alone')}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.subBtn,
                          styles.subBtnLarge,
                          order.service?.alone === false && styles.subBtnSelected,
                        ]}
                        onPress={() => !isSaving && setService({ type: 'private', alone: false })}
                        disabled={isSaving}
                      >
                        <Text style={order.service?.alone === false ? styles.subBtnTextSelected : styles.subBtnText}>
                          {i18n.t('family')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
                <ServiceCardNew
                  icon="cube-outline"
                  title={i18n.t('service_instant')}
                  subtitle={i18n.t('service_instant_desc_card')}
                  price={null}
                  isSelected={order.service?.type === 'instant'}
                  onPress={() => {
                    if (isSaving) return;
                    setShowInstant(true);
                    setShowPrivate(false);
                    setService({ type: 'instant', description: instantDesc || '' });
                  }}
                  disabled={isSaving}
                />
                {showInstant && (
                  <TextInput
                    style={styles.input}
                    placeholder={i18n.t('enter_description')}
                    value={instantDesc}
                    onChangeText={(t) => setService({ type: 'instant', description: t })}
                    multiline
                  />
                )}
                <Pressable
                  style={({ pressed }) => [
                    styles.primaryButton,
                    styles.primaryButtonWithArrow,
                    !canProceedFromServiceSchedule && styles.buttonDisabled,
                    pressed && styles.primaryButtonPressed,
                  ]}
                  onPress={() => canProceedFromServiceSchedule && handleSelectOption(() => {})}
                  disabled={!canProceedFromServiceSchedule || isSaving}
                >
                  <Text style={styles.primaryButtonText}>{i18n.t('next')}</Text>
                  <Text style={styles.primaryButtonArrow}>→</Text>
                </Pressable>
              </>
            )}
          </ScrollView>
        );
      }

      case 4:
        return (
          <ScrollView style={styles.stepScroll} contentContainerStyle={styles.step5Content} showsVerticalScrollIndicator={false}>
            <Text style={styles.stepTitle}>{i18n.t('order_summary')}</Text>
            <SummaryRow label={i18n.t('route')} value={routeText} />
            <SummaryRow
              label={i18n.t('date_time')}
              value={`${orderDate.toLocaleDateString()} ${orderDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
            />
            <SummaryRow label={i18n.t('service')} value={getServiceText()} />
            <SummaryRow label={i18n.t('pickup_location')} value={order.pickup?.address || ''} />
            <SummaryRow
              label={i18n.t('destination')}
              value={order.skipDestination ? i18n.t('no_destination_selected') : order.destination?.address || ''}
            />
            <SummaryRow label={i18n.t('full_name')} value={profile?.full_name || '—'} />
            <SummaryRow label={i18n.t('phone_number')} value={profile?.phone || '—'} />
            <Text style={styles.termsText}>
              {i18n.t('terms_prefix')}
              <Text style={styles.termsLink} onPress={() => setShowTermsModal(true)}>{i18n.t('terms_link')}</Text>
              .
            </Text>
            {submitError && (
              <View style={styles.errorBox}>
                <Text style={styles.error}>{submitError}</Text>
              </View>
            )}
            <TouchableOpacity
              style={[styles.primaryButton, isSubmitting && styles.buttonDisabled]}
              onPress={submit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.primaryButtonText}>{i18n.t('submit_order')}</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        );

      default:
        return null;
    }
  };

  return (
    <View style={[styles.container, currentStep === 2 && styles.containerMapStep]}>
      <Modal visible={isSubmitting} transparent animationType="fade">
        <View style={styles.submitLoadingOverlay}>
          <View style={styles.submitLoadingCard}>
            <View style={styles.submitLoadingCars} pointerEvents="none">
              <Ionicons name="car" size={36} color={colors.primary} style={[styles.submitCarIcon, styles.submitCarLeft]} />
              <Ionicons name="car-sport" size={40} color={colors.primary} style={[styles.submitCarIcon, styles.submitCarCenter]} />
              <Ionicons name="bus" size={32} color={colors.primary} style={[styles.submitCarIcon, styles.submitCarRight]} />
            </View>
            <Text style={styles.submitLoadingTitle}>{i18n.t('loading_thank_you')}</Text>
            <ActivityIndicator size="large" color={colors.primary} style={styles.submitLoadingSpinner} />
            <Animated.Text style={[styles.submitLoadingPhrase, { opacity: phraseOpacity }]}>
              {i18n.t(LOADING_PHRASES[displayedPhraseIndex])}
            </Animated.Text>
          </View>
        </View>
      </Modal>
      <View style={styles.cardWrapper}>
        <Animated.View
          style={[
            styles.card,
            {
              opacity: contentOpacity,
              transform: [{ scale: contentScale }],
            },
            currentStep === 2 && styles.cardMapStep,
          ]}
        >
          {renderStepContent()}
        </Animated.View>
      </View>

      {Platform.OS === 'ios' && showDatePicker && pendingDate && (
        <Modal visible transparent animationType="slide">
          <Pressable style={styles.pickerModalOverlay} onPress={() => { setShowDatePicker(false); setPendingDate(null); }}>
            <Pressable style={styles.pickerSheet} onPress={(e) => e.stopPropagation()}>
              <View style={styles.sheetHandle} />
              <View style={styles.pickerModalContent}>
              <View style={styles.pickerModalHeader}>
                <TouchableOpacity onPress={() => { setShowDatePicker(false); setPendingDate(null); }}>
                  <Text style={styles.pickerModalCancel}>{i18n.t('cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={confirmDate}>
                  <Text style={styles.pickerModalDone}>{i18n.t('confirm')}</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={pendingDate}
                mode="date"
                minimumDate={minDate}
                onChange={onDateChange}
                display="spinner"
              />
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}
      {Platform.OS !== 'ios' && showDatePicker && (
        <DateTimePicker
          value={scheduledDateTime}
          mode="date"
          minimumDate={minDate}
          onChange={onDateChange}
        />
      )}
      {Platform.OS === 'ios' && showTimePicker && pendingTime && (
        <Modal visible transparent animationType="slide">
          <Pressable style={styles.pickerModalOverlay} onPress={() => { setShowTimePicker(false); setPendingTime(null); }}>
            <Pressable style={styles.pickerSheet} onPress={(e) => e.stopPropagation()}>
              <View style={styles.sheetHandle} />
              <View style={styles.pickerModalContent}>
              <View style={styles.pickerModalHeader}>
                <TouchableOpacity onPress={() => { setShowTimePicker(false); setPendingTime(null); }}>
                  <Text style={styles.pickerModalCancel}>{i18n.t('cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={confirmTime}>
                  <Text style={styles.pickerModalDone}>{i18n.t('confirm')}</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={pendingTime}
                mode="time"
                onChange={onTimeChange}
                display="spinner"
              />
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}
      {Platform.OS !== 'ios' && showTimePicker && (
        <DateTimePicker value={timeToShow} mode="time" onChange={onTimeChange} />
      )}
      <Modal visible={showAirportModal} transparent animationType="fade">
        <View style={styles.termsModalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => { setShowAirportModal(false); setAirportFlowStep(null); }} />
          <View style={styles.airportModalContent}>
            <View style={styles.termsModalHeader}>
              <Text style={styles.termsModalTitle}>{i18n.t('service_airport')}</Text>
              <TouchableOpacity onPress={() => { setShowAirportModal(false); setAirportFlowStep(null); }} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Text style={styles.termsModalClose}>{i18n.t('cancel')}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.airportModalBody}>
              {airportFlowStep === 'from_to' ? (
                <>
                  <TouchableOpacity
                    style={[styles.airportModalOption, order.route === 'airport_to_amman' || order.route === 'airport_to_irbid' ? styles.airportModalOptionSelected : null]}
                    onPress={() => setAirportFlowStep('destinations_from')}
                  >
                    <Text style={styles.airportModalOptionText}>{i18n.t('from_airport')}</Text>
                    <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.airportModalOption, order.route === 'amman_to_airport' || order.route === 'irbid_to_airport' ? styles.airportModalOptionSelected : null]}
                    onPress={() => setAirportFlowStep('destinations_to')}
                  >
                    <Text style={styles.airportModalOptionText}>{i18n.t('to_airport')}</Text>
                    <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity style={styles.airportModalBack} onPress={() => setAirportFlowStep('from_to')}>
                    <Ionicons name="chevron-back" size={20} color={colors.primary} />
                    <Text style={styles.airportModalBackText}>{i18n.t('back')}</Text>
                  </TouchableOpacity>
                  {airportFlowStep === 'destinations_from' ? (
                    <>
                      <TouchableOpacity
                        style={[styles.airportModalOption, order.route === 'airport_to_amman' && styles.airportModalOptionSelected]}
                        onPress={() => {
                          if (isSaving) return;
                          setShowAirportModal(false);
                          setAirportFlowStep(null);
                          handleSelectOption(() => updateOrder({ route: 'airport_to_amman', service: { type: 'airport', toAirport: false } }));
                        }}
                        disabled={isSaving}
                      >
                        <Text style={styles.airportModalOptionText}>{i18n.t('airport_to_amman')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.airportModalOption, order.route === 'airport_to_irbid' && styles.airportModalOptionSelected]}
                        onPress={() => {
                          if (isSaving) return;
                          setShowAirportModal(false);
                          setAirportFlowStep(null);
                          handleSelectOption(() => updateOrder({ route: 'airport_to_irbid', service: { type: 'airport', toAirport: false } }));
                        }}
                        disabled={isSaving}
                      >
                        <Text style={styles.airportModalOptionText}>{i18n.t('airport_to_irbid')}</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <TouchableOpacity
                        style={[styles.airportModalOption, order.route === 'amman_to_airport' && styles.airportModalOptionSelected]}
                        onPress={() => {
                          if (isSaving) return;
                          setShowAirportModal(false);
                          setAirportFlowStep(null);
                          handleSelectOption(() => updateOrder({ route: 'amman_to_airport', service: { type: 'airport', toAirport: true } }));
                        }}
                        disabled={isSaving}
                      >
                        <Text style={styles.airportModalOptionText}>{i18n.t('amman_to_airport')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.airportModalOption, order.route === 'irbid_to_airport' && styles.airportModalOptionSelected]}
                        onPress={() => {
                          if (isSaving) return;
                          setShowAirportModal(false);
                          setAirportFlowStep(null);
                          handleSelectOption(() => updateOrder({ route: 'irbid_to_airport', service: { type: 'airport', toAirport: true } }));
                        }}
                        disabled={isSaving}
                      >
                        <Text style={styles.airportModalOptionText}>{i18n.t('irbid_to_airport')}</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </>
              )}
            </View>
          </View>
        </View>
      </Modal>
      <Modal visible={showTermsModal} transparent animationType="fade">
          <View style={styles.termsModalOverlay}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowTermsModal(false)} />
            <View style={styles.termsModalContent}>
              <View style={styles.termsModalHeader}>
                <Text style={styles.termsModalTitle}>{i18n.t('terms_modal_title')}</Text>
                <TouchableOpacity onPress={() => setShowTermsModal(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                  <Text style={styles.termsModalClose}>{i18n.t('done')}</Text>
                </TouchableOpacity>
              </View>
              <ScrollView
                style={styles.termsModalScroll}
                contentContainerStyle={styles.termsModalScrollContent}
                showsVerticalScrollIndicator={true}
                bounces={true}
              >
                <Text style={styles.termsModalBody}>{TERMS_AND_PRIVACY_TEXT}</Text>
              </ScrollView>
            </View>
          </View>
        </Modal>
    </View>
  );
}

function ScheduleOptionCard({ icon, title, subtitle, isSelected, onPress, disabled }) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.scheduleCard,
        isSelected ? styles.scheduleCardSelected : styles.scheduleCardUnselected,
        pressed && styles.scheduleCardPressed,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <View style={[styles.scheduleCardIcon, isSelected ? styles.scheduleCardIconSelected : styles.scheduleCardIconUnselected]}>
        <Ionicons name={icon} size={24} color={isSelected ? colors.white : colors.textSecondary} />
      </View>
      <View style={styles.scheduleCardText}>
        <Text style={[styles.scheduleCardTitle, isSelected && styles.scheduleCardTitleSelected]}>{title}</Text>
        <Text style={[styles.scheduleCardSubtitle, isSelected && styles.scheduleCardSubtitleSelected]}>{subtitle}</Text>
      </View>
      <View style={[styles.scheduleCardCheck, isSelected ? styles.scheduleCardCheckSelected : styles.scheduleCardCheckUnselected]}>
        {isSelected ? (
          <Ionicons name="checkmark" size={18} color={colors.white} />
        ) : null}
      </View>
    </Pressable>
  );
}

function RouteCardNew({ city, badge, badgeLabel, avatars, extraCount, isSelected, onPress, disabled, variant, subtitle, hitSlop, imageSource }) {
  const isLight = variant === 'light';
  const content = (
    <>
      {imageSource && (
        <LinearGradient
          colors={['rgba(0,0,0,0.65)', 'rgba(0,0,0,0.35)', 'rgba(0,0,0,0.5)']}
          locations={[0, 0.5, 1]}
          style={styles.routeCardImageOverlay}
        />
      )}
      <View style={styles.routeCardNewContent}>
        <View style={styles.routeCardNewTop}>
          {badge && (
            <View style={[styles.routeCardBadge, isLight ? styles.routeCardBadgeLight : styles.routeCardBadgeGrey]}>
              <Text style={[styles.routeCardBadgeText, isLight ? styles.routeCardBadgeTextLight : styles.routeCardBadgeTextGrey]}>
                {badgeLabel}
              </Text>
            </View>
          )}
          <Text style={[
            styles.routeCardCity,
            imageSource ? styles.routeCardCityOnImage : (isLight ? styles.routeCardCityLight : styles.routeCardCityGrey),
          ]}>
            {city}
          </Text>
          {subtitle ? (
            <Text style={[
              styles.routeCardSubtitle,
              imageSource ? styles.routeCardSubtitleOnImage : (isLight ? styles.routeCardSubtitleLight : styles.routeCardSubtitleGrey),
            ]}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <View style={styles.routeCardNewBottom}>
          {avatars && (
            <View style={styles.avatarRow}>
              {[1, 2, 3].map((i) => (
                <View key={i} style={[styles.avatar, isLight ? styles.avatarLight : styles.avatarGrey, i > 1 && styles.avatarOverlap]} />
              ))}
              {extraCount != null && (
                <Text style={[styles.avatarExtra, isLight ? styles.avatarExtraLight : styles.avatarExtraGrey]}>
                  +{extraCount}
                </Text>
              )}
            </View>
          )}
          <View style={[
            styles.routeCardArrow,
            isSelected && styles.routeCardArrowSelected,
            imageSource && styles.routeCardArrowOnImage,
          ]}>
            <Text style={[
              styles.routeCardArrowText,
              imageSource && styles.routeCardArrowTextOnImage,
              isSelected && styles.routeCardArrowTextSelected,
            ]}>→</Text>
          </View>
        </View>
      </View>
    </>
  );
  if (imageSource) {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        hitSlop={hitSlop}
        style={({ pressed }) => [
          styles.routeCardNew,
          styles.routeCardWithImage,
          isLight ? styles.routeCardLight : styles.routeCardGrey,
          isSelected && styles.routeCardSelected,
          pressed && styles.routeCardPressed,
        ]}
      >
        <ImageBackground source={imageSource} style={styles.routeCardImageBg} imageStyle={styles.routeCardImageStyle} resizeMode="cover">
          {content}
        </ImageBackground>
      </Pressable>
    );
  }
  return (
    <Pressable
      style={({ pressed }) => [
        styles.routeCardNew,
        isLight ? styles.routeCardLight : styles.routeCardGrey,
        isSelected && styles.routeCardSelected,
        pressed && styles.routeCardPressed,
      ]}
      onPress={onPress}
      disabled={disabled}
      hitSlop={hitSlop}
    >
      {content}
    </Pressable>
  );
}

function DestinationCard({ city, subtitle, imageSource, isSelected, onPress, disabled }) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.destCard,
        isSelected && styles.destCardSelected,
        pressed && styles.destCardPressed,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <ImageBackground
        source={imageSource}
        style={styles.destCardImage}
        imageStyle={styles.destCardImageStyle}
        resizeMode="cover"
      >
        <View style={styles.destCardOverlay} />
        <View style={styles.destCardContent}>
          <View style={styles.destCardText}>
            <Text style={styles.destCity}>{city}</Text>
            <Text style={styles.destSub}>{subtitle}</Text>
          </View>
          <View style={[styles.destArrowBtn, isSelected && styles.destArrowBtnSelected]}>
            <Text style={styles.destArrow}>→</Text>
          </View>
        </View>
      </ImageBackground>
    </Pressable>
  );
}

function ServiceCardNew({ icon, title, subtitle, price, isSelected, onPress, disabled, showWatermark }) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.serviceCardNew,
        isSelected ? styles.serviceCardNewSelected : styles.serviceCardNewUnselected,
        pressed && styles.serviceCardNewPressed,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      {showWatermark && (
        <View style={styles.serviceWatermark} pointerEvents="none">
          <Ionicons name="bus" size={48} color="rgba(0,0,0,0.04)" style={styles.serviceWatermarkIcon} />
          <Ionicons name="car" size={56} color="rgba(0,0,0,0.04)" style={styles.serviceWatermarkIcon2} />
        </View>
      )}
      <View style={[styles.serviceCardIcon, isSelected ? styles.serviceCardIconSelected : styles.serviceCardIconUnselected]}>
        <Ionicons name={icon} size={28} color={isSelected ? colors.primary : colors.textSecondary} />
      </View>
      <View style={styles.serviceCardNewContent}>
        <View style={styles.serviceCardNewTop}>
          <Text style={[styles.serviceCardNewTitle, isSelected && styles.serviceCardNewTitleSelected]} numberOfLines={1}>{title}</Text>
          {price != null && (
            <Text style={[styles.serviceCardNewPrice, isSelected && styles.serviceCardNewPriceSelected]}>
              {price} {i18n.t('jod')}
            </Text>
          )}
        </View>
        <Text style={[styles.serviceCardNewSubtitle, isSelected && styles.serviceCardNewSubtitleSelected]}>
          {subtitle}
        </Text>
      </View>
    </Pressable>
  );
}

function ServiceOption({ title, subtitle, price, onPress, isSelected, disabled }) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.serviceCard,
        isSelected && styles.serviceCardSelected,
        pressed && styles.serviceCardPressed,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <View style={styles.serviceCardContent}>
        <Text style={[styles.optionTitle, isSelected && styles.optionTitleSelected]}>{title}</Text>
        <Text style={styles.serviceSubtitle}>{subtitle}</Text>
      </View>
      {price != null && (
        <Text style={[styles.price, isSelected && styles.priceSelected]}>
          {price} {i18n.t('jod')}
        </Text>
      )}
      {isSelected && <Text style={styles.iosCheckmark}>✓</Text>}
    </Pressable>
  );
}

function SummaryRow({ label, value }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: ios.spacing.lg,
    paddingTop: ios.spacing.md,
    backgroundColor: colors.background,
  },
  containerMapStep: {
    overflow: 'visible',
    padding: 0,
    paddingTop: 0,
    margin: 0,
    flex: 1,
  },
  cardWrapper: {
    flex: 1,
    minHeight: 320,
    position: 'relative',
  },
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: ios.radius.xxl,
    padding: ios.spacing.xxl,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 8 },
    }),
    overflow: 'hidden',
  },
  cardMapStep: {
    overflow: 'visible',
    padding: 0,
    borderRadius: 0,
    backgroundColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  stepScroll: {
    flex: 1,
  },
  stepContent: {
    minHeight: 260,
  },
  step2Content: {
    paddingBottom: ios.spacing.xxl,
  },
  step2Fullscreen: {
    flex: 1,
    minHeight: 0,
    position: 'relative',
  },
  step3Content: {
    paddingBottom: ios.spacing.xxl,
  },
  step5Content: {
    paddingBottom: ios.spacing.xxl,
  },
  step4Content: { flex: 1 },
  step4Scroll: { flex: 1 },
  step4ScrollContent: { paddingBottom: ios.spacing.xxl },
  step4DismissArea: {
    flexGrow: 1,
  },
  dismissKeyboardHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: ios.spacing.sm,
    marginBottom: ios.spacing.md,
  },
  dismissKeyboardHintText: {
    fontSize: ios.fontSize.caption,
    color: colors.primary,
    fontWeight: ios.fontWeight.medium,
  },
  detailsPageTitle: {
    fontSize: ios.fontSize.title1,
    fontWeight: ios.fontWeight.bold,
    color: colors.text,
    marginBottom: ios.spacing.sm,
    letterSpacing: -0.5,
  },
  detailsPageSubtitle: {
    fontSize: ios.fontSize.body,
    color: colors.textSecondary,
    marginBottom: ios.spacing.xl,
  },
  detailsLabel: {
    fontSize: ios.fontSize.caption,
    fontWeight: ios.fontWeight.semibold,
    color: colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: ios.spacing.sm,
    textTransform: 'uppercase',
  },
  detailsInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.metallic,
    borderRadius: 14,
    paddingHorizontal: ios.spacing.lg,
    marginBottom: ios.spacing.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  detailsInputWrapError: { borderColor: colors.error },
  detailsInputIcon: { marginRight: ios.spacing.md },
  detailsInput: {
    flex: 1,
    paddingVertical: ios.spacing.lg,
    fontSize: ios.fontSize.body,
    color: colors.text,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: ios.spacing.md,
    gap: 6,
  },
  detailsError: {
    fontSize: ios.fontSize.footnote,
    color: colors.error,
  },
  detailsBtnRow: {
    flexDirection: 'row',
    gap: ios.spacing.md,
    marginBottom: ios.spacing.lg,
  },
  detailsSetAddressBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: ios.spacing.md,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  detailsUseLocationBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: ios.spacing.md,
    borderRadius: 14,
    backgroundColor: colors.primaryLight,
  },
  detailsBtnIcon: { marginRight: ios.spacing.sm },
  detailsSetAddressText: {
    fontSize: ios.fontSize.footnote,
    fontWeight: ios.fontWeight.semibold,
    color: colors.primary,
  },
  detailsUseLocationText: {
    fontSize: ios.fontSize.footnote,
    fontWeight: ios.fontWeight.semibold,
    color: colors.primary,
  },
  termsText: {
    fontSize: ios.fontSize.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: ios.spacing.lg,
    lineHeight: 18,
    paddingHorizontal: ios.spacing.sm,
  },
  termsLink: {
    fontSize: ios.fontSize.caption,
    color: colors.primary,
    fontWeight: ios.fontWeight.semibold,
    textDecorationLine: 'underline',
  },
  termsModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: ios.spacing.lg,
  },
  submitLoadingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: ios.spacing.xl,
  },
  submitLoadingCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: ios.spacing.xxl,
    alignItems: 'center',
    minWidth: 280,
    maxWidth: 340,
    position: 'relative',
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 20, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 12 },
    }),
  },
  submitLoadingCars: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: ios.spacing.xl,
  },
  submitCarIcon: {
    opacity: 0.12,
  },
  submitCarLeft: { alignSelf: 'flex-start', marginTop: ios.spacing.xl },
  submitCarCenter: { opacity: 0.1 },
  submitCarRight: { alignSelf: 'flex-end', marginBottom: ios.spacing.xl },
  submitLoadingTitle: {
    fontSize: ios.fontSize.title3,
    fontWeight: ios.fontWeight.bold,
    color: colors.primary,
    textAlign: 'center',
    marginTop: ios.spacing.sm,
    marginBottom: ios.spacing.lg,
  },
  submitLoadingSpinner: {
    marginBottom: ios.spacing.lg,
  },
  submitLoadingPhrase: {
    fontSize: 15,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 22,
    minHeight: 44,
  },
  airportModalContent: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    width: '100%',
    maxWidth: 360,
    paddingBottom: ios.spacing.xl,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 20, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 12 },
    }),
  },
  airportModalBody: {
    padding: ios.spacing.lg,
  },
  airportModalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: ios.spacing.lg,
    paddingHorizontal: ios.spacing.lg,
    borderRadius: 12,
    marginBottom: ios.spacing.sm,
    backgroundColor: colors.metallic,
  },
  airportModalOptionSelected: {
    backgroundColor: colors.primaryLight,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  airportModalOptionText: {
    fontSize: ios.fontSize.body,
    fontWeight: ios.fontWeight.medium,
    color: colors.text,
  },
  airportModalBack: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: ios.spacing.lg,
    paddingVertical: ios.spacing.sm,
  },
  airportModalBackText: {
    fontSize: ios.fontSize.body,
    color: colors.primary,
    fontWeight: ios.fontWeight.semibold,
    marginLeft: ios.spacing.xs,
  },
  termsModalContent: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    height: '80%',
    flexDirection: 'column',
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 20, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 12 },
    }),
  },
  termsModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: ios.spacing.lg,
    paddingVertical: ios.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  termsModalTitle: {
    fontSize: ios.fontSize.title3,
    fontWeight: ios.fontWeight.bold,
    color: colors.text,
  },
  termsModalClose: {
    fontSize: ios.fontSize.body,
    color: colors.primary,
    fontWeight: ios.fontWeight.semibold,
  },
  termsModalScroll: {
    flex: 1,
    minHeight: 0,
  },
  termsModalScrollContent: {
    padding: ios.spacing.lg,
    paddingBottom: ios.spacing.xxl,
  },
  termsModalBody: {
    fontSize: ios.fontSize.footnote,
    color: colors.text,
    lineHeight: 22,
  },
  step3Content: {
    paddingBottom: ios.spacing.xxl,
  },
  serviceCardNew: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: ios.spacing.xl,
    borderRadius: 20,
    marginBottom: ios.spacing.lg,
    overflow: 'hidden',
    position: 'relative',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 3 },
    }),
  },
  serviceCardNewSelected: { backgroundColor: colors.primaryLight },
  serviceCardNewUnselected: { backgroundColor: colors.surface },
  serviceCardNewPressed: { opacity: 0.9 },
  serviceWatermark: {
    position: 'absolute',
    right: ios.spacing.lg,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  serviceWatermarkIcon: { position: 'absolute', right: 0, top: '30%' },
  serviceWatermarkIcon2: { position: 'absolute', right: 24, bottom: '20%' },
  serviceCardIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: ios.spacing.lg,
  },
  serviceCardIconSelected: { backgroundColor: colors.white },
  serviceCardIconUnselected: { backgroundColor: colors.metallic },
  serviceCardNewContent: { flex: 1 },
  serviceCardNewTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  serviceCardNewTitle: {
    fontSize: ios.fontSize.title3,
    fontWeight: ios.fontWeight.bold,
    color: colors.text,
  },
  serviceCardNewTitleSelected: { color: colors.primary },
  serviceCardNewPrice: {
    fontSize: ios.fontSize.title3,
    fontWeight: ios.fontWeight.bold,
    color: colors.text,
  },
  serviceCardNewPriceSelected: { color: colors.primary },
  serviceCardNewSubtitle: {
    fontSize: ios.fontSize.footnote,
    color: colors.textSecondary,
    marginTop: 4,
  },
  serviceCardNewSubtitleSelected: { color: colors.primary, opacity: 0.9 },
  scheduleTitle: {
    fontSize: ios.fontSize.title1,
    fontWeight: ios.fontWeight.bold,
    color: colors.text,
    marginBottom: ios.spacing.sm,
    letterSpacing: -0.5,
  },
  scheduleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: ios.spacing.xl,
    borderRadius: 20,
    marginBottom: ios.spacing.lg,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 3 },
    }),
  },
  scheduleCardSelected: { backgroundColor: colors.primaryLight },
  scheduleCardUnselected: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  scheduleCardPressed: { opacity: 0.9 },
  scheduleCardIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: ios.spacing.lg,
  },
  scheduleCardIconSelected: { backgroundColor: colors.primary },
  scheduleCardIconUnselected: { backgroundColor: colors.metallic },
  scheduleCardText: { flex: 1 },
  scheduleCardTitle: {
    fontSize: ios.fontSize.title3,
    fontWeight: ios.fontWeight.bold,
    color: colors.text,
  },
  scheduleCardTitleSelected: { color: colors.primary },
  scheduleCardSubtitle: {
    fontSize: ios.fontSize.footnote,
    color: colors.textSecondary,
    marginTop: 2,
  },
  scheduleCardSubtitleSelected: { color: colors.primary, opacity: 0.9 },
  scheduleCardCheck: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleCardCheckSelected: { backgroundColor: colors.primary },
  scheduleCardCheckUnselected: { borderWidth: 2, borderColor: colors.border },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: ios.spacing.lg,
    borderRadius: ios.radius.lg,
    marginBottom: ios.spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dateRowLabel: { flex: 1, fontSize: ios.fontSize.body, color: colors.text },
  dateRowValue: { fontSize: ios.fontSize.body, color: colors.textSecondary },
  selectPickupTimeLabel: {
    fontSize: ios.fontSize.caption,
    fontWeight: ios.fontWeight.semibold,
    color: colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: ios.spacing.sm,
  },
  timePickerCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: ios.spacing.xl,
    marginBottom: ios.spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 1 } },
      android: { elevation: 2 },
    }),
  },
  timeDisplayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeDigitsWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  timeDigit: {
    fontSize: 36,
    fontWeight: ios.fontWeight.bold,
    color: colors.text,
    minWidth: 44,
    textAlign: 'center',
    borderBottomWidth: 2,
    borderBottomColor: colors.primaryLight,
  },
  timeColon: {
    fontSize: 36,
    fontWeight: ios.fontWeight.bold,
    color: colors.text,
    marginHorizontal: 4,
  },
  ampmWrap: {
    flexDirection: 'column',
    gap: 4,
  },
  ampmBtn: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: colors.metallic,
  },
  ampmBtnSelected: { backgroundColor: colors.primary },
  ampmText: {
    fontSize: ios.fontSize.footnote,
    fontWeight: ios.fontWeight.semibold,
    color: colors.textSecondary,
  },
  ampmTextSelected: { color: colors.white },
  etaText: {
    fontSize: ios.fontSize.footnote,
    color: colors.textSecondary,
    marginTop: ios.spacing.lg,
  },
  driverWaitBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.metallic,
    padding: ios.spacing.lg,
    borderRadius: ios.radius.lg,
    marginBottom: ios.spacing.xl,
  },
  driverWaitIcon: { marginRight: ios.spacing.sm, marginTop: 2 },
  driverWaitText: {
    flex: 1,
    fontSize: ios.fontSize.footnote,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  driverWaitBold: { fontWeight: ios.fontWeight.bold, color: colors.text },
  primaryButtonWithArrow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryButtonArrow: { color: colors.white, fontSize: 18, fontWeight: ios.fontWeight.bold },
  stepTitle: {
    fontSize: ios.fontSize.title3,
    fontWeight: ios.fontWeight.bold,
    marginBottom: ios.spacing.xl,
    textAlign: 'center',
    color: colors.text,
    letterSpacing: -0.4,
  },
  stepTitleLarge: {
    fontSize: 32,
    fontWeight: ios.fontWeight.bold,
    marginBottom: ios.spacing.xl,
    textAlign: 'center',
    color: colors.text,
    letterSpacing: -0.5,
    lineHeight: 38,
  },
  routeScroll: { flex: 1 },
  routeContent: { paddingBottom: ios.spacing.xxl },
  routeSubOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ios.spacing.md,
    marginBottom: ios.spacing.lg,
  },
  routeSubBtn: {},
  routePageTitle: {
    fontSize: ios.fontSize.title1,
    fontWeight: ios.fontWeight.bold,
    color: colors.text,
    marginBottom: ios.spacing.lg,
    letterSpacing: -0.5,
  },
  routeCardNew: {
    borderRadius: 20,
    padding: ios.spacing.xl,
    marginBottom: ios.spacing.lg,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 4 },
    }),
  },
  routeCardWithImage: {
    overflow: 'hidden',
    padding: 0,
  },
  routeCardImageBg: {
    flex: 1,
    padding: ios.spacing.xl,
    justifyContent: 'center',
  },
  routeCardImageStyle: { borderRadius: 20 },
  routeCardImageOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
  },
  routeCardLight: { backgroundColor: colors.surface },
  routeCardGrey: { backgroundColor: colors.metallic },
  routeCardSelected: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  routeCardPressed: { opacity: 0.9 },
  routeCardNewContent: { minHeight: 80 },
  routeCardNewTop: { marginBottom: ios.spacing.lg },
  routeCardBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: ios.spacing.sm,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: ios.spacing.sm,
  },
  routeCardBadgeLight: { backgroundColor: colors.primaryLight },
  routeCardBadgeGrey: { backgroundColor: 'rgba(0,0,0,0.06)' },
  routeCardBadgeText: {
    fontSize: 11,
    fontWeight: ios.fontWeight.bold,
    letterSpacing: 0.5,
  },
  routeCardBadgeTextLight: { color: colors.primary },
  routeCardBadgeTextGrey: { color: colors.textSecondary },
  routeCardCity: {
    fontSize: 28,
    fontWeight: ios.fontWeight.bold,
    letterSpacing: -0.5,
  },
  routeCardCityLight: { color: colors.text },
  routeCardCityGrey: { color: colors.text },
  routeCardSubtitle: {
    fontSize: ios.fontSize.footnote,
    marginTop: 4,
  },
  routeCardSubtitleLight: { color: colors.textSecondary },
  routeCardSubtitleGrey: { color: colors.textSecondary },
  routeCardCityOnImage: { color: colors.white },
  routeCardSubtitleOnImage: { color: 'rgba(255,255,255,0.9)' },
  routeCardArrowOnImage: { backgroundColor: 'rgba(255,255,255,0.25)' },
  routeCardNewBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  avatarRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  avatarOverlap: { marginLeft: -10 },
  avatarLight: { backgroundColor: colors.primaryLight },
  avatarGrey: { backgroundColor: colors.border },
  avatarExtra: {
    marginLeft: 8,
    fontSize: ios.fontSize.footnote,
    fontWeight: ios.fontWeight.semibold,
  },
  avatarExtraLight: { color: colors.primary },
  avatarExtraGrey: { color: colors.textSecondary },
  routeCardArrow: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeCardArrowSelected: { backgroundColor: colors.primary },
  routeCardArrowText: {
    color: colors.primary,
    fontSize: 20,
    fontWeight: ios.fontWeight.bold,
  },
  routeCardArrowTextOnImage: { color: colors.white },
  routeCardArrowTextSelected: { color: colors.white },
  customDestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: ios.spacing.md,
    paddingHorizontal: ios.spacing.lg,
    borderRadius: ios.radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  customDestBtnPressed: { opacity: 0.8 },
  customDestIcon: { marginRight: ios.spacing.sm },
  customDestText: {
    fontSize: ios.fontSize.body,
    fontWeight: ios.fontWeight.medium,
    color: colors.primary,
  },
  destCard: {
    height: 200,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: ios.spacing.lg,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 6 },
    }),
  },
  destCardSelected: {
    borderWidth: 3,
    borderColor: colors.primary,
  },
  destCardPressed: { opacity: 0.9 },
  destCardImage: { flex: 1, width: '100%' },
  destCardImageStyle: { borderRadius: 20 },
  destCardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  destCardContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    padding: ios.spacing.lg,
  },
  destCardText: { flex: 1 },
  destCity: {
    fontSize: 22,
    fontWeight: ios.fontWeight.bold,
    color: colors.white,
  },
  destSub: {
    fontSize: ios.fontSize.footnote,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
  },
  destArrowBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  destArrowBtnSelected: {
    backgroundColor: colors.primary,
  },
  destArrow: {
    color: colors.white,
    fontSize: 20,
    fontWeight: ios.fontWeight.bold,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: colors.primaryLight,
    borderRadius: ios.radius.lg,
    padding: 4,
  },
  segmentedControlArabic: {
    flexDirection: 'row-reverse',
  },
  segment: {
    flex: 1,
    paddingVertical: ios.spacing.md,
    paddingHorizontal: ios.spacing.lg,
    borderRadius: ios.radius.md,
    alignItems: 'center',
  },
  segmentSelected: {
    backgroundColor: colors.surface,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
      android: { elevation: 2 },
    }),
  },
  segmentText: {
    fontSize: ios.fontSize.body,
    fontWeight: ios.fontWeight.semibold,
    color: colors.textSecondary,
  },
  segmentTextSelected: {
    color: colors.primary,
  },
  segmentSubtext: {
    marginTop: 2,
    fontSize: ios.fontSize.caption,
    color: colors.textSecondary,
    opacity: 0.8,
  },
  segmentSubtextSelected: {
    color: colors.primary,
    opacity: 1,
  },
  iosGroup: {
    backgroundColor: colors.surface,
    borderRadius: ios.radius.lg,
    overflow: 'hidden',
  },
  iosRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: ios.spacing.md,
    paddingHorizontal: ios.spacing.lg,
    minHeight: ios.minTouchTarget,
  },
  iosRowFirst: { borderTopLeftRadius: ios.radius.lg, borderTopRightRadius: ios.radius.lg },
  iosRowLast: { borderBottomLeftRadius: ios.radius.lg, borderBottomRightRadius: ios.radius.lg },
  iosRowOnly: { borderRadius: ios.radius.lg },
  iosRowSelected: { backgroundColor: colors.primaryLight },
  iosRowText: {
    flex: 1,
    fontSize: ios.fontSize.body,
    fontWeight: ios.fontWeight.medium,
    color: colors.text,
  },
  iosRowTextSelected: { color: colors.primary, fontWeight: ios.fontWeight.semibold },
  iosRowLabel: {
    flex: 1,
    fontSize: ios.fontSize.body,
    color: colors.text,
  },
  iosRowValue: {
    fontSize: ios.fontSize.body,
    color: colors.textSecondary,
  },
  iosChevron: {
    fontSize: 22,
    color: colors.textSecondary,
    marginLeft: ios.spacing.sm,
  },
  iosCheckmark: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: ios.fontWeight.semibold,
  },
  iosSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: ios.spacing.lg,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  optionsRowArabic: { flexDirection: 'row-reverse' },
  optionCard: {
    flex: 1,
    backgroundColor: colors.primaryLight,
    borderWidth: 2,
    borderColor: colors.border,
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  optionCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  serviceCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  optionCardFull: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
    backgroundColor: colors.primaryLight,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 12,
    marginBottom: 12,
  },
  optionTitle: {
    fontSize: ios.fontSize.body,
    fontWeight: ios.fontWeight.semibold,
    color: colors.text,
  },
  optionTitleSelected: { color: colors.primary },
  optionSubtitle: {
    marginTop: 6,
    fontSize: ios.fontSize.caption,
    color: colors.primary,
    fontWeight: ios.fontWeight.semibold,
  },
  optionSubtitleSmall: {
    marginTop: 4,
    fontSize: ios.fontSize.caption,
    color: colors.textSecondary,
  },
  check: { color: colors.primary, fontSize: 18 },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingVertical: ios.spacing.lg,
    paddingHorizontal: ios.spacing.xxl,
    borderRadius: ios.radius.lg,
    marginTop: ios.spacing.lg,
    alignItems: 'center',
    minHeight: 50,
  },
  primaryButtonPressed: { opacity: 0.8 },
  buttonDisabled: { backgroundColor: colors.disabled },
  primaryButtonText: {
    color: colors.white,
    fontSize: ios.fontSize.body,
    fontWeight: ios.fontWeight.semibold,
  },
  pickerButton: {
    padding: 14,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    marginBottom: 12,
  },
  pickerLabel: { fontSize: ios.fontSize.footnote, color: colors.textSecondary, marginBottom: 4 },
  pickerValue: { fontSize: ios.fontSize.body, fontWeight: ios.fontWeight.medium, color: colors.text },
  serviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: ios.spacing.lg,
    paddingHorizontal: ios.spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: ios.radius.lg,
    marginBottom: ios.spacing.md,
    minHeight: ios.minTouchTarget,
  },
  serviceCardPressed: { opacity: 0.7 },
  serviceCardContent: { flex: 1 },
  serviceSubtitle: {
    fontSize: ios.fontSize.footnote,
    color: colors.textSecondary,
    marginTop: 2,
  },
  price: { fontSize: 16, fontWeight: '600', color: colors.primary },
  priceSelected: { color: colors.primary },
  subOptions: { flexDirection: 'row', gap: ios.spacing.md, marginBottom: 0, marginLeft: 0 },
  subOptionsArabic: { marginLeft: 0, marginRight: 0 },
  privateChoiceWrap: {
    marginBottom: ios.spacing.md,
    marginHorizontal: ios.spacing.sm,
    padding: ios.spacing.lg,
    borderRadius: ios.radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  privateChoiceWrapPending: {
    borderColor: colors.primary,
    borderWidth: 2,
    backgroundColor: colors.primaryLight,
  },
  privateChoiceHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: ios.spacing.md,
    marginBottom: ios.spacing.lg,
  },
  privateChoiceHeaderRtl: { flexDirection: 'row-reverse' },
  privateChoiceIcon: { marginTop: 2 },
  privateChoiceHeaderText: { flex: 1 },
  privateChoiceTextRtl: { textAlign: 'right', writingDirection: 'rtl' },
  privateChoiceTitle: {
    fontSize: ios.fontSize.body,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  privateChoiceHint: {
    fontSize: ios.fontSize.footnote,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  subBtn: {
    flex: 1,
    paddingHorizontal: ios.spacing.md,
    paddingVertical: ios.spacing.md,
    backgroundColor: colors.surface,
    borderRadius: ios.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  subBtnLarge: {
    paddingVertical: ios.spacing.lg,
    minHeight: 52,
  },
  subBtnSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  subBtnText: { color: colors.text, fontSize: ios.fontSize.callout, fontWeight: '600', textAlign: 'center' },
  subBtnTextSelected: { color: colors.white, fontWeight: '700' },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: ios.radius.md,
    padding: ios.spacing.lg,
    marginBottom: ios.spacing.md,
    minHeight: 60,
    textAlignVertical: 'top',
    backgroundColor: colors.surface,
    fontSize: ios.fontSize.body,
    color: colors.text,
  },
  label: { fontSize: 15, fontWeight: '600', marginBottom: 8, color: colors.text },
  locationRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  setAddressBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  setAddressText: { color: colors.white, fontWeight: '600', fontSize: 14 },
  useLocationBtn: {
    flex: 1,
    backgroundColor: colors.primaryLight,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  useLocationBtnText: { color: colors.primary, fontWeight: '600', fontSize: 14 },
  btnDisabled: { opacity: 0.6 },
  selectedAddress: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 12,
    padding: 8,
    backgroundColor: colors.primaryLight,
    borderRadius: 6,
  },
  error: { color: colors.error, fontSize: 12, marginBottom: 8 },
  summaryRow: {
    backgroundColor: colors.surface,
    paddingVertical: ios.spacing.md,
    paddingHorizontal: ios.spacing.lg,
    borderRadius: ios.radius.lg,
    marginBottom: ios.spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  summaryLabel: {
    fontSize: ios.fontSize.caption,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: ios.fontSize.subhead,
    color: colors.text,
  },
  errorBox: { backgroundColor: colors.errorBg, padding: 12, borderRadius: 8, marginBottom: 12 },
  successIcon: { fontSize: 56, color: colors.primary, textAlign: 'center', marginTop: 24 },
  successTitle: { fontSize: 22, fontWeight: '600', textAlign: 'center', marginTop: 16, color: colors.text },
  successDesc: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 12,
    paddingHorizontal: 16,
  },
  pickerModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  pickerSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    paddingBottom: 34,
  },
  sheetHandle: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(0,0,0,0.2)',
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  pickerModalContent: {
    paddingBottom: 8,
  },
  pickerModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pickerModalCancel: { fontSize: 17, color: colors.textSecondary },
  pickerModalDone: { fontSize: 17, color: colors.primary, fontWeight: '600' },
});
