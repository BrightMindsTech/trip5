import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, ios } from '../theme';
import i18n from '../i18n';

const STEPS = [1, 2, 3, 4];

export default function StepProgress({ current, total, heading, routeText }) {
  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <Text style={styles.stepLabel}>STEP {String(current).padStart(2, '0')}</Text>
        {routeText ? (
          <Text style={styles.routeBadge} numberOfLines={1}>{routeText}</Text>
        ) : null}
      </View>
      {heading ? <Text style={styles.heading}>{heading}</Text> : null}
      <View style={styles.checkpointsRow}>
        {STEPS.map((step, index) => {
          const isCompleted = step < current;
          const isCurrent = step === current;
          const isLast = index === STEPS.length - 1;
          const title = i18n.t(`step_cp_${step}`);
          return (
            <View key={step} style={styles.checkpointWrap}>
              <View style={styles.checkpointTop}>
                {index > 0 && (
                  <View
                    style={[
                      styles.connector,
                      current >= step && styles.connectorDone,
                    ]}
                  />
                )}
                <View
                  style={[
                    styles.checkpointCircle,
                    isCompleted && styles.checkpointCircleDone,
                    isCurrent && styles.checkpointCircleCurrent,
                  ]}
                >
                  {isCompleted ? (
                    <Ionicons name="checkmark" size={12} color={colors.white} />
                  ) : (
                    <Text
                      style={[
                        styles.checkpointNum,
                        isCurrent && styles.checkpointNumCurrent,
                      ]}
                    >
                      {step}
                    </Text>
                  )}
                </View>
                {!isLast && (
                  <View
                    style={[
                      styles.connector,
                      current > step && styles.connectorDone,
                    ]}
                  />
                )}
              </View>
              <Text
                style={[
                  styles.checkpointTitle,
                  isCurrent && styles.checkpointTitleCurrent,
                  isCompleted && styles.checkpointTitleDone,
                ]}
                numberOfLines={1}
              >
                {title}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const CIRCLE_SIZE = 24;

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: ios.spacing.lg,
    paddingVertical: ios.spacing.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  stepLabel: {
    fontSize: 10,
    fontWeight: ios.fontWeight.semibold,
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  routeBadge: {
    fontSize: 11,
    fontWeight: ios.fontWeight.semibold,
    color: colors.primary,
    maxWidth: '60%',
  },
  heading: {
    fontSize: ios.fontSize.subhead,
    fontWeight: ios.fontWeight.bold,
    color: colors.text,
    marginBottom: ios.spacing.sm,
    letterSpacing: -0.3,
  },
  checkpointsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  checkpointWrap: {
    flex: 1,
    alignItems: 'center',
    minWidth: 0,
  },
  checkpointTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  connector: {
    flex: 1,
    height: 2,
    backgroundColor: colors.border,
    marginHorizontal: 2,
  },
  connectorDone: {
    backgroundColor: colors.primary,
  },
  checkpointCircle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkpointCircleDone: {
    backgroundColor: colors.primary,
  },
  checkpointCircleCurrent: {
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.primaryLight,
  },
  checkpointNum: {
    fontSize: 10,
    fontWeight: ios.fontWeight.bold,
    color: colors.textSecondary,
  },
  checkpointNumCurrent: {
    color: colors.white,
  },
  checkpointTitle: {
    fontSize: 9,
    fontWeight: ios.fontWeight.medium,
    color: colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  checkpointTitleCurrent: {
    color: colors.primary,
    fontWeight: ios.fontWeight.bold,
  },
  checkpointTitleDone: {
    color: colors.textSecondary,
  },
});
