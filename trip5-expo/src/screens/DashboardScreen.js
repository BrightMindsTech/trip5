import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Platform,
  Alert,
  ImageBackground,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as Location from 'expo-location';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import i18n, { initI18n } from '../i18n';
import { colors, ios } from '../theme';
import { useAuth } from '../context/AuthContext';
import { useUserOrders } from '../hooks/useUserOrders';
import { useSavedPlaces } from '../hooks/useSavedPlaces';
import {
  partitionBookings,
  formatBookingDate,
  pickupSummary,
  destinationSummary,
  getRouteLabel,
  statusLabel,
} from '../utils/bookings';

const AMMAN_PHOTO = require('../../assets/amman-photo.png');
const IRBID_PHOTO = require('../../assets/irbid-photo.png');
const AIRPORT_PHOTO = require('../../assets/airport-photo.png');

function firstName(fullName) {
  const s = String(fullName || '').trim();
  if (!s) return '';
  return s.split(/\s+/)[0];
}

function savedKindIcon(kind) {
  switch (kind) {
    case 'home':
      return 'home-outline';
    case 'work':
      return 'briefcase-outline';
    case 'gym':
      return 'barbell-outline';
    default:
      return 'location-outline';
  }
}

function hasLatLng(obj) {
  return (
    obj &&
    typeof obj.latitude === 'number' &&
    typeof obj.longitude === 'number' &&
    !Number.isNaN(obj.latitude) &&
    !Number.isNaN(obj.longitude)
  );
}

function TripMapPreview({ pickup, destination, inRoute }) {
  const [userLocationOk, setUserLocationOk] = useState(false);

  useEffect(() => {
    if (!inRoute) {
      setUserLocationOk(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (!cancelled) setUserLocationOk(status === 'granted');
    })();
    return () => {
      cancelled = true;
    };
  }, [inRoute]);

  const hasP = hasLatLng(pickup);
  const hasD = hasLatLng(destination) && !destination?.pending;
  const region = useMemo(() => {
    if (!hasP) return null;
    if (hasD) {
      const lat = (pickup.latitude + destination.latitude) / 2;
      const lng = (pickup.longitude + destination.longitude) / 2;
      const latD = Math.abs(pickup.latitude - destination.latitude) * 2.2 + 0.03;
      const lngD = Math.abs(pickup.longitude - destination.longitude) * 2.2 + 0.03;
      return {
        latitude: lat,
        longitude: lng,
        latitudeDelta: Math.max(latD, 0.08),
        longitudeDelta: Math.max(lngD, 0.08),
      };
    }
    return {
      latitude: pickup.latitude,
      longitude: pickup.longitude,
      latitudeDelta: 0.06,
      longitudeDelta: 0.06,
    };
  }, [pickup, destination, hasP, hasD]);

  if (!hasP || !region) return null;

  const lineCoords =
    hasD && hasP
      ? [
          { latitude: pickup.latitude, longitude: pickup.longitude },
          { latitude: destination.latitude, longitude: destination.longitude },
        ]
      : null;

  return (
    <View style={mapStyles.wrap}>
      <MapView
        style={mapStyles.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={region}
        scrollEnabled={false}
        pitchEnabled={false}
        rotateEnabled={false}
        zoomEnabled={false}
        toolbarEnabled={false}
        showsUserLocation={Boolean(inRoute && userLocationOk)}
        showsMyLocationButton={false}
      >
        <Marker coordinate={{ latitude: pickup.latitude, longitude: pickup.longitude }} />
        {hasD ? (
          <Marker coordinate={{ latitude: destination.latitude, longitude: destination.longitude }} />
        ) : null}
        {lineCoords ? (
          <Polyline coordinates={lineCoords} strokeColor="rgba(255,255,255,0.9)" strokeWidth={3} />
        ) : null}
      </MapView>
      <View style={mapStyles.liveBadge} pointerEvents="none">
        <View style={mapStyles.liveDot} />
        <Text style={mapStyles.liveText}>{i18n.t('dashboard_live_tracking')}</Text>
      </View>
    </View>
  );
}

const mapStyles = StyleSheet.create({
  wrap: {
    height: 168,
    borderRadius: ios.radius.xl,
    overflow: 'hidden',
    marginBottom: ios.spacing.lg,
    backgroundColor: colors.logoDark,
  },
  map: { ...StyleSheet.absoluteFillObject },
  liveBadge: {
    position: 'absolute',
    top: ios.spacing.md,
    left: ios.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: ios.spacing.sm,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22C55E',
  },
  liveText: {
    color: colors.white,
    fontSize: ios.fontSize.caption,
    fontWeight: ios.fontWeight.semibold,
  },
});

export default function DashboardScreen({ navigation }) {
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const { loading, error, rows, refreshing, onRefresh } = useUserOrders();
  const {
    loading: savedLoading,
    error: savedError,
    rows: savedRows,
  } = useSavedPlaces();
  const [locale, setLocale] = useState(i18n.locale);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      initI18n()
        .then((lang) => {
          if (!cancelled) setLocale(lang);
        })
        .catch(() => {
          if (!cancelled) setLocale('ar');
        });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const { active } = partitionBookings(rows);
  const appName = Constants.expoConfig?.name || 'Trip5';
  const fn = firstName(profile?.full_name);

  const goBooking = (navParams) =>
    navParams === undefined ? navigation.navigate('Booking') : navigation.navigate('Booking', navParams);

  const goSavedPlaces = useCallback(() => {
    navigation.navigate('SavedPlaces');
  }, [navigation]);

  const previewSaved = useMemo(() => savedRows.slice(0, 3), [savedRows]);

  const showMapPreview = Boolean(active && hasLatLng(active.pickup));

  const chromeHeader = (
    <View style={[styles.headerWrapper, Platform.OS !== 'ios' && styles.headerWrapperAndroid]}>
      {Platform.OS === 'ios' ? (
        <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
      ) : null}
      <View style={styles.header}>
        <View style={styles.headerSide}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(String(profile?.full_name || '?').trim().slice(0, 1) || '?').toUpperCase()}
            </Text>
          </View>
        </View>
        <Text style={styles.headerTitle}>{appName}</Text>
        <View style={[styles.headerSide, styles.headerSideRight]}>
          <TouchableOpacity
            onPress={() => Alert.alert(i18n.t('notifications_a11y'), i18n.t('notifications_placeholder_body'))}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel={i18n.t('notifications_a11y')}
          >
            <Ionicons name="notifications-outline" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.safe}>
      <SafeAreaView style={styles.safeInner} edges={['top', 'left', 'right']}>
        {chromeHeader}
        <ScrollView
          key={locale}
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + ios.spacing.xxl + 8 }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <LinearGradient
            colors={['#F3E8FF', colors.background, colors.background]}
            locations={[0, 0.35, 1]}
            style={styles.heroGradient}
          >
            {fn ? (
              <Text style={styles.greeting}>
                <Text style={styles.greetingDark}>{i18n.t('dashboard_greeting_prefix')}</Text>
                <Text style={styles.greetingAccent}> {fn}</Text>
                <Text style={styles.greetingAccent}>{i18n.locale === 'ar' ? '؟' : '?'}</Text>
              </Text>
            ) : (
              <Text style={styles.greetingSingle}>{i18n.t('dashboard_greeting_no_name')}</Text>
            )}

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.moveTodayScroll}
              contentContainerStyle={styles.moveTodayScrollContent}
              nestedScrollEnabled
            >
              <Pressable
                style={({ pressed }) => [styles.locationBannerWrap, pressed && styles.locationBannerPressed]}
                onPress={() => goBooking({ presetRoute: 'amman_to_irbid' })}
              >
                <ImageBackground
                  source={IRBID_PHOTO}
                  style={styles.locationBannerImage}
                  imageStyle={styles.locationBannerImageRadius}
                  resizeMode="cover"
                >
                  <View style={styles.locationBannerOverlay} />
                  <View style={styles.locationBannerInner}>
                    <View style={styles.locationBannerTextCol}>
                      <Text style={styles.locationBannerCity}>
                        {i18n.locale === 'ar' ? 'إربد' : 'Irbid'}
                      </Text>
                      <Text style={styles.locationBannerSub} numberOfLines={2}>
                        {i18n.t('route_card_irbid')}
                      </Text>
                    </View>
                    <View style={styles.locationBannerArrow}>
                      <Text style={styles.locationBannerArrowText}>→</Text>
                    </View>
                  </View>
                </ImageBackground>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.locationBannerWrap, pressed && styles.locationBannerPressed]}
                onPress={() => goBooking({ presetRoute: 'irbid_to_amman' })}
              >
                <ImageBackground
                  source={AMMAN_PHOTO}
                  style={styles.locationBannerImage}
                  imageStyle={styles.locationBannerImageRadius}
                  resizeMode="cover"
                >
                  <View style={styles.locationBannerOverlay} />
                  <View style={styles.locationBannerInner}>
                    <View style={styles.locationBannerTextCol}>
                      <Text style={styles.locationBannerCity}>
                        {i18n.locale === 'ar' ? 'عمّان' : 'Amman'}
                      </Text>
                      <Text style={styles.locationBannerSub} numberOfLines={2}>
                        {i18n.t('route_card_amman')}
                      </Text>
                    </View>
                    <View style={styles.locationBannerArrow}>
                      <Text style={styles.locationBannerArrowText}>→</Text>
                    </View>
                  </View>
                </ImageBackground>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.locationBannerWrap, pressed && styles.locationBannerPressed]}
                onPress={() => goBooking({ openAirportModal: true })}
              >
                <ImageBackground
                  source={AIRPORT_PHOTO}
                  style={styles.locationBannerImage}
                  imageStyle={styles.locationBannerImageRadius}
                  resizeMode="cover"
                >
                  <View style={styles.locationBannerOverlay} />
                  <View style={styles.locationBannerInner}>
                    <View style={styles.locationBannerTextCol}>
                      <Text style={styles.locationBannerCity}>{i18n.t('airport')}</Text>
                      <Text style={styles.locationBannerSub} numberOfLines={2}>
                        {i18n.t('service_airport_desc')}
                      </Text>
                    </View>
                    <View style={styles.locationBannerArrow}>
                      <Text style={styles.locationBannerArrowText}>→</Text>
                    </View>
                  </View>
                </ImageBackground>
              </Pressable>
            </ScrollView>
          </LinearGradient>

          <Text style={styles.sectionHeading}>{i18n.t('dashboard_active_section')}</Text>
          {loading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.muted}>{i18n.t('dashboard_loading')}</Text>
            </View>
          ) : error ? (
            <View style={styles.centerBox}>
              <Text style={styles.errorText}>{i18n.t('dashboard_error')}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={onRefresh}>
                <Text style={styles.retryBtnText}>{i18n.t('dashboard_retry')}</Text>
              </TouchableOpacity>
            </View>
          ) : active ? (
            <>
              <LinearGradient
                colors={[colors.primary, colors.primaryDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.activeGradient}
              >
                <View style={styles.activeTop}>
                  <Text style={styles.activeLabel}>{i18n.t('dashboard_ongoing_trip')}</Text>
                  <View style={styles.statusPill}>
                    <Text style={styles.statusPillText}>{statusLabel(active.status)}</Text>
                  </View>
                </View>
                <Text style={styles.activeRoute}>{getRouteLabel(active.route)}</Text>
                <Text style={styles.activeWhen}>{formatBookingDate(active.scheduled_at, i18n.locale)}</Text>
                <View style={styles.activeDetails}>
                  <Text style={styles.activeLine} numberOfLines={2}>
                    {i18n.t('pickup_location')}: {pickupSummary(active.pickup) || '—'}
                  </Text>
                  <Text style={styles.activeLine} numberOfLines={2}>
                    {i18n.t('destination')}:{' '}
                    {active.destination?.pending
                      ? i18n.t('no_destination_selected')
                      : destinationSummary(active.destination) || '—'}
                  </Text>
                </View>
              </LinearGradient>
              {String(active.status || '').toLowerCase() === 'in_route' ? (
                <TouchableOpacity
                  style={styles.inRouteBanner}
                  onPress={() => navigation.navigate('TripTracking', { orderId: active.id })}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={i18n.t('dashboard_in_route_banner_title')}
                >
                  <View style={styles.inRouteBannerTextCol}>
                    <Text style={styles.inRouteBannerTitle}>{i18n.t('dashboard_in_route_banner_title')}</Text>
                    <Text style={styles.inRouteBannerSub} numberOfLines={2}>
                      {i18n.t('dashboard_in_route_banner_sub')}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={22} color={colors.primary} />
                </TouchableOpacity>
              ) : null}
              {showMapPreview ? (
                <TripMapPreview
                  pickup={active.pickup}
                  destination={active.destination}
                  inRoute={String(active.status || '').toLowerCase() === 'in_route'}
                />
              ) : (
                <View style={styles.mapPlaceholder}>
                  <Ionicons name="map-outline" size={40} color={colors.metallic} />
                  <Text style={styles.mapPlaceholderText}>{i18n.t('dashboard_live_tracking')}</Text>
                </View>
              )}
            </>
          ) : (
            <Text style={styles.emptyHint}>{i18n.t('dashboard_no_active')}</Text>
          )}

          <View style={styles.savedHeader}>
            <Text style={styles.sectionHeadingFlat}>{i18n.t('saved_places_title')}</Text>
            <TouchableOpacity onPress={goSavedPlaces} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.seeAll}>{i18n.t('saved_places_see_all')}</Text>
            </TouchableOpacity>
          </View>
          {savedLoading ? (
            <View style={styles.savedLoadingRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.savedLoadingText}>{i18n.t('saved_places_loading')}</Text>
            </View>
          ) : savedError ? (
            <Text style={styles.savedErrorText}>{savedError}</Text>
          ) : previewSaved.length === 0 ? (
            <TouchableOpacity style={styles.savedEmptyWrap} onPress={goSavedPlaces} activeOpacity={0.75}>
              <Text style={styles.savedEmptyText}>{i18n.t('saved_places_empty')}</Text>
            </TouchableOpacity>
          ) : (
            previewSaved.map((place) => (
              <TouchableOpacity
                key={place.id}
                style={styles.savedRow}
                onPress={() =>
                  goBooking({
                    presetRoute: 'amman_to_irbid',
                    initialPickup: {
                      latitude: place.latitude,
                      longitude: place.longitude,
                      address: place.address || '',
                    },
                  })
                }
                activeOpacity={0.75}
              >
                <View style={styles.savedIcon}>
                  <Ionicons name={savedKindIcon(place.kind)} size={20} color={colors.primary} />
                </View>
                <View style={styles.savedBody}>
                  <Text style={styles.savedTitle}>{place.label}</Text>
                  <Text style={styles.savedAddr} numberOfLines={1}>
                    {place.address}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.placeholder} />
              </TouchableOpacity>
            ))
          )}

          <Text style={[styles.sectionHeading, styles.promoSection]}>{i18n.t('promo_section_title')}</Text>
          <View style={styles.promoRow}>
            <LinearGradient
              colors={[colors.logoDark, '#2D1B4E']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.promoCard}
            >
              <View style={styles.promoTag}>
                <Text style={styles.promoTagText}>{i18n.t('promo_exclusive_tag')}</Text>
              </View>
              <Text style={styles.promoBody}>{i18n.t('promo_exclusive_body')}</Text>
            </LinearGradient>
            <LinearGradient
              colors={['#312E81', colors.logoDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.promoCard}
            >
              <View style={[styles.promoTag, styles.promoTagLight]}>
                <Text style={[styles.promoTagText, styles.promoTagTextDark]}>{i18n.t('promo_subscription_tag')}</Text>
              </View>
              <Text style={styles.promoBody}>{i18n.t('promo_subscription_body')}</Text>
            </LinearGradient>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  safeInner: { flex: 1 },
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
    minHeight: 52,
  },
  headerSide: {
    width: 48,
    alignItems: 'flex-start',
  },
  headerSideRight: {
    alignItems: 'flex-end',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: ios.fontSize.title3,
    fontWeight: ios.fontWeight.bold,
    color: colors.text,
    letterSpacing: 0.5,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  avatarText: {
    fontSize: ios.fontSize.callout,
    fontWeight: ios.fontWeight.bold,
    color: colors.primaryDark,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: ios.spacing.lg,
  },
  heroGradient: {
    marginHorizontal: -ios.spacing.lg,
    paddingHorizontal: ios.spacing.lg,
    paddingTop: ios.spacing.md,
    paddingBottom: ios.spacing.lg,
    borderBottomLeftRadius: ios.radius.xxl,
    borderBottomRightRadius: ios.radius.xxl,
  },
  greeting: {
    fontSize: ios.fontSize.title1,
    fontWeight: ios.fontWeight.bold,
    marginBottom: ios.spacing.lg,
    lineHeight: 34,
  },
  greetingDark: {
    color: colors.text,
    fontSize: ios.fontSize.title1,
    fontWeight: ios.fontWeight.bold,
  },
  greetingAccent: {
    color: colors.primary,
    fontSize: ios.fontSize.title1,
    fontWeight: ios.fontWeight.bold,
  },
  greetingSingle: {
    fontSize: ios.fontSize.title1,
    fontWeight: ios.fontWeight.bold,
    color: colors.text,
    marginBottom: ios.spacing.lg,
  },
  moveTodayScroll: {
    marginHorizontal: -ios.spacing.lg,
    marginBottom: ios.spacing.sm,
  },
  moveTodayScrollContent: {
    paddingHorizontal: ios.spacing.lg,
    gap: ios.spacing.md,
    paddingBottom: 2,
  },
  locationBannerWrap: {
    width: 264,
    height: 168,
    borderRadius: ios.radius.xl,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.14,
        shadowRadius: 10,
      },
      android: { elevation: 5 },
    }),
  },
  locationBannerPressed: { opacity: 0.92 },
  locationBannerImage: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  locationBannerImageRadius: {
    borderRadius: ios.radius.xl,
  },
  locationBannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.38)',
  },
  locationBannerInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    padding: ios.spacing.lg,
  },
  locationBannerTextCol: { flex: 1, paddingRight: ios.spacing.sm },
  locationBannerCity: {
    fontSize: ios.fontSize.title3,
    fontWeight: ios.fontWeight.bold,
    color: colors.white,
    letterSpacing: -0.3,
  },
  locationBannerSub: {
    marginTop: 4,
    fontSize: ios.fontSize.footnote,
    color: 'rgba(255,255,255,0.92)',
  },
  locationBannerArrow: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationBannerArrowText: {
    color: colors.white,
    fontSize: 20,
    fontWeight: ios.fontWeight.bold,
  },
  sectionHeading: {
    fontSize: ios.fontSize.title3,
    fontWeight: ios.fontWeight.bold,
    color: colors.text,
    marginTop: ios.spacing.lg,
    marginBottom: ios.spacing.md,
  },
  sectionHeadingFlat: {
    fontSize: ios.fontSize.title3,
    fontWeight: ios.fontWeight.bold,
    color: colors.text,
  },
  centerBox: {
    paddingVertical: ios.spacing.lg,
    alignItems: 'center',
  },
  muted: {
    marginTop: ios.spacing.sm,
    fontSize: ios.fontSize.footnote,
    color: colors.placeholder,
  },
  errorText: {
    fontSize: ios.fontSize.footnote,
    color: colors.error,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: ios.spacing.md,
    paddingVertical: ios.spacing.sm,
    paddingHorizontal: ios.spacing.lg,
    backgroundColor: colors.primaryLight,
    borderRadius: ios.radius.md,
  },
  retryBtnText: {
    color: colors.primaryDark,
    fontWeight: ios.fontWeight.semibold,
    fontSize: ios.fontSize.subhead,
  },
  activeGradient: {
    borderRadius: ios.radius.xl,
    padding: ios.spacing.lg,
    marginBottom: ios.spacing.md,
  },
  activeTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: ios.spacing.sm,
  },
  activeLabel: {
    fontSize: ios.fontSize.caption,
    fontWeight: ios.fontWeight.bold,
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  statusPill: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: ios.spacing.sm,
    paddingVertical: 4,
    borderRadius: ios.radius.md,
  },
  statusPillText: {
    fontSize: ios.fontSize.caption,
    fontWeight: ios.fontWeight.semibold,
    color: colors.white,
  },
  activeRoute: {
    fontSize: ios.fontSize.title3,
    fontWeight: ios.fontWeight.bold,
    color: colors.white,
    marginBottom: ios.spacing.xs,
  },
  activeWhen: {
    fontSize: ios.fontSize.footnote,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: ios.spacing.md,
  },
  activeDetails: {
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderRadius: ios.radius.lg,
    padding: ios.spacing.md,
  },
  activeLine: {
    fontSize: ios.fontSize.footnote,
    color: colors.white,
    marginTop: 4,
  },
  inRouteBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: ios.radius.lg,
    paddingVertical: ios.spacing.md,
    paddingHorizontal: ios.spacing.lg,
    marginBottom: ios.spacing.md,
    gap: ios.spacing.sm,
  },
  inRouteBannerTextCol: {
    flex: 1,
  },
  inRouteBannerTitle: {
    fontSize: ios.fontSize.callout,
    fontWeight: ios.fontWeight.semibold,
    color: colors.text,
  },
  inRouteBannerSub: {
    fontSize: ios.fontSize.caption,
    color: colors.placeholder,
    marginTop: 4,
  },
  emptyHint: {
    fontSize: ios.fontSize.footnote,
    color: colors.placeholder,
    marginBottom: ios.spacing.lg,
  },
  mapPlaceholder: {
    height: 120,
    borderRadius: ios.radius.xl,
    backgroundColor: colors.logoDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: ios.spacing.lg,
    gap: ios.spacing.sm,
  },
  mapPlaceholderText: {
    fontSize: ios.fontSize.caption,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: ios.fontWeight.medium,
  },
  savedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: ios.spacing.md,
    marginBottom: ios.spacing.md,
  },
  seeAll: {
    fontSize: ios.fontSize.subhead,
    fontWeight: ios.fontWeight.semibold,
    color: colors.primary,
  },
  savedLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ios.spacing.sm,
    marginBottom: ios.spacing.md,
  },
  savedLoadingText: {
    fontSize: ios.fontSize.caption,
    color: colors.placeholder,
  },
  savedErrorText: {
    fontSize: ios.fontSize.caption,
    color: colors.error,
    marginBottom: ios.spacing.sm,
  },
  savedEmptyWrap: {
    paddingVertical: ios.spacing.md,
    marginBottom: ios.spacing.sm,
  },
  savedEmptyText: {
    fontSize: ios.fontSize.caption,
    color: colors.placeholder,
    lineHeight: 20,
  },
  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: ios.radius.lg,
    padding: ios.spacing.md,
    marginBottom: ios.spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  savedIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: ios.spacing.md,
  },
  savedBody: { flex: 1 },
  savedTitle: {
    fontSize: ios.fontSize.callout,
    fontWeight: ios.fontWeight.semibold,
    color: colors.text,
  },
  savedAddr: {
    marginTop: 2,
    fontSize: ios.fontSize.caption,
    color: colors.placeholder,
  },
  promoSection: {
    marginTop: ios.spacing.lg,
  },
  promoRow: {
    flexDirection: 'row',
    gap: ios.spacing.md,
    marginBottom: ios.spacing.xxl,
  },
  promoCard: {
    flex: 1,
    minHeight: 140,
    borderRadius: ios.radius.xl,
    padding: ios.spacing.md,
    justifyContent: 'flex-end',
  },
  promoTag: {
    position: 'absolute',
    top: ios.spacing.md,
    left: ios.spacing.md,
    backgroundColor: colors.primary,
    paddingHorizontal: ios.spacing.sm,
    paddingVertical: 4,
    borderRadius: ios.radius.sm,
  },
  promoTagLight: {
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  promoTagText: {
    fontSize: 10,
    fontWeight: ios.fontWeight.bold,
    color: colors.white,
    letterSpacing: 0.5,
  },
  promoTagTextDark: {
    color: colors.logoDark,
  },
  promoBody: {
    fontSize: ios.fontSize.subhead,
    fontWeight: ios.fontWeight.semibold,
    color: colors.white,
    lineHeight: 20,
  },
});
