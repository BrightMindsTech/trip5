import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import i18n from '../i18n';
import { ios } from '../theme';
import { useTheme } from '../context/ThemeContext';

function createRiderDriverStyles(colors) {
  return StyleSheet.create({
    wrap: {
      backgroundColor: colors.surface,
      borderRadius: ios.radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: ios.spacing.md,
    },
    wrapCompact: {
      paddingVertical: ios.spacing.sm,
      paddingHorizontal: ios.spacing.md,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ios.spacing.sm,
      marginBottom: ios.spacing.xs,
    },
    title: {
      flex: 1,
      fontSize: ios.fontSize.callout,
      fontWeight: ios.fontWeight.bold,
      color: colors.text,
    },
    titleCompact: {
      fontSize: ios.fontSize.subhead,
    },
    driverName: {
      fontSize: ios.fontSize.subhead,
      fontWeight: ios.fontWeight.semibold,
      color: colors.textSecondary,
      marginBottom: ios.spacing.xs,
    },
    driverNameCompact: {
      fontSize: ios.fontSize.footnote,
    },
    details: {
      marginTop: 2,
    },
    line: {
      fontSize: ios.fontSize.footnote,
      color: colors.text,
      marginTop: 4,
      lineHeight: ios.lineHeight.footnote,
    },
    label: {
      fontWeight: ios.fontWeight.semibold,
      color: colors.textMuted,
    },
    pending: {
      fontSize: ios.fontSize.footnote,
      color: colors.textMuted,
      marginTop: 4,
      lineHeight: ios.lineHeight.footnote,
    },
    scoreLine: {
      marginTop: ios.spacing.sm,
      fontSize: ios.fontSize.caption,
      color: colors.textMuted,
      lineHeight: ios.lineHeight.caption,
    },
  });
}

export default function RiderDriverVehicleSection({ driverId, compact }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createRiderDriverStyles(colors), [colors]);
  const [loading, setLoading] = useState(!!driverId);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    if (!driverId) {
      setProfile(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, driver_car_type, driver_car_color, driver_score, driver_rating_count')
        .eq('id', driverId)
        .maybeSingle();
      if (cancelled) return;
      if (!error && data) setProfile(data);
      else setProfile(null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [driverId]);

  if (!driverId) return null;
  if (loading) {
    return (
      <View style={[styles.wrap, compact && styles.wrapCompact]}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  const carType = String(profile?.driver_car_type || '').trim();
  const carColor = String(profile?.driver_car_color || '').trim();
  const hasVehicle = Boolean(carType || carColor);
  const name = String(profile?.full_name || '').trim();
  const ratingCount =
    profile?.driver_rating_count != null ? Math.max(0, Number(profile.driver_rating_count)) : 0;
  const score =
    profile?.driver_score != null && Number.isFinite(Number(profile.driver_score))
      ? Number(profile.driver_score)
      : null;

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <View style={styles.titleRow}>
        <Ionicons name="car-sport-outline" size={compact ? 18 : 20} color={colors.primaryDark} />
        <Text style={[styles.title, compact && styles.titleCompact]} numberOfLines={1}>
          {compact ? i18n.t('rider_driver_vehicle_short_label') : i18n.t('rider_driver_vehicle_title')}
        </Text>
      </View>
      {name ? (
        <Text style={[styles.driverName, compact && styles.driverNameCompact]} numberOfLines={1}>
          {name}
        </Text>
      ) : null}
      {!profile ? (
        <Text style={styles.pending}>{i18n.t('rider_driver_vehicle_pending')}</Text>
      ) : !hasVehicle ? (
        <Text style={styles.pending}>
          {compact ? i18n.t('rider_driver_vehicle_pending_short') : i18n.t('rider_driver_vehicle_pending')}
        </Text>
      ) : (
        <View style={styles.details}>
          {carType ? (
            <Text style={styles.line} numberOfLines={2}>
              <Text style={styles.label}>{i18n.t('rider_driver_vehicle_type')}: </Text>
              {carType}
            </Text>
          ) : null}
          {carColor ? (
            <Text style={styles.line} numberOfLines={2}>
              <Text style={styles.label}>{i18n.t('rider_driver_vehicle_color')}: </Text>
              {carColor}
            </Text>
          ) : null}
        </View>
      )}
      {score != null && profile ? (
        <Text style={styles.scoreLine} numberOfLines={2}>
          {i18n.t('driver_score_label')}: {score.toFixed(1)}
          {ratingCount > 1
            ? ` · ${i18n.t('driver_score_ratings_count', { count: ratingCount })}`
            : ratingCount === 1
              ? ` · ${i18n.t('driver_score_rating_singular')}`
              : ''}
        </Text>
      ) : null}
    </View>
  );
}
