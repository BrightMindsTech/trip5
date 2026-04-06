import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import i18n, { initI18n } from '../i18n';
import { colors, ios } from '../theme';
import { useSavedPlaces } from '../hooks/useSavedPlaces';
import MapLocationPicker from '../components/MapLocationPicker';
import { useFocusEffect } from '@react-navigation/native';

const KINDS = ['home', 'work', 'gym', 'other'];

function kindIcon(kind) {
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

export default function SavedPlacesScreen({ navigation }) {
  const { loading, error, rows, refresh, insertPlace, updatePlace, deletePlace } = useSavedPlaces();
  const [localeState, setLocaleState] = useState(i18n.locale);
  const [formOpen, setFormOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [label, setLabel] = useState('');
  const [kind, setKind] = useState('other');
  const [location, setLocation] = useState(null);
  const [saving, setSaving] = useState(false);
  /** True only while map is shown first for a new place (before details). Ref avoids stale reads in map onClose. */
  const newPlaceMapFirstRef = useRef(false);
  const lastMapPickedRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      initI18n()
        .then((lang) => {
          if (!cancelled) setLocaleState(lang);
        })
        .catch(() => {
          if (!cancelled) setLocaleState('ar');
        });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const openAdd = useCallback(() => {
    setEditingId(null);
    setLabel('');
    setKind('other');
    setLocation(null);
    lastMapPickedRef.current = false;
    newPlaceMapFirstRef.current = true;
    setFormOpen(false);
    setMapOpen(true);
  }, []);

  const openEdit = useCallback((row) => {
    newPlaceMapFirstRef.current = false;
    setEditingId(row.id);
    setLabel(row.label);
    setKind(row.kind || 'other');
    setLocation({
      latitude: row.latitude,
      longitude: row.longitude,
      address: row.address,
    });
    setFormOpen(true);
    setMapOpen(false);
  }, []);

  const closeForm = useCallback(() => {
    setFormOpen(false);
    newPlaceMapFirstRef.current = false;
    setEditingId(null);
    setLabel('');
    setKind('other');
    setLocation(null);
  }, []);

  const onPickLocation = useCallback((loc) => {
    lastMapPickedRef.current = true;
    setLocation(loc);
  }, []);

  /** From details form: hide sheet then open map (nested modals). */
  const openMapPicker = useCallback(() => {
    setFormOpen(false);
    setTimeout(() => setMapOpen(true), 120);
  }, []);

  const closeMapPicker = useCallback(() => {
    setMapOpen(false);
    const picked = lastMapPickedRef.current;
    lastMapPickedRef.current = false;
    const mapFirst = newPlaceMapFirstRef.current;
    if (mapFirst && !picked) {
      newPlaceMapFirstRef.current = false;
      return;
    }
    setFormOpen(true);
    if (mapFirst && picked) {
      newPlaceMapFirstRef.current = false;
    }
  }, []);

  const savePlace = useCallback(async () => {
    const t = label.trim();
    if (!t) {
      Alert.alert('', i18n.t('saved_places_label_required'));
      return;
    }
    if (!location || typeof location.latitude !== 'number' || typeof location.longitude !== 'number') {
      Alert.alert('', i18n.t('saved_places_location_required'));
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await updatePlace(editingId, {
          label: t,
          kind,
          address: location.address || '',
          latitude: location.latitude,
          longitude: location.longitude,
        });
      } else {
        await insertPlace({
          label: t,
          kind,
          address: location.address || '',
          latitude: location.latitude,
          longitude: location.longitude,
        });
      }
      closeForm();
    } catch (e) {
      Alert.alert('', e?.message || i18n.t('saved_places_error_save'));
    } finally {
      setSaving(false);
    }
  }, [label, kind, location, editingId, insertPlace, updatePlace, closeForm]);

  const confirmDelete = useCallback(
    (row) => {
      Alert.alert(i18n.t('saved_places_delete'), i18n.t('saved_places_delete_confirm'), [
        { text: i18n.t('saved_places_cancel'), style: 'cancel' },
        {
          text: i18n.t('saved_places_delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePlace(row.id);
            } catch (e) {
              Alert.alert('', e?.message || i18n.t('saved_places_error_save'));
            }
          },
        },
      ]);
    },
    [deletePlace]
  );

  const goBook = useCallback(
    (row) => {
      navigation.navigate('Booking', {
        presetRoute: 'amman_to_irbid',
        initialPickup: {
          latitude: row.latitude,
          longitude: row.longitude,
          address: row.address || '',
        },
      });
    },
    [navigation]
  );

  const kindLabel = useMemo(
    () => ({
      home: i18n.t('saved_places_kind_home'),
      work: i18n.t('saved_places_kind_work'),
      gym: i18n.t('saved_places_kind_gym'),
      other: i18n.t('saved_places_kind_other'),
    }),
    [localeState]
  );

  const header = (
    <View style={[styles.headerWrapper, Platform.OS !== 'ios' && styles.headerWrapperAndroid]}>
      {Platform.OS === 'ios' ? <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} /> : null}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerBack}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.backChevron}>‹</Text>
          <Text style={styles.backText}>{i18n.t('back')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{i18n.t('saved_places_screen_title')}</Text>
        <TouchableOpacity onPress={openAdd} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={styles.headerAdd}>
          <Ionicons name="add-circle-outline" size={28} color={colors.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.safe} key={localeState}>
      <SafeAreaView style={styles.safeInner} edges={['top', 'left', 'right']}>
        {header}
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : error ? (
          <View style={styles.centered}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={() => refresh()} style={styles.retryBtn}>
              <Text style={styles.retryText}>{i18n.t('dashboard_retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {rows.length === 0 ? (
              <Text style={styles.empty}>{i18n.t('saved_places_empty')}</Text>
            ) : null}
            {rows.map((row) => (
              <View key={row.id} style={styles.cardRow}>
                <TouchableOpacity style={styles.cardMain} onPress={() => goBook(row)} activeOpacity={0.75}>
                  <View style={styles.savedIcon}>
                    <Ionicons name={kindIcon(row.kind)} size={20} color={colors.primary} />
                  </View>
                  <View style={styles.savedBody}>
                    <Text style={styles.savedTitle}>{row.label}</Text>
                    <Text style={styles.savedAddr} numberOfLines={2}>
                      {row.address}
                    </Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => openEdit(row)} style={styles.iconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="pencil-outline" size={22} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => confirmDelete(row)} style={styles.iconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="trash-outline" size={22} color={colors.error} />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>

      <Modal visible={formOpen} animationType="slide" transparent onRequestClose={closeForm}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {editingId ? i18n.t('saved_places_edit') : i18n.t('saved_places_details_title')}
            </Text>
            <Text style={styles.fieldLabel}>{i18n.t('saved_places_label_label')}</Text>
            <TextInput
              style={styles.input}
              value={label}
              onChangeText={setLabel}
              placeholder={i18n.t('saved_places_label_placeholder')}
              placeholderTextColor={colors.placeholder}
            />
            <Text style={styles.fieldLabel}>{i18n.t('saved_places_kind_label')}</Text>
            <View style={styles.kindRow}>
              {KINDS.map((k) => (
                <TouchableOpacity
                  key={k}
                  style={[styles.kindChip, kind === k && styles.kindChipOn]}
                  onPress={() => setKind(k)}
                >
                  <Text style={[styles.kindChipText, kind === k && styles.kindChipTextOn]}>{kindLabel[k]}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.fieldLabel}>{i18n.t('saved_places_address_label')}</Text>
            {location ? (
              <>
                <Text style={styles.addrPreview} numberOfLines={4}>
                  {location.address || `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`}
                </Text>
                <TouchableOpacity style={styles.mapBtn} onPress={openMapPicker}>
                  <Ionicons name="map-outline" size={20} color={colors.primary} />
                  <Text style={styles.mapBtnText}>{i18n.t('saved_places_change_location')}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <Text style={styles.addrHint}>{i18n.t('saved_places_location_required')}</Text>
            )}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.btnSecondary} onPress={closeForm}>
                <Text style={styles.btnSecondaryText}>{i18n.t('saved_places_cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnPrimary} onPress={savePlace} disabled={saving}>
                {saving ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.btnPrimaryText}>{i18n.t('saved_places_save')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <MapLocationPicker
        visible={mapOpen}
        title={i18n.t('choose_location')}
        onSelect={onPickLocation}
        onClose={closeMapPicker}
      />
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
  headerWrapperAndroid: { backgroundColor: colors.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: ios.spacing.md,
    paddingVertical: ios.spacing.sm,
    minHeight: 48,
  },
  headerBack: { flexDirection: 'row', alignItems: 'center', width: 88 },
  backChevron: { fontSize: 28, color: colors.primary, fontWeight: '300', marginRight: 2 },
  backText: { fontSize: ios.fontSize.callout, color: colors.primary, fontWeight: '600' },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: ios.fontSize.title3,
    fontWeight: ios.fontWeight.bold,
    color: colors.text,
  },
  headerAdd: { width: 88, alignItems: 'flex-end' },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: ios.spacing.lg,
    paddingBottom: ios.spacing.xxl,
  },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: ios.spacing.lg },
  errorText: { color: colors.error, textAlign: 'center', marginBottom: ios.spacing.md },
  retryBtn: { padding: ios.spacing.sm },
  retryText: { color: colors.primary, fontWeight: '600' },
  empty: {
    textAlign: 'center',
    color: colors.textSecondary,
    marginTop: ios.spacing.xl,
    fontSize: ios.fontSize.subhead,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: ios.radius.lg,
    marginBottom: ios.spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  cardMain: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: ios.spacing.md, paddingLeft: ios.spacing.md },
  savedIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: ios.spacing.md,
  },
  savedBody: { flex: 1, paddingRight: ios.spacing.xs },
  savedTitle: {
    fontSize: ios.fontSize.callout,
    fontWeight: ios.fontWeight.semibold,
    color: colors.text,
  },
  savedAddr: { fontSize: ios.fontSize.caption, color: colors.textSecondary, marginTop: 2 },
  iconBtn: { paddingHorizontal: ios.spacing.sm, paddingVertical: ios.spacing.md },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: ios.radius.xl,
    borderTopRightRadius: ios.radius.xl,
    padding: ios.spacing.lg,
    paddingBottom: ios.spacing.xxl,
  },
  modalTitle: {
    fontSize: ios.fontSize.title3,
    fontWeight: ios.fontWeight.bold,
    color: colors.text,
    marginBottom: ios.spacing.md,
  },
  fieldLabel: {
    fontSize: ios.fontSize.caption,
    fontWeight: ios.fontWeight.semibold,
    color: colors.textSecondary,
    marginBottom: ios.spacing.xs,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: ios.radius.md,
    paddingHorizontal: ios.spacing.md,
    paddingVertical: ios.spacing.sm,
    fontSize: ios.fontSize.body,
    color: colors.text,
    marginBottom: ios.spacing.md,
    backgroundColor: colors.background,
  },
  kindRow: { flexDirection: 'row', flexWrap: 'wrap', gap: ios.spacing.xs, marginBottom: ios.spacing.md },
  kindChip: {
    paddingHorizontal: ios.spacing.sm,
    paddingVertical: 6,
    borderRadius: ios.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  kindChipOn: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  kindChipText: { fontSize: ios.fontSize.caption, color: colors.text },
  kindChipTextOn: { color: colors.primaryDark, fontWeight: ios.fontWeight.semibold },
  mapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ios.spacing.sm,
    paddingVertical: ios.spacing.md,
  },
  mapBtnText: { fontSize: ios.fontSize.callout, color: colors.primary, fontWeight: ios.fontWeight.semibold },
  addrPreview: { fontSize: ios.fontSize.caption, color: colors.textSecondary, marginBottom: ios.spacing.md },
  addrHint: { fontSize: ios.fontSize.caption, color: colors.textSecondary, marginBottom: ios.spacing.md },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: ios.spacing.md, marginTop: ios.spacing.sm },
  btnSecondary: { paddingVertical: ios.spacing.sm, paddingHorizontal: ios.spacing.md },
  btnSecondaryText: { color: colors.textSecondary, fontWeight: '600' },
  btnPrimary: {
    backgroundColor: colors.primary,
    paddingVertical: ios.spacing.sm,
    paddingHorizontal: ios.spacing.lg,
    borderRadius: ios.radius.md,
    minWidth: 100,
    alignItems: 'center',
  },
  btnPrimaryText: { color: colors.white, fontWeight: ios.fontWeight.semibold },
});
