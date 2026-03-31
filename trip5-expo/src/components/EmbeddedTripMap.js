import React, { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Switch,
  Pressable,
  useWindowDimensions,
  ScrollView,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import i18n from '../i18n';
import { Config } from '../config';
import { colors, ios } from '../theme';

const JORDAN_CENTER = { latitude: 32.5565, longitude: 35.8467 };
const INITIAL_DELTA = { latitudeDelta: 0.28, longitudeDelta: 0.28 };

/** Approximate geographic bounds for Jordan (validation + search bias). */
const JORDAN_BOUNDS = {
  minLat: 29.15,
  maxLat: 33.42,
  minLng: 34.85,
  maxLng: 39.35,
};

function isInJordan(lat, lng) {
  if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) return false;
  return (
    lat >= JORDAN_BOUNDS.minLat &&
    lat <= JORDAN_BOUNDS.maxLat &&
    lng >= JORDAN_BOUNDS.minLng &&
    lng <= JORDAN_BOUNDS.maxLng
  );
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function estimateDriveMinutes(km) {
  if (km <= 0) return null;
  const avgKmh = 38;
  return Math.max(1, Math.round((km / avgKmh) * 60));
}

function formatKm(km) {
  if (km == null || Number.isNaN(km)) return null;
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

/** Decodes Google Directions `overview_polyline` into `{ latitude, longitude }[]`. */
function decodeGooglePolyline(encoded) {
  if (!encoded || typeof encoded !== 'string') return [];
  const coords = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;
  while (index < len) {
    let b;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lat += dlat;
    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lng += dlng;
    coords.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return coords;
}

/** Downsample for fitToCoordinates when the polyline has many points. */
function sampleCoordsForFit(coords, maxPoints) {
  if (!coords?.length || coords.length <= maxPoints) return coords;
  const out = [];
  const n = coords.length;
  const step = (n - 1) / (maxPoints - 1);
  for (let i = 0; i < maxPoints; i++) {
    out.push(coords[Math.min(n - 1, Math.round(i * step))]);
  }
  return out;
}

function MapOverlays({ order, lineCoords, skipDestination }) {
  return (
    <>
      {lineCoords && lineCoords.length >= 2 && (
        <Polyline
          coordinates={lineCoords}
          strokeColor={colors.primary}
          strokeWidth={4}
          lineCap="round"
          lineJoin="round"
        />
      )}
      {order.pickup?.latitude != null && (
        <Marker
          coordinate={{ latitude: order.pickup.latitude, longitude: order.pickup.longitude }}
          anchor={{ x: 0.5, y: 1 }}
          tracksViewChanges={false}
        >
          <View style={styles.markerWrap}>
            <View style={styles.markerLabelPickup}>
              <Text style={styles.markerLabelText}>{i18n.t('map_marker_pickup_label')}</Text>
            </View>
            <View style={styles.markerDotPickup}>
              <View style={styles.markerDotInner} />
            </View>
          </View>
        </Marker>
      )}
      {!skipDestination && order.destination?.latitude != null && (
        <Marker
          coordinate={{
            latitude: order.destination.latitude,
            longitude: order.destination.longitude,
          }}
          anchor={{ x: 0.5, y: 1 }}
          tracksViewChanges={false}
        >
          <View style={styles.markerWrap}>
            <View style={styles.markerLabelDrop}>
              <Text style={styles.markerLabelTextDrop}>{i18n.t('map_marker_dropoff_label')}</Text>
            </View>
            <View style={styles.markerDotDrop}>
              <View style={styles.markerDotInner} />
            </View>
          </View>
        </Marker>
      )}
    </>
  );
}

export default function EmbeddedTripMap({
  order,
  updateOrder,
  activeMode,
  setActiveMode,
  onNext = () => {},
  nextDisabled = false,
}) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [sheetHeight, setSheetHeight] = useState(260);
  const [bleedOffset, setBleedOffset] = useState(0);
  const [routePathCoords, setRoutePathCoords] = useState(null);
  const [routeLegMetrics, setRouteLegMetrics] = useState(null);
  const sheetHeightRef = useRef(260);
  const directionsReqId = useRef(0);
  const rootRef = useRef(null);
  const mapRefPickup = useRef(null);
  const mapRefDestination = useRef(null);
  const placesRef = useRef(null);
  const orderPickRef = useRef(order.pickup);
  const orderDestRef = useRef(order.destination);
  orderPickRef.current = order.pickup;
  orderDestRef.current = order.destination;

  const skipDestination = order.skipDestination === true;

  const placesQuery = useMemo(
    () => ({
      key: Config.googleMapsApiKey,
      language: i18n.locale === 'ar' ? 'ar' : 'en',
      components: 'country:jo',
      location: `${JORDAN_CENTER.latitude},${JORDAN_CENTER.longitude}`,
      radius: 350000,
    }),
    [i18n.locale]
  );

  const lineCoords = useMemo(() => {
    if (skipDestination) return null;
    const p = order.pickup;
    const d = order.destination;
    if (!p || !d || p.latitude == null || d.latitude == null) return null;
    return [
      { latitude: p.latitude, longitude: p.longitude },
      { latitude: d.latitude, longitude: d.longitude },
    ];
  }, [order.pickup, order.destination, skipDestination]);

  useEffect(() => {
    if (skipDestination) {
      setRoutePathCoords(null);
      setRouteLegMetrics(null);
      return;
    }
    const p = order.pickup;
    const d = order.destination;
    if (!p || !d || p.latitude == null || d.latitude == null) {
      setRoutePathCoords(null);
      setRouteLegMetrics(null);
      return;
    }
    const apiKey = Config.googleMapsApiKey;
    if (!apiKey) {
      setRoutePathCoords(null);
      setRouteLegMetrics(null);
      return;
    }
    const reqId = ++directionsReqId.current;
    setRoutePathCoords(null);
    setRouteLegMetrics(null);
    (async () => {
      try {
        const origin = `${p.latitude},${p.longitude}`;
        const dest = `${d.latitude},${d.longitude}`;
        const url =
          `https://maps.googleapis.com/maps/api/directions/json?` +
          `origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(dest)}` +
          `&mode=driving&region=jo&key=${encodeURIComponent(apiKey)}`;
        const res = await fetch(url);
        const data = await res.json();
        if (reqId !== directionsReqId.current) return;
        if (data.status !== 'OK' || !data.routes?.[0]?.overview_polyline?.points) {
          return;
        }
        const decoded = decodeGooglePolyline(data.routes[0].overview_polyline.points);
        if (decoded.length < 2) return;
        if (reqId !== directionsReqId.current) return;
        setRoutePathCoords(decoded);
        const leg = data.routes[0].legs?.[0];
        if (leg?.distance?.value != null && leg?.duration?.value != null) {
          setRouteLegMetrics({
            km: leg.distance.value / 1000,
            minutes: Math.round(leg.duration.value / 60),
          });
        }
      } catch {
        if (reqId !== directionsReqId.current) return;
        setRoutePathCoords(null);
        setRouteLegMetrics(null);
      }
    })();
  }, [
    order.pickup?.latitude,
    order.pickup?.longitude,
    order.destination?.latitude,
    order.destination?.longitude,
    skipDestination,
  ]);

  const polylineCoords = useMemo(() => {
    if (routePathCoords && routePathCoords.length >= 2) return routePathCoords;
    return lineCoords;
  }, [routePathCoords, lineCoords]);

  const routeMetrics = useMemo(() => {
    if (skipDestination) return { km: null, minutes: null };
    const p = order.pickup;
    const d = order.destination;
    if (!p || !d || p.latitude == null || d.latitude == null) return { km: null, minutes: null };
    if (routeLegMetrics) return routeLegMetrics;
    const km = haversineKm(p.latitude, p.longitude, d.latitude, d.longitude);
    return { km, minutes: estimateDriveMinutes(km) };
  }, [order.pickup, order.destination, skipDestination, routeLegMetrics]);

  useEffect(() => {
    const p = order.pickup;
    const d = order.destination;
    const bottomPad = Math.max(sheetHeightRef.current + 24, 140);
    const edgePadding = { top: 56, right: 44, bottom: bottomPad, left: 44 };
    const showPickupMap = skipDestination || activeMode === 'pickup';
    const showDestMap = !skipDestination && activeMode === 'destination';

    const both =
      !skipDestination && p?.latitude != null && d?.latitude != null
        ? routePathCoords && routePathCoords.length >= 2
          ? sampleCoordsForFit(routePathCoords, 100)
          : [
              { latitude: p.latitude, longitude: p.longitude },
              { latitude: d.latitude, longitude: d.longitude },
            ]
        : null;

    if (both) {
      if (showPickupMap && mapRefPickup.current) {
        mapRefPickup.current.fitToCoordinates(both, { edgePadding, animated: true });
        return;
      }
      if (showDestMap && mapRefDestination.current) {
        mapRefDestination.current.fitToCoordinates(both, { edgePadding, animated: true });
        return;
      }
    }

    if (showPickupMap && p?.latitude != null) {
      mapRefPickup.current?.animateToRegion(
        { latitude: p.latitude, longitude: p.longitude, latitudeDelta: 0.08, longitudeDelta: 0.08 },
        420
      );
    }
    if (showDestMap && d?.latitude != null) {
      mapRefDestination.current?.animateToRegion(
        { latitude: d.latitude, longitude: d.longitude, latitudeDelta: 0.08, longitudeDelta: 0.08 },
        420
      );
    }
  }, [
    order.pickup?.latitude,
    order.pickup?.longitude,
    order.destination?.latitude,
    order.destination?.longitude,
    skipDestination,
    activeMode,
    routePathCoords,
  ]);

  const reverseGeocode = async (lat, lng) => {
    try {
      const [addr] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      const addrStr = addr
        ? [addr.street, addr.city, addr.region, addr.country].filter(Boolean).join(', ') ||
          `${lat.toFixed(4)}, ${lng.toFixed(4)}`
        : `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      placesRef.current?.setAddressText(addrStr);
      return addrStr;
    } catch {
      const fallback = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      placesRef.current?.setAddressText(fallback);
      return fallback;
    }
  };

  const applyCoord = async (lat, lng, mode) => {
    if (!isInJordan(lat, lng)) {
      Alert.alert('', i18n.t('error_location_outside_jordan'));
      return;
    }
    const partial = { latitude: lat, longitude: lng, address: '' };
    if (mode === 'pickup') {
      updateOrder({ pickup: partial });
      requestAnimationFrame(() => {
        mapRefPickup.current?.animateToRegion(
          { latitude: lat, longitude: lng, latitudeDelta: 0.06, longitudeDelta: 0.06 },
          280
        );
      });
    } else if (!skipDestination) {
      updateOrder({ destination: partial });
      requestAnimationFrame(() => {
        mapRefDestination.current?.animateToRegion(
          { latitude: lat, longitude: lng, latitudeDelta: 0.06, longitudeDelta: 0.06 },
          280
        );
      });
    }
    const address = await reverseGeocode(lat, lng);
    const pt = { latitude: lat, longitude: lng, address };
    if (mode === 'pickup') {
      const cur = orderPickRef.current;
      if (
        cur?.latitude != null &&
        (Math.abs(cur.latitude - lat) > 0.0002 || Math.abs(cur.longitude - lng) > 0.0002)
      ) {
        return;
      }
      updateOrder({ pickup: pt });
    } else if (!skipDestination) {
      const cur = orderDestRef.current;
      if (
        cur?.latitude != null &&
        (Math.abs(cur.latitude - lat) > 0.0002 || Math.abs(cur.longitude - lng) > 0.0002)
      ) {
        return;
      }
      updateOrder({ destination: pt });
    }
  };

  const handlePickupMapPress = (e) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    if (!isInJordan(latitude, longitude)) {
      Alert.alert('', i18n.t('error_location_outside_jordan'));
      return;
    }
    applyCoord(latitude, longitude, 'pickup');
  };

  const handleDestinationMapPress = (e) => {
    if (skipDestination) return;
    const { latitude, longitude } = e.nativeEvent.coordinate;
    if (!isInJordan(latitude, longitude)) {
      Alert.alert('', i18n.t('error_location_outside_jordan'));
      return;
    }
    applyCoord(latitude, longitude, 'destination');
  };

  const handlePlaceSelect = (data, details, mode) => {
    if (details?.geometry?.location) {
      const lat = details.geometry.location.lat;
      const lng = details.geometry.location.lng;
      if (!isInJordan(lat, lng)) {
        Alert.alert('', i18n.t('error_location_outside_jordan'));
        return;
      }
      const addr = details.formatted_address || data.description;
      if (mode === 'pickup') {
        updateOrder({ pickup: { latitude: lat, longitude: lng, address: addr } });
      } else if (!skipDestination) {
        updateOrder({ destination: { latitude: lat, longitude: lng, address: addr } });
      }
      const ref = mode === 'pickup' ? mapRefPickup : mapRefDestination;
      ref.current?.animateToRegion(
        { latitude: lat, longitude: lng, latitudeDelta: 0.06, longitudeDelta: 0.06 },
        280
      );
    }
  };

  const fetchMyLocation = async () => {
    if (skipDestination && activeMode === 'destination') {
      setActiveMode('pickup');
    }
    setLoadingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('', i18n.t('error_select_location'));
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = loc.coords;
      if (!isInJordan(latitude, longitude)) {
        Alert.alert('', i18n.t('error_location_outside_jordan'));
        return;
      }
      const mode = skipDestination || activeMode === 'pickup' ? 'pickup' : 'destination';
      await applyCoord(latitude, longitude, mode);
    } catch {
      Alert.alert('', i18n.t('error_select_location'));
    } finally {
      setLoadingLocation(false);
    }
  };

  /**
   * Once on mount: if pickup has no coords yet, center on GPS then fill address.
   * Runs with [] deps so updating pickup mid-flow does not abort geocoding (see orderPickRef).
   */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (orderPickRef.current?.latitude != null && orderPickRef.current?.longitude != null) {
          return;
        }
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted' || cancelled) return;
        if (orderPickRef.current?.latitude != null) return;
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (cancelled) return;
        const { latitude, longitude } = loc.coords;
        if (!isInJordan(latitude, longitude)) return;
        if (cancelled || orderPickRef.current?.latitude != null) return;
        updateOrder({ pickup: { latitude, longitude, address: '' } });
        requestAnimationFrame(() => {
          if (cancelled) return;
          mapRefPickup.current?.animateToRegion(
            {
              latitude,
              longitude,
              latitudeDelta: 0.08,
              longitudeDelta: 0.08,
            },
            320
          );
        });
        const address = await reverseGeocode(latitude, longitude);
        if (cancelled) return;
        const cur = orderPickRef.current;
        if (
          cur?.latitude != null &&
          (Math.abs(cur.latitude - latitude) > 0.0002 || Math.abs(cur.longitude - longitude) > 0.0002)
        ) {
          return;
        }
        updateOrder({ pickup: { latitude, longitude, address } });
      } catch {
        /* permission denied or unavailable — user can use locate button or map */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: avoid re-running when pickup updates mid-flow
  }, []);

  const hasPlacesKey = Config.googleMapsApiKey && Config.googleMapsApiKey.length > 0;

  const onToggleSkip = (value) => {
    if (value) {
      updateOrder({ skipDestination: true, destination: null });
      setActiveMode('pickup');
    } else {
      updateOrder({ skipDestination: false });
    }
  };

  const onSheetLayout = useCallback((e) => {
    const h = e.nativeEvent.layout.height;
    if (h <= 0) return;
    const rounded = Math.round(h / 20) * 20;
    sheetHeightRef.current = rounded;
    setSheetHeight((prev) => (Math.abs(prev - rounded) > 20 ? rounded : prev));
  }, []);

  useLayoutEffect(() => {
    const id = requestAnimationFrame(() => {
      rootRef.current?.measureInWindow((_, y) => {
        if (typeof y !== 'number' || y < 0) return;
        const next = Math.round(y);
        setBleedOffset((prev) => (Math.abs(prev - next) < 2 ? prev : next));
      });
    });
    return () => cancelAnimationFrame(id);
  }, [windowHeight]);

  const fabBottom = sheetHeight + 12;
  const scrollMaxH = Math.min(windowHeight * 0.42, 320);

  return (
    <View
      ref={rootRef}
      style={[styles.root, bleedOffset > 0 && { marginTop: -bleedOffset }]}
    >
      <View style={styles.mapShell}>
        {skipDestination || activeMode === 'pickup' ? (
          <MapView
            ref={mapRefPickup}
            provider={PROVIDER_GOOGLE}
            style={styles.map}
            initialRegion={{ ...JORDAN_CENTER, ...INITIAL_DELTA }}
            onPress={handlePickupMapPress}
            showsUserLocation
            showsMyLocationButton={false}
            pitchEnabled
            rotateEnabled
            mapType="standard"
            scrollEnabled
            zoomEnabled
            zoomTapEnabled
          >
            <MapOverlays order={order} lineCoords={polylineCoords} skipDestination={skipDestination} />
          </MapView>
        ) : (
          <MapView
            ref={mapRefDestination}
            provider={PROVIDER_GOOGLE}
            style={styles.map}
            initialRegion={{ ...JORDAN_CENTER, ...INITIAL_DELTA }}
            onPress={handleDestinationMapPress}
            showsUserLocation
            showsMyLocationButton={false}
            pitchEnabled
            rotateEnabled
            mapType="standard"
            scrollEnabled
            zoomEnabled
            zoomTapEnabled
          >
            <MapOverlays order={order} lineCoords={polylineCoords} skipDestination={skipDestination} />
          </MapView>
        )}

        <TouchableOpacity
          style={[styles.fabMyLocation, { bottom: fabBottom }]}
          onPress={fetchMyLocation}
          disabled={loadingLocation}
          activeOpacity={0.85}
        >
          {loadingLocation ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Ionicons name="navigate" size={22} color={colors.text} />
          )}
        </TouchableOpacity>

        <View style={styles.bottomSheet} onLayout={onSheetLayout} pointerEvents="box-none">
          <View
            style={[
              styles.bottomSheetInner,
              { paddingBottom: Math.max(insets.bottom, 12) },
            ]}
          >
            <View style={styles.sheetHandle} />

            <ScrollView
              style={{ maxHeight: scrollMaxH }}
              contentContainerStyle={styles.bottomScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
            >
              <View style={styles.modeTabs}>
                <Pressable
                  style={[styles.tab, activeMode === 'pickup' && styles.tabActive]}
                  onPress={() => setActiveMode('pickup')}
                >
                  <View style={[styles.dot, styles.dotPickup]} />
                  <Text style={[styles.tabText, activeMode === 'pickup' && styles.tabTextActive]} numberOfLines={1}>
                    {i18n.t('pickup_location')}
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.tab, activeMode === 'destination' && styles.tabActive, skipDestination && styles.tabDisabled]}
                  onPress={() => !skipDestination && setActiveMode('destination')}
                >
                  <View style={[styles.dot, styles.dotDest]} />
                  <Text style={[styles.tabText, activeMode === 'destination' && styles.tabTextActive]} numberOfLines={1}>
                    {i18n.t('destination')}
                  </Text>
                </Pressable>
              </View>

              <View style={styles.searchJordanRow}>
                <Ionicons name="search" size={18} color={colors.primary} />
                <Text style={styles.searchJordanText}>{i18n.t('search_places')}</Text>
              </View>

              <View style={styles.searchPill}>
                {hasPlacesKey ? (
                  <GooglePlacesAutocomplete
                    key={`${activeMode}-${skipDestination}`}
                    ref={placesRef}
                    suppressDefaultStyles
                    placeholder={
                      activeMode === 'pickup'
                        ? i18n.t('search_pickup_short')
                        : i18n.t('search_dropoff_short')
                    }
                    onPress={(data, details) => handlePlaceSelect(data, details, activeMode)}
                    fetchDetails
                    query={placesQuery}
                    styles={{
                      container: styles.placesContainer,
                      textInputContainer: styles.placesInputContainer,
                      textInput: styles.placesInput,
                      listView: styles.placesList,
                      row: styles.placesRow,
                      separator: styles.placesSep,
                      description: styles.placesDesc,
                    }}
                    textInputProps={{
                      placeholderTextColor: colors.placeholder,
                      editable: !(skipDestination && activeMode === 'destination'),
                    }}
                    enablePoweredByContainer={false}
                  />
                ) : (
                  <Text style={styles.noKeyHint}>{i18n.t('maps_key_hint')}</Text>
                )}
              </View>

              {!skipDestination && (routeMetrics.km != null || routeMetrics.minutes != null) && (
                <View style={styles.statsRowOverlay}>
                  <View style={styles.statCol}>
                    <Text style={styles.statLabel}>{i18n.t('map_total_distance')}</Text>
                    <Text style={styles.statValue}>{formatKm(routeMetrics.km) ?? i18n.t('map_stats_na')}</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statCol}>
                    <Text style={styles.statLabel}>{i18n.t('map_estimated_time')}</Text>
                    <Text style={styles.statValue}>
                      {routeMetrics.minutes != null
                        ? `≈ ${routeMetrics.minutes} min`
                        : i18n.t('map_stats_na')}
                    </Text>
                  </View>
                </View>
              )}
              {skipDestination && (
                <Text style={styles.straightNoteOverlay}>{i18n.t('map_straight_route_note')}</Text>
              )}

              <View style={styles.skipRow}>
                <Text style={styles.skipLabel}>{i18n.t('no_destination_for_now')}</Text>
                <Switch
                  value={skipDestination}
                  onValueChange={onToggleSkip}
                  trackColor={{ false: colors.metallic, true: colors.primaryLight }}
                  thumbColor={skipDestination ? colors.primary : colors.white}
                />
              </View>
            </ScrollView>

            <Pressable
              style={({ pressed }) => [
                styles.nextButton,
                nextDisabled && styles.nextButtonDisabled,
                pressed && !nextDisabled && styles.nextButtonPressed,
              ]}
              onPress={onNext}
              disabled={nextDisabled}
            >
              <Text style={styles.nextButtonText}>{i18n.t('next')}</Text>
              <Text style={styles.nextButtonArrow}>→</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, width: '100%', minHeight: 0 },
  mapShell: {
    flex: 1,
    width: '100%',
    minHeight: 0,
    overflow: 'hidden',
    backgroundColor: colors.metallic,
  },
  map: { ...StyleSheet.absoluteFillObject, zIndex: 0 },
  bottomSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
    maxHeight: '78%',
    flexGrow: 0,
  },
  bottomSheetInner: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: ios.radius.xxl,
    borderTopRightRadius: ios.radius.xxl,
    paddingHorizontal: ios.spacing.lg,
    paddingTop: ios.spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 12,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: ios.spacing.sm,
  },
  bottomScrollContent: {
    paddingBottom: ios.spacing.sm,
  },
  searchJordanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  searchJordanText: {
    flex: 1,
    marginLeft: 8,
    fontSize: ios.fontSize.caption,
    fontWeight: ios.fontWeight.semibold,
    color: colors.textSecondary,
  },
  searchPill: {
    backgroundColor: colors.background,
    borderRadius: ios.radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: 10,
  },
  placesContainer: {
    flexGrow: 0,
    flexShrink: 0,
    alignSelf: 'stretch',
  },
  placesInputContainer: {
    backgroundColor: 'transparent',
  },
  placesInput: {
    height: 48,
    paddingHorizontal: 14,
    fontSize: 16,
    color: colors.text,
    backgroundColor: 'transparent',
  },
  placesList: {
    maxHeight: 140,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  placesRow: { paddingVertical: 12, paddingHorizontal: 12 },
  placesSep: { height: 0 },
  placesDesc: { color: colors.textSecondary, fontSize: 12 },
  noKeyHint: { fontSize: 12, color: colors.textSecondary, padding: 12 },
  fabMyLocation: {
    position: 'absolute',
    right: 14,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 15,
  },
  markerWrap: { alignItems: 'center' },
  markerLabelPickup: {
    backgroundColor: colors.white,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 4,
  },
  markerLabelText: { color: colors.text, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  markerLabelDrop: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  markerLabelTextDrop: { color: colors.text, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  markerDotPickup: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.white,
  },
  markerDotDrop: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primaryDark,
    borderWidth: 3,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRowOverlay: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginTop: 4,
    marginBottom: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statCol: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, backgroundColor: colors.border },
  statLabel: { fontSize: 10, fontWeight: '700', color: colors.textSecondary, letterSpacing: 0.8, marginBottom: 6 },
  statValue: { fontSize: 20, fontWeight: '700', color: colors.text },
  straightNoteOverlay: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  modeTabs: { flexDirection: 'row', marginBottom: 10 },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    marginHorizontal: 4,
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  tabDisabled: { opacity: 0.45 },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginLeft: 8 },
  tabTextActive: { color: colors.text },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotPickup: { backgroundColor: colors.white, borderWidth: 2, borderColor: colors.primary },
  dotDest: { backgroundColor: colors.primary, borderWidth: 2, borderColor: colors.white },
  skipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  skipLabel: { fontSize: 14, fontWeight: '600', color: colors.text, flex: 1, paddingRight: 12 },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: ios.spacing.lg,
    paddingHorizontal: ios.spacing.xxl,
    borderRadius: ios.radius.lg,
    marginTop: ios.spacing.md,
    minHeight: 50,
  },
  nextButtonDisabled: { backgroundColor: colors.disabled, opacity: 0.85 },
  nextButtonPressed: { opacity: 0.88 },
  nextButtonText: {
    color: colors.white,
    fontSize: ios.fontSize.body,
    fontWeight: ios.fontWeight.semibold,
  },
  nextButtonArrow: {
    color: colors.white,
    fontSize: 18,
    fontWeight: ios.fontWeight.bold,
    marginLeft: 8,
  },
});
