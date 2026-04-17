import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';

function createStyles(colors) {
  return StyleSheet.create({
    dot: {
      position: 'absolute',
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.error,
      borderWidth: 2,
      borderColor: colors.white,
    },
  });
}

export default function ChatUnreadDot({ style }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <View style={[styles.dot, style]} />;
}
