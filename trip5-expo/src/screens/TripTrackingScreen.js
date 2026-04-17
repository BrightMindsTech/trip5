import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
  Dimensions,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import i18n from '../i18n';
import { googleMapDarkStyle, ios } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { getRouteLabel, isTerminalStatus } from '../utils/bookings';
import { fetchDirectionsCoordinates } from '../utils/mapsDirections';
import { useAuth } from '../context/AuthContext';
import { getTripReference, formatTripRefLine } from '../utils/tripReference';
import { canUseTripChat } from '../utils/tripChat';
import { useTripChatUnread } from '../hooks/useTripChatUnread';
import AppLoadingScreen from '../components/AppLoadingScreen';
import TripChatPanel from '../components/TripChatPanel';
import ChatUnreadDot from '../components/ChatUnreadDot';
import RiderDriverVehicleSection from '../components/RiderDriverVehicleSection';
import SharedRidePoolLine from '../components/SharedRidePoolLine';

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
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createTripTrackingStyles(colors, isDark), [colors, isDark]);
  const orderId = route.params?.orderId;
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [locationDenied, setLocationDenied] = useState(false);
  /** Only true after foreground permission is granted — drives showsUserLocation on the map. */
  const [locationPermissionGranted, setLocationPermissionGranted] = useState(false);
  const [routePathCoords, setRoutePathCoords] = useState(null);
  const [chatExpanded, setChatExpanded] = useState(false);
  const watchRef = useRef(null);
  const mapRef = useRef(null);
  const directionsReqId = useRef(0);
  const followRef = useRef({ t: 0, lat: null, lng: null });
  const orderStatusRef = useRef('');
  const lastKnownOrderStatusRef = useRef(null);

  const chatOk = order && canUseTripChat(order.status);
  const { hasUnread: headerChatUnread } = useTripChatUnread({
    order,
    userId: session?.user?.id,
    enabled: !!order?.id && !!chatOk,
  });

  const tripRefCode = order ? getTripReference(order) : null;
  const chatPanelHeight = Math.round(Dimensions.get('window').height * 0.42);

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

  const showChatHint = Boolean(chatOk && !chatExpanded);

  if (loading) {
    return <AppLoadingScreen />;
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
        customMapStyle={isDark ? googleMapDarkStyle : undefined}
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
          {chatOk ? (
            <TouchableOpacity
              onPress={() => setChatExpanded((e) => !e)}
              style={styles.headerBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel={i18n.t('trip_chat_expand')}
            >
              <View style={styles.headerChatIconWrap}>
                <Ionicons name="chatbubbles-outline" size={26} color={colors.text} />
                {headerChatUnread && !chatExpanded ? (
                  <ChatUnreadDot style={styles.headerChatUnreadDot} />
                ) : null}
              </View>
            </TouchableOpacity>
          ) : (
            <View style={styles.headerSpacer} />
          )}
        </View>
        <Text style={styles.subRoute} numberOfLines={1}>
          {getRouteLabel(order.route)}
        </Text>
        {tripRefCode ? (
          <Text style={styles.tripRefLine} numberOfLines={1}>
            {formatTripRefLine(i18n, tripRefCode)}
          </Text>
        ) : null}
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

      {chatOk ? (
        <View
          style={[
            styles.bottomStack,
            {
              paddingBottom: Math.max(insets.bottom, ios.spacing.sm),
              maxHeight: chatExpanded ? Dimensions.get('window').height * 0.62 : undefined,
            },
          ]}
        >
          <SharedRidePoolLine order={order} variant="rider" />
          {order.driver_id ? <RiderDriverVehicleSection driverId={order.driver_id} compact /> : null}
          {showChatHint ? (
            <View style={styles.chatHintBanner}>
              <Ionicons name="information-circle-outline" size={18} color={colors.primaryDark} />
              <Text style={styles.chatHintText}>{i18n.t('trip_tracking_chat_hint')}</Text>
            </View>
          ) : null}
          <TouchableOpacity
            style={styles.chatToggleRow}
            onPress={() => setChatExpanded((e) => !e)}
            activeOpacity={0.85}
          >
            <Ionicons name="chatbubbles-outline" size={22} color={colors.primaryDark} />
            <Text style={styles.chatToggleText}>
              {chatExpanded ? i18n.t('trip_chat_collapse') : i18n.t('trip_chat_expand')}
            </Text>
            {headerChatUnread && !chatExpanded ? (
              <View style={styles.chatToggleUnreadWrap}>
                <ChatUnreadDot style={styles.chatToggleUnreadDot} />
              </View>
            ) : null}
            <Ionicons
              name={chatExpanded ? 'chevron-down' : 'chevron-up'}
              size={22}
              color={colors.placeholder}
            />
          </TouchableOpacity>
          {chatExpanded ? (
            <View style={[styles.chatPanelWrap, { height: chatPanelHeight }]}>
              <TripChatPanel
                orderId={orderId}
                userId={session?.user?.id}
                chatClosed={false}
                compact
              />
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function createTripTrackingStyles(colors, isDark) {
  return StyleSheet.create({
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
    backgroundColor: isDark ? 'rgba(15,10,26,0.94)' : 'rgba(255,255,255,0.92)',
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
  headerBtn: { width: 44, justifyContent: 'center', alignItems: 'center' },
  headerSpacer: { width: 44 },
  headerChatIconWrap: { position: 'relative', width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  headerChatUnreadDot: { position: 'absolute', top: -4, right: -6 },
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
    color: colors.textMuted,
  },
  tripRefLine: {
    paddingHorizontal: ios.spacing.lg,
    marginTop: 2,
    fontSize: ios.fontSize.subhead,
    fontWeight: ios.fontWeight.bold,
    color: colors.text,
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
  bottomStack: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: isDark ? 'rgba(15,10,26,0.98)' : 'rgba(255,255,255,0.97)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingHorizontal: ios.spacing.md,
    paddingTop: ios.spacing.sm,
    gap: ios.spacing.sm,
  },
  chatHintBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ios.spacing.sm,
    padding: ios.spacing.sm,
    backgroundColor: colors.primaryLight,
    borderRadius: ios.radius.md,
  },
  chatHintText: {
    flex: 1,
    fontSize: ios.fontSize.caption,
    color: colors.text,
    lineHeight: 18,
  },
  chatToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ios.spacing.sm,
    paddingVertical: ios.spacing.xs,
  },
  chatToggleText: {
    flex: 1,
    fontSize: ios.fontSize.callout,
    fontWeight: ios.fontWeight.semibold,
    color: colors.text,
  },
  chatToggleUnreadWrap: {
    width: 16,
    height: 16,
    marginLeft: ios.spacing.xs,
    position: 'relative',
  },
  chatToggleUnreadDot: { top: -6, right: -8 },
  chatPanelWrap: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: ios.radius.lg,
    overflow: 'hidden',
  },
});
}
