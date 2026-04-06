import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import i18n, { initI18n } from '../i18n';
import { colors, ios } from '../theme';
import { useAuth } from '../context/AuthContext';
import { useOrder } from '../context/OrderContext';
import { Ionicons } from '@expo/vector-icons';
import StepProgress from '../components/StepProgress';
import LanguageToggle from '../components/LanguageToggle';
import WalletModal from '../components/WalletModal';
import UnifiedFlowScreen from './UnifiedFlowScreen';

export default function BookingFlowScreen({ navigation }) {
  const route = useRoute();
  const appliedHomeParams = useRef(false);
  const appliedInitialPickup = useRef(false);
  const { signOut } = useAuth();
  const {
    order,
    updateOrder,
    currentStep,
    goNext,
    goBack,
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
    setCurrentStep,
  } = useOrder();

  const [locale, setLocale] = useState(i18n.locale);
  const [walletVisible, setWalletVisible] = useState(false);
  const [initialOpenAirportModal, setInitialOpenAirportModal] = useState(false);

  useEffect(() => {
    initI18n()
      .then((lang) => setLocale(lang))
      .catch(() => setLocale('ar'));
  }, []);

  useEffect(() => {
    if (appliedHomeParams.current) return;
    const preset = route.params?.presetRoute;
    const openAir = route.params?.openAirportModal;
    if (preset == null && !openAir) return;
    appliedHomeParams.current = true;
    if (preset != null) {
      updateOrder({ route: preset, service: null });
      // Same as wizard step 1: after choosing Irbid or Amman route, continue to the map (step 2).
      if (preset === 'amman_to_irbid' || preset === 'irbid_to_amman') {
        setCurrentStep(2);
      }
    }
    if (openAir) {
      setInitialOpenAirportModal(true);
    }
  }, [route.params, updateOrder, setCurrentStep]);

  useEffect(() => {
    if (currentStep !== 2) return;
    const p = route.params?.initialPickup;
    if (!p || typeof p.latitude !== 'number' || typeof p.longitude !== 'number') return;
    if (appliedInitialPickup.current) return;
    updateOrder({
      pickup: {
        latitude: p.latitude,
        longitude: p.longitude,
        address: p.address || '',
      },
    });
    appliedInitialPickup.current = true;
  }, [currentStep, route.params?.initialPickup, updateOrder]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        appliedHomeParams.current = false;
        appliedInitialPickup.current = false;
        resetOrder();
      };
    }, [resetOrder])
  );

  const refreshLocale = useCallback(() => {
    setLocale(i18n.locale);
  }, []);

  const insets = useSafeAreaInsets();
  const mapStep = currentStep === 2 && !orderSent;

  const getStepHeading = (step) => {
    const keys = ['step_heading_1', 'step_heading_2', 'step_heading_3', 'step_heading_4'];
    return i18n.t(keys[step - 1] || 'step_heading_1');
  };

  const handleHeaderBack = () => {
    if (orderSent) return;
    if (currentStep > 1) {
      goBack();
    } else {
      navigation.goBack();
    }
  };

  const chrome = (
    <>
      <View style={[styles.headerWrapper, Platform.OS !== 'ios' && styles.headerWrapperAndroid]}>
        {Platform.OS === 'ios' ? (
          <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
        ) : null}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              onPress={handleHeaderBack}
              style={styles.backBtn}
              activeOpacity={0.6}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              disabled={orderSent}
            >
              <Text style={[styles.backChevron, orderSent && styles.backChevronDisabled]}>‹</Text>
              <Text style={[styles.backText, orderSent && styles.backChevronDisabled]}>{i18n.t('back')}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.headerSpacer} />
          <View style={styles.headerRight}>
            <TouchableOpacity
              onPress={() => setWalletVisible(true)}
              style={styles.walletBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel={i18n.t('wallet_title')}
            >
              <Ionicons name="wallet-outline" size={22} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => signOut()} style={styles.signOutBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={styles.signOutText}>{i18n.t('sign_out')}</Text>
            </TouchableOpacity>
            <LanguageToggle onToggle={refreshLocale} />
          </View>
        </View>
      </View>
      {!orderSent && (
        <StepProgress
          current={currentStep}
          total={4}
          heading={currentStep === 1 ? null : getStepHeading(currentStep)}
          routeText={
            order.route
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
              : null
          }
        />
      )}
    </>
  );

  const flow = (
    <UnifiedFlowScreen
      order={order}
      updateOrder={updateOrder}
      goNext={goNext}
      goBack={goBack}
      currentStep={currentStep}
      canProceedFromRoute={canProceedFromRoute}
      canProceedFromLocations={canProceedFromLocations}
      canProceedFromServiceSchedule={canProceedFromServiceSchedule}
      scheduleStep={scheduleStep}
      setScheduleStep={setScheduleStep}
      orderDate={orderDate}
      isSubmitting={isSubmitting}
      submitError={submitError}
      orderSent={orderSent}
      submit={submit}
      resetOrder={resetOrder}
      onExitAfterSuccess={() => navigation.goBack()}
      exitAfterSuccessLabel={i18n.t('dashboard_back_home')}
      initialOpenAirportModal={initialOpenAirportModal}
    />
  );

  return (
    <View style={styles.safe} key={locale}>
      <SafeAreaView
        style={styles.safeInner}
        edges={mapStep ? ['bottom', 'left', 'right'] : ['top', 'left', 'right', 'bottom']}
      >
        <StatusBar style="dark" />
        {mapStep ? (
          <>
            <View style={styles.contentMapFill}>{flow}</View>
            {Platform.OS === 'ios' ? (
              <BlurView
                pointerEvents="none"
                intensity={90}
                tint="light"
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
            <View style={[styles.mapStepChrome, { paddingTop: insets.top }]}>{chrome}</View>
          </>
        ) : (
          <>
            {chrome}
            <View style={styles.content}>{flow}</View>
          </>
        )}
      </SafeAreaView>
      <WalletModal visible={walletVisible} onClose={() => setWalletVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: 'rgba(250, 245, 255, 0.88)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(233, 213, 255, 0.85)',
    elevation: 2,
  },
  mapStepChrome: {
    zIndex: 10,
    elevation: 14,
  },
  headerWrapper: {
    position: 'relative',
    overflow: 'hidden',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerWrapperAndroid: {
    backgroundColor: colors.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: ios.spacing.lg,
    paddingVertical: ios.spacing.sm,
    minHeight: 36,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', minWidth: 80 },
  headerSpacer: { flex: 1 },
  headerRight: { minWidth: 148, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
  walletBtn: { paddingVertical: 6, paddingHorizontal: 4, marginRight: 4 },
  signOutBtn: { paddingVertical: 6, paddingHorizontal: 4, marginRight: 8 },
  signOutText: { fontSize: 14, color: colors.textSecondary, fontWeight: '500' },
  backChevronDisabled: { color: colors.textSecondary, opacity: 0.7 },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingRight: 8,
  },
  backChevron: {
    fontSize: 28,
    fontWeight: '300',
    color: colors.primary,
    marginTop: -4,
    marginRight: 4,
  },
  backText: {
    fontSize: ios.fontSize.body,
    color: colors.primary,
    fontWeight: ios.fontWeight.regular,
  },
  content: { flex: 1 },
});
