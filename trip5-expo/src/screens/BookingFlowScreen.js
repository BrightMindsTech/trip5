import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import i18n, { initI18n } from '../i18n';
import { ios } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { useOrder } from '../context/OrderContext';
import StepProgress from '../components/StepProgress';
import UnifiedFlowScreen from './UnifiedFlowScreen';

export default function BookingFlowScreen({ navigation }) {
  const route = useRoute();
  const appliedHomeParams = useRef(false);
  const appliedInitialDestination = useRef(false);
  const {
    order,
    updateOrder,
    currentStep,
    goNext,
    goBack,
    canProceedFromLocations,
    canProceedFromServiceSchedule,
    scheduleStep,
    setScheduleStep,
    orderDate,
    isSubmitting,
    submitError,
    orderSent,
    orderDispatch,
    submittedTripReference,
    submit,
    resetOrder,
    setCurrentStep,
  } = useOrder();

  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createBookingFlowStyles(colors, isDark), [colors, isDark]);

  const [locale, setLocale] = useState(i18n.locale);
  const [initialOpenAirportModal, setInitialOpenAirportModal] = useState(false);
  /** Height of StepProgress on map step — positions floating search below it */
  const [stepProgressHeight, setStepProgressHeight] = useState(132);

  useEffect(() => {
    initI18n()
      .then((lang) => setLocale(lang))
      .catch(() => setLocale('ar'));
  }, []);

  useEffect(() => {
    const p = route.params;
    if (p?.presetRoute != null || p?.openAirportModal === true) return;
    navigation.goBack();
  }, [navigation, route.params]);

  useEffect(() => {
    if (appliedHomeParams.current) return;
    const preset = route.params?.presetRoute;
    const openAir = route.params?.openAirportModal === true;
    if (preset == null && !openAir) return;
    appliedHomeParams.current = true;
    if (preset != null) {
      updateOrder({ route: preset, service: null });
    }
    setCurrentStep(2);
    if (openAir) {
      setInitialOpenAirportModal(true);
    }
  }, [route.params, updateOrder, setCurrentStep]);

  useEffect(() => {
    if (currentStep !== 2) return;
    const d = route.params?.initialDestination;
    if (!d || typeof d.latitude !== 'number' || typeof d.longitude !== 'number') return;
    if (appliedInitialDestination.current) return;
    updateOrder({
      skipDestination: false,
      destination: {
        latitude: d.latitude,
        longitude: d.longitude,
        address: d.address || '',
      },
    });
    appliedInitialDestination.current = true;
  }, [currentStep, route.params?.initialDestination, updateOrder]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        appliedHomeParams.current = false;
        appliedInitialDestination.current = false;
        resetOrder();
      };
    }, [resetOrder])
  );

  const insets = useSafeAreaInsets();
  const mapStep = currentStep === 2 && !orderSent;
  /** Step progress + status bar clearance for scroll areas (service & summary). */
  const contentTopInset =
    orderSent ? insets.top + 12 : currentStep >= 3 && !orderSent ? insets.top + stepProgressHeight : undefined;

  const getStepHeading = (step) => {
    const keys = ['step_heading_2', 'step_heading_3', 'step_heading_4'];
    return i18n.t(keys[step - 2] || 'step_heading_2');
  };

  const handleHeaderBack = () => {
    if (orderSent) return;
    if (currentStep === 2) {
      navigation.goBack();
    } else {
      goBack();
    }
  };

  const routeBadgeText = order.route
    ? (() => {
        const r = order.route;
        if (i18n.locale === 'ar') {
          if (r === 'irbid_to_amman') return i18n.t('from_irbid_to_amman');
          if (r === 'amman_to_irbid') return i18n.t('from_amman_to_irbid');
          if (r === 'airport_to_amman') return i18n.t('route_airport_to_amman');
          if (r === 'airport_to_irbid') return i18n.t('route_airport_to_irbid');
          if (r === 'amman_to_airport') return i18n.t('route_amman_to_airport');
          if (r === 'irbid_to_airport') return i18n.t('route_irbid_to_airport');
        } else {
          if (r === 'irbid_to_amman') return i18n.t('route_irbid_to_amman');
          if (r === 'amman_to_irbid') return i18n.t('route_amman_to_irbid');
          if (r === 'airport_to_amman') return i18n.t('route_airport_to_amman');
          if (r === 'airport_to_irbid') return i18n.t('route_airport_to_irbid');
          if (r === 'amman_to_airport') return i18n.t('route_amman_to_airport');
          if (r === 'irbid_to_airport') return i18n.t('route_irbid_to_airport');
        }
        return null;
      })()
    : null;

  const stepProgressEl = !orderSent && (
    <StepProgress
      current={currentStep}
      heading={getStepHeading(currentStep)}
      routeText={routeBadgeText}
      onLayout={(e) => setStepProgressHeight(Math.ceil(e.nativeEvent.layout.height))}
    />
  );

  /** Floating strip: step progress only (same for map + schedule + summary). */
  const chromeStepProgressOnly = !orderSent ? (
    <View style={[styles.mapStepProgressStrip, Platform.OS !== 'ios' && styles.mapStepProgressStripAndroid]}>
      {Platform.OS === 'ios' ? <BlurView intensity={88} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} /> : null}
      <View style={styles.mapStepProgressInner}>{stepProgressEl}</View>
    </View>
  ) : null;

  const mapFloatingSearchTop = insets.top + stepProgressHeight + 10;

  const flow = (
    <UnifiedFlowScreen
      order={order}
      updateOrder={updateOrder}
      goNext={goNext}
      goBack={goBack}
      currentStep={currentStep}
      onStopsBack={() => navigation.goBack()}
      onFlowBack={handleHeaderBack}
      contentTopInset={contentTopInset}
      canProceedFromLocations={canProceedFromLocations}
      canProceedFromServiceSchedule={canProceedFromServiceSchedule}
      scheduleStep={scheduleStep}
      setScheduleStep={setScheduleStep}
      orderDate={orderDate}
      isSubmitting={isSubmitting}
      submitError={submitError}
      orderSent={orderSent}
      orderDispatch={orderDispatch}
      submittedTripReference={submittedTripReference}
      submit={submit}
      resetOrder={resetOrder}
      onExitAfterSuccess={() => navigation.goBack()}
      exitAfterSuccessLabel={i18n.t('dashboard_back_home')}
      initialOpenAirportModal={initialOpenAirportModal}
      initialStopsMode={route.params?.initialDestination ? 'destination' : 'pickup'}
      mapFloatingSearchTop={mapStep ? mapFloatingSearchTop : undefined}
    />
  );

  const useOverlayChrome = mapStep || (!orderSent && currentStep >= 3);

  /**
   * Schedule + summary (step ≥ 3): omit bottom safe-area on this wrapper so the strip isn’t left
   * floating above the home indicator — `BookingFlowFooter` applies `paddingBottom: insets.bottom` itself.
   */
  const bookingSafeEdges = useMemo(() => {
    if (orderSent) return ['bottom', 'left', 'right'];
    if (mapStep) return ['bottom', 'left', 'right'];
    if (currentStep >= 3) return ['left', 'right'];
    return ['top', 'left', 'right', 'bottom'];
  }, [orderSent, mapStep, currentStep]);

  return (
    <View style={styles.safe} key={locale}>
      <SafeAreaView style={styles.safeInner} edges={bookingSafeEdges}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        {mapStep ? (
          <>
            <View style={styles.contentMapFill}>{flow}</View>
            {Platform.OS === 'ios' ? (
              <BlurView
                pointerEvents="none"
                intensity={90}
                tint={isDark ? 'dark' : 'light'}
                style={[styles.statusBarBlurBand, { height: Math.max(insets.top, 20) }]}
              />
            ) : (
              <View
                pointerEvents="none"
                style={[
                  styles.statusBarBlurBand,
                  styles.statusBarBlurBandAndroid,
                  { height: Math.max(insets.top, 24) },
                ]}
              />
            )}
            <View style={[styles.mapStepChrome, { paddingTop: insets.top }]}>{chromeStepProgressOnly}</View>
          </>
        ) : useOverlayChrome ? (
          <>
            <View style={styles.content}>{flow}</View>
            {Platform.OS === 'ios' ? (
              <BlurView
                pointerEvents="none"
                intensity={90}
                tint={isDark ? 'dark' : 'light'}
                style={[styles.statusBarBlurBand, { height: Math.max(insets.top, 20) }]}
              />
            ) : (
              <View
                pointerEvents="none"
                style={[
                  styles.statusBarBlurBand,
                  styles.statusBarBlurBandAndroid,
                  { height: Math.max(insets.top, 24) },
                ]}
              />
            )}
            <View style={[styles.mapStepChrome, { paddingTop: insets.top }]}>{chromeStepProgressOnly}</View>
          </>
        ) : orderSent ? (
          <>
            <View style={styles.content}>{flow}</View>
            {Platform.OS === 'ios' ? (
              <BlurView
                pointerEvents="none"
                intensity={90}
                tint={isDark ? 'dark' : 'light'}
                style={[styles.statusBarBlurBand, { height: Math.max(insets.top, 20) }]}
              />
            ) : (
              <View
                pointerEvents="none"
                style={[
                  styles.statusBarBlurBand,
                  styles.statusBarBlurBandAndroid,
                  { height: Math.max(insets.top, 24) },
                ]}
              />
            )}
          </>
        ) : (
          <View style={styles.content}>{flow}</View>
        )}
      </SafeAreaView>
    </View>
  );
}

function createBookingFlowStyles(colors, isDark) {
  return StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background, minHeight: 200, position: 'relative' },
  safeInner: { flex: 1, position: 'relative' },
  contentMapFill: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  statusBarBlurBand: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9,
    overflow: 'hidden',
  },
  statusBarBlurBandAndroid: {
    backgroundColor: isDark ? 'rgba(15,10,26,0.92)' : 'rgba(250, 245, 255, 0.88)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: isDark ? 'rgba(61, 42, 92, 0.9)' : 'rgba(233, 213, 255, 0.85)',
    elevation: 2,
  },
  mapStepChrome: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    elevation: 14,
  },
  mapStepProgressStrip: {
    position: 'relative',
    overflow: 'hidden',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  mapStepProgressStripAndroid: {
    backgroundColor: isDark ? 'rgba(26,19,51,0.96)' : 'rgba(255,255,255,0.94)',
  },
  mapStepProgressInner: {
    position: 'relative',
    zIndex: 1,
  },
  content: { flex: 1 },
});
}
