import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import * as Location from 'expo-location';
import i18n from '../i18n';
import { Config } from '../config';
import { colors } from '../theme';

const JORDAN_CENTER = { latitude: 32.5565, longitude: 35.8467 };
const MAP_DELTA = { latitudeDelta: 0.5, longitudeDelta: 0.5 };
/** Zoom after picking a place or setting the pin (matches trip map embedded picker). */
const SELECT_LOCATION_DELTA = { latitudeDelta: 0.009, longitudeDelta: 0.009 };

const MAP_TYPES = ['standard', 'satellite', 'hybrid'];
const ZOOM_IN_FACTOR = 0.5;
const ZOOM_OUT_FACTOR = 2;

export default function MapLocationPicker({ visible, title, onSelect, onClose, initialUseMyLocation }) {
  const insets = useSafeAreaInsets();
  const [region, setRegion] = useState({
    ...JORDAN_CENTER,
    ...MAP_DELTA,
  });
  const [marker, setMarker] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [mapType, setMapType] = useState('standard');
  const [showsTraffic, setShowsTraffic] = useState(false);
  const mapRef = useRef(null);
  const placesRef = useRef(null);

  useEffect(() => {
    if (!visible) {
      setMarker(null);
      setSearchText('');
      setRegion({ ...JORDAN_CENTER, ...MAP_DELTA });
      placesRef.current?.setAddressText('');
      return;
    }
    if (initialUseMyLocation) {
      fetchAndSetMyLocation();
    }
  }, [visible, initialUseMyLocation]);

  const fetchAndSetMyLocation = async () => {
    setLoadingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('', i18n.t('error_select_location'));
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = loc.coords;
      setMarker({ latitude, longitude });
      setRegion({
        latitude,
        longitude,
        ...SELECT_LOCATION_DELTA,
      });
      mapRef.current?.animateToRegion({ latitude, longitude, ...SELECT_LOCATION_DELTA }, 300);
      await reverseGeocode(latitude, longitude);
    } catch {
      Alert.alert('', i18n.t('error_select_location'));
    } finally {
      setLoadingLocation(false);
    }
  };

  const reverseGeocode = async (lat, lng) => {
    try {
      const [addr] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      const addrStr = addr
        ? [addr.street, addr.city, addr.region, addr.country].filter(Boolean).join(', ') ||
          `${lat.toFixed(4)}, ${lng.toFixed(4)}`
        : `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      setSearchText(addrStr);
      placesRef.current?.setAddressText(addrStr);
    } catch {
      setSearchText(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
    }
  };

  const handleMapPress = (e) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setMarker({ latitude, longitude });
    setRegion((prev) => ({ ...prev, latitude, longitude, ...SELECT_LOCATION_DELTA }));
    mapRef.current?.animateToRegion({ latitude, longitude, ...SELECT_LOCATION_DELTA }, 300);
    reverseGeocode(latitude, longitude);
  };

  const handlePlaceSelect = (data, details = null) => {
    if (details?.geometry?.location) {
      const lat = details.geometry.location.lat;
      const lng = details.geometry.location.lng;
      setMarker({ latitude: lat, longitude: lng });
      setRegion({
        latitude: lat,
        longitude: lng,
        ...SELECT_LOCATION_DELTA,
      });
      setSearchText(details.formatted_address || data.description);
      mapRef.current?.animateToRegion({ latitude: lat, longitude: lng, ...SELECT_LOCATION_DELTA }, 300);
    }
  };


  const handleConfirm = async () => {
    if (!marker) {
      Alert.alert('', i18n.t('error_select_location'));
      return;
    }
    const address = searchText.trim() || `${marker.latitude.toFixed(4)}, ${marker.longitude.toFixed(4)}`;
    onSelect({
      latitude: marker.latitude,
      longitude: marker.longitude,
      address,
    });
    onClose();
  };

  const zoomIn = () => {
    const newDelta = {
      latitudeDelta: Math.max(0.001, region.latitudeDelta * ZOOM_IN_FACTOR),
      longitudeDelta: Math.max(0.001, region.longitudeDelta * ZOOM_IN_FACTOR),
    };
    mapRef.current?.animateToRegion({
      ...region,
      ...newDelta,
    }, 200);
  };

  const zoomOut = () => {
    const newDelta = {
      latitudeDelta: Math.min(10, region.latitudeDelta * ZOOM_OUT_FACTOR),
      longitudeDelta: Math.min(10, region.longitudeDelta * ZOOM_OUT_FACTOR),
    };
    mapRef.current?.animateToRegion({
      ...region,
      ...newDelta,
    }, 200);
  };

  const handleClose = () => {
    setMarker(null);
    setSearchText('');
    setRegion({ ...JORDAN_CENTER, ...MAP_DELTA });
    onClose();
  };

  const hasPlacesKey = Config.googleMapsApiKey && Config.googleMapsApiKey.length > 0;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeBtnTouch} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.closeBtn}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          {hasPlacesKey ? (
            <GooglePlacesAutocomplete
              ref={placesRef}
              placeholder={i18n.t('search_address')}
              onPress={handlePlaceSelect}
              fetchDetails={true}
              query={{
                key: Config.googleMapsApiKey,
                language: 'en',
                components: 'country:jo',
              }}
              styles={{
                container: styles.placesContainer,
                textInput: styles.placesInput,
                listView: styles.placesList,
              }}
              textInputProps={{
                placeholderTextColor: colors.placeholder,
              }}
              enablePoweredByContainer={false}
            />
          ) : (
            <Text style={styles.noKeyHint}>
              Add EXPO_PUBLIC_GOOGLE_MAPS_API_KEY to .env for address search
            </Text>
          )}
        </View>

        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={styles.map}
            region={region}
            onRegionChangeComplete={setRegion}
            onPress={handleMapPress}
            mapType={mapType}
            showsUserLocation
            showsMyLocationButton={true}
            showsCompass={true}
            rotateEnabled={true}
            showsTraffic={showsTraffic}
            zoomEnabled
            pitchEnabled
          >
            {marker && (
              <Marker
                coordinate={marker}
                draggable
                onDragEnd={(e) => {
                  const { latitude, longitude } = e.nativeEvent.coordinate;
                  setMarker({ latitude, longitude });
                  reverseGeocode(latitude, longitude);
                }}
              />
            )}
          </MapView>
          <View style={styles.mapTypeBar}>
            {MAP_TYPES.map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.mapTypeBtn, mapType === type && styles.mapTypeBtnActive]}
                onPress={() => setMapType(type)}
              >
                <Text style={[styles.mapTypeText, mapType === type && styles.mapTypeTextActive]}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.mapTypeBtn, showsTraffic && styles.mapTypeBtnActive]}
              onPress={() => setShowsTraffic(!showsTraffic)}
            >
              <Text style={[styles.mapTypeText, showsTraffic && styles.mapTypeTextActive]}>
                {i18n.t('traffic')}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.zoomBar}>
            <TouchableOpacity style={styles.zoomBtn} onPress={zoomIn}>
              <Text style={styles.zoomBtnText}>+</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.zoomBtn} onPress={zoomOut}>
              <Text style={styles.zoomBtnText}>−</Text>
            </TouchableOpacity>
          </View>
        </View>

        {marker && (
          <Text style={styles.selectedAddress} numberOfLines={2}>
            {searchText || `${marker.latitude.toFixed(4)}, ${marker.longitude.toFixed(4)}`}
          </Text>
        )}

        <Text style={styles.hint}>Tap on the map or search to set your location</Text>

        <View style={[styles.actions, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.useLocationBtn, loadingLocation && styles.btnDisabled]}
            onPress={fetchAndSetMyLocation}
            disabled={loadingLocation}
          >
            {loadingLocation ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={styles.useLocationText}>{i18n.t('use_my_location')}</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.confirmBtn, !marker && styles.btnDisabled]}
            onPress={handleConfirm}
            disabled={!marker}
          >
            <Text style={styles.confirmBtnText}>Confirm</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.cancelBtn]}
            onPress={handleClose}
          >
            <Text style={styles.cancelBtnText}>{i18n.t('cancel')}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { fontSize: 18, fontWeight: '600', flex: 1, marginRight: 8, color: colors.text },
  closeBtnTouch: { padding: 8 },
  closeBtn: { fontSize: 28, color: colors.textSecondary, lineHeight: 32 },
  searchContainer: { paddingHorizontal: 12, paddingTop: 8 },
  placesContainer: { flex: 0 },
  placesInput: {
    height: 48,
    backgroundColor: colors.surface,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.text,
  },
  placesList: { maxHeight: 150 },
  noKeyHint: { fontSize: 12, color: colors.placeholder, padding: 8 },
  mapContainer: { flex: 1, minHeight: 280, position: 'relative' },
  map: { width: '100%', height: '100%' },
  mapTypeBar: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'column',
    gap: 4,
  },
  mapTypeBtn: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  mapTypeBtnActive: { backgroundColor: colors.primary },
  mapTypeText: { fontSize: 12, color: colors.text },
  mapTypeTextActive: { color: colors.white, fontWeight: '600' },
  zoomBar: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'column',
  },
  zoomBtn: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    width: 40,
    height: 40,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  zoomBtnText: { fontSize: 24, color: colors.text, fontWeight: '300', lineHeight: 28 },
  selectedAddress: {
    padding: 12,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  hint: { padding: 8, color: colors.textSecondary, fontSize: 13, textAlign: 'center' },
  actions: { padding: 16, gap: 12 },
  actionBtn: { padding: 16, borderRadius: 12, alignItems: 'center' },
  useLocationBtn: { backgroundColor: colors.primaryLight },
  useLocationText: { color: colors.primary, fontWeight: '600', fontSize: 16 },
  confirmBtn: { backgroundColor: colors.primary },
  confirmBtnText: { color: colors.white, fontWeight: '600', fontSize: 16 },
  cancelBtn: { backgroundColor: colors.surface },
  cancelBtnText: { color: colors.textSecondary, fontWeight: '600', fontSize: 16 },
  btnDisabled: { opacity: 0.6 },
});
