import React, { useMemo } from 'react';
import { View, ActivityIndicator, Image, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ios } from '../theme';
import { useTheme } from '../context/ThemeContext';

function createStyles(colors) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.background,
    },
    inner: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: ios.spacing.xl,
    },
    logo: {
      width: 160,
      height: 160,
      marginBottom: ios.spacing.xl,
    },
  });
}

export default function AppLoadingScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.inner}>
        <Image source={require('../../assets/trip5-logo.png')} style={styles.logo} resizeMode="contain" />
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    </SafeAreaView>
  );
}
