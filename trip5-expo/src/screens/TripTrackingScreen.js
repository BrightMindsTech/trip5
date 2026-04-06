import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import i18n from '../i18n';
import { colors, ios } from '../theme';
import { getRouteLabel, isTerminalStatus } from '../utils/bookings';
import { fetchDirectionsCoordinates } from '../utils/mapsDirections';
import { useAuth } from '../context/AuthContext';

function hasLatLng(obj) {
  return (
    obj &&
    typeof obj.latitude === 'number' &&
    typeof obj.longitude === 'number' &&
    !Number.isNaN(obj.latitude) &&
    !Number.isNaN(obj.longitude)
  );
}

function buildRegion(pickup, destination) {
  const hasP = hasLatLng(pickup);
  const hasD = hasLatLng(destination) && !destination?.pending;
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
}

function haversineMeters(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

const FOLLOW_MIN_INTERVAL_MS = 8000;
const FOLLOW_MIN_DISTANCE_M = 80;

export default function TripTrackingScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { session } = useAuth();
  const orderId = route.params?.orderId;
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [locationDenied, setLocationDenied] = useState(false);
  /** Only true after foreground permission is granted — drives showsUserLocation on the map. */
  const [locationPermissionGranted, setLocationPermissionGranted] = useState(false);
  const [routePathCoords, setRoutePathCoords] = useState(null);
  const watchRef = useRef(null);
  const mapRef = useRef(null);
  const directionsReqId = useRef(0);
  const followRef = useRef({ t: 0, lat: null, lng: null });
  const orderStatusRef = useRef('');
  const lastKnownOrderStatusRef = useRef(null);

  const load = useCallback(async () => {
    if (!orderId) {
      setError('missing');
      setLoading(false);
      return;
    }
    setError(null);
    setLoading(true);
    const { data, error: qErr } = await supabase.from('orders').select('*').eq('id', orderId).maybeSingle();
    if (qErr || !data) {
      setError(qErr?.message || 'notfound');
      setOrder(null);
    } else {
      setOrder(data);
    }
    setLoading(false);
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    orderStatusRef.current = String(order?.status || '').toLowerCase();
  }, [order?.status]);

  useEffect(() => {
    if (order?.status != null) lastKnownOrderStatusRef.current = order.status;
  }, [order?.status, order?.id]);

  useEffect(() => {
    if (!order) return;
    const p = order.pickup;
    const d = order.destination;
    if (!hasLatLng(p) || !hasLatLng(d) || d?.pending) {
      setRoutePathCoords(null);
      return;
    }
    const reqId = ++directionsReqId.current;
    setRoutePathCoords(null);
    (async () => {
      const result = await fetchDirectionsCoordinates(
        { latitude: p.latitude, longitude: p.longitude },
        { latitude: d.latitude, longitude: d.longitude }
      );
      if (reqId !== directionsReqId.current) return;
      setRoutePathCoords(result?.coordinates ?? null);
    })();
  }, [order?.pickup, order?.destination, order?.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      if (status !== 'granted') {
        setLocationDenied(true);
        setLocationPermissionGranted(false);
        return;
      }
      setLocationDenied(false);
      setLocationPermissionGranted(true);
      const w = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 15,
        },
        (loc) => {
          const lat = loc.coords.latitude;
          const lng = loc.coords.longitude;

          if (orderStatusRef.current !== 'in_route') return;
          const now = Date.now();
          const last = followRef.current;
          if (last.lat == null) {
            followRef.current = { t: now, lat, lng };
            mapRef.current?.animateToRegion(
              {
                latitude: lat,
                longitude: lng,
                latitudeDelta: 0.06,
                longitudeDelta: 0.06,
              },
              450
            );
            return;
          }
          const dist = haversineMeters(
            { latitude: last.lat, longitude: last.lng },
            { latitude: lat, longitude: lng }
          );
          if (now - last.t < FOLLOW_MIN_INTERVAL_MS && dist < FOLLOW_MIN_DISTANCE_M) return;
          followRef.current = { t: now, lat, lng };
          mapRef.current?.animateToRegion(
            {
              latitude: lat,
              longitude: lng,
              latitudeDelta: 0.06,
              longitudeDelta: 0.06,
            },
            450
          );
        }
      );
      if (cancelled) {
        w?.remove?.();
        return;
      }
      watchRef.current = w;
    })();
    return () => {
      cancelled = true;
      watchRef.current?.remove?.();
      watchRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!orderId || !session?.user?.id || !order || isTerminalStatus(order.status)) {
      return undefined;
    }

    const channel = supabase
      .channel(`trip-order:${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          if (!payload.new) return;
          const prev = lastKnownOrderStatusRef.current;
          lastKnownOrderStatusRef.current = payload.new.status;
          setOrder(payload.new);
          const nowTerminal = isTerminalStatus(payload.new.status);
          const wasTerminal = prev != null && isTerminalStatus(prev);
          if (nowTerminal && !wasTerminal) {
            Alert.alert('', i18n.t('trip_tracking_trip_closed'), [
              { text: i18n.t('done'), onPress: () => navigation.goBack() },
            ]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId, session?.user?.id, order?.id, order?.status, navigation]);

  const pickup = order?.pickup;
  const destination = order?.destination;
  const region = useMemo(() => buildRegion(pickup, destination), [pickup, destination]);

  const fallbackLine =
    hasLatLng(pickup) && hasLatLng(destination) && !destination?.pending
      ? [
          { latitude: pickup.latitude, longitude: pickup.longitude },
          { latitude: destination.latitude, longitude: destination.longitude },
        ]
      : null;

  const polylineCoords =
    routePathCoords && routePathCoords.length >= 2 ? routePathCoords : fallbackLine;

  const showInTransitOnlyHint = useMemo(() => {
    if (!order || isTerminalStatus(order.status)) return false;
    return String(order.status || '').toLowerCase() !== 'in_route';
  }, [order]);

  if (loading) {
    return (
      <SafeAreaView style={styles.centered} edges={['top', 'bottom']}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (error || !order || !region) {
    return (
      <SafeAreaView style={styles.centered} edges={['top', 'bottom']}>
        <Text style={styles.errText}>{i18n.t('trip_tracking_error')}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={load}>
          <Text style={styles.retryBtnText}>{i18n.t('trip_tracking_retry')}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backLink}>
          <Text style={styles.backLinkText}>{i18n.t('back')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (isTerminalStatus(order.status)) {
    return (
      <SafeAreaView style={styles.centered} edges={['top', 'bottom']}>
        <Text style={styles.errText}>{i18n.t('trip_tracking_trip_closed')}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.retryBtn}>
          <Text style={styles.retryBtnText}>{i18n.t('back')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.root}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={region}
        showsUserLocation={locationPermissionGranted}
        showsMyLocationButton={locationPermissionGranted}
        mapType="standard"
        userLocationPriority="high"
      >
        <Marker coordinate={{ latitude: pickup.latitude, longitude: pickup.longitude }} title={i18n.t('pickup_location')} />
        {hasLatLng(destination) && !destination?.pending ? (
          <Marker
            coordinate={{ latitude: destination.latitude, longitude: destination.longitude }}
            title={i18n.t('destination')}
          />
        ) : null}
        {polylineCoords ? (
          <Polyline coordinates={polylineCoords} strokeColor={colors.primary} strokeWidth={3} />
        ) : null}
      </MapView>

      <SafeAreaView style={styles.headerSafe} edges={['top']}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.headerBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel={i18n.t('back')}
          >
            <Ionicons name="chevron-back" size={28} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {i18n.t('trip_tracking_title')}
          </Text>
          <View style={styles.headerSpacer} />
        </View>
        <Text style={styles.subRoute} numberOfLines={1}>
          {getRouteLabel(order.route)}
        </Text>
        {showInTransitOnlyHint ? (
          <View style={styles.hintBanner}>
            <Text style={styles.hintBannerText}>{i18n.t('trip_tracking_in_transit_only_hint')}</Text>
          </View>
        ) : null}
      </SafeAreaView>

      {locationDenied ? (
        <SafeAreaView style={styles.hintSafe} edges={['bottom']}>
          <View style={styles.hintBar}>
            <Text style={styles.hintText}>{i18n.t('trip_tracking_location_hint')}</Text>
          </View>
        </SafeAreaView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  map: { ...StyleSheet.absoluteFillObject },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: ios.spacing.lg,
    backgroundColor: colors.surface,
  },
  errText: {
    fontSize: ios.fontSize.body,
    color: colors.text,
    textAlign: 'center',
    marginBottom: ios.spacing.md,
  },
  retryBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: ios.spacing.lg,
    paddingVertical: ios.spacing.sm,
    borderRadius: ios.radius.md,
    marginBottom: ios.spacing.md,
  },
  retryBtnText: {
    color: colors.white,
    fontWeight: ios.fontWeight.semibold,
    fontSize: ios.fontSize.body,
  },
  backLink: { padding: ios.spacing.sm },
  backLinkText: {
    color: colors.primary,
    fontSize: ios.fontSize.body,
    fontWeight: ios.fontWeight.semibold,
  },
  headerSafe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingBottom: ios.spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: ios.spacing.sm,
    minHeight: 44,
  },
  headerBtn: { width: 44, justifyContent: 'center' },
  headerSpacer: { width: 44 },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: ios.fontSize.title3,
    fontWeight: ios.fontWeight.semibold,
    color: colors.text,
  },
  subRoute: {
    paddingHorizontal: ios.spacing.lg,
    fontSize: ios.fontSize.caption,
    color: colors.textSecondary,
  },
  hintBanner: {
    marginHorizontal: ios.spacing.md,
    marginTop: ios.spacing.sm,
    padding: ios.spacing.sm,
    backgroundColor: colors.primaryLight,
    borderRadius: ios.radius.sm,
  },
  hintBannerText: {
    fontSize: ios.fontSize.caption,
    color: colors.text,
    lineHeight: 18,
  },
  hintSafe: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  hintBar: {
    backgroundColor: 'rgba(0,0,0,0.72)',
    margin: ios.spacing.md,
    padding: ios.spacing.md,
    borderRadius: ios.radius.md,
  },
  hintText: {
    color: colors.white,
    fontSize: ios.fontSize.caption,
    textAlign: 'center',
  },
});
