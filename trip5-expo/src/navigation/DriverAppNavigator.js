import React, { useState, useCallback, useMemo } from 'react';
import { Platform } from 'react-native';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { LocaleTabContext } from '../context/LocaleTabContext';
import { useTheme } from '../context/ThemeContext';
import DriverDashboardScreen from '../screens/DriverDashboardScreen';
import DriverHomeScreen from '../screens/DriverHomeScreen';
import AccountScreen from '../screens/AccountScreen';
import i18n from '../i18n';

const Tab = createBottomTabNavigator();

function DriverTabs() {
  const { colors } = useTheme();
  const [, setTick] = useState(0);
  const bump = useCallback(() => setTick((t) => t + 1), []);

  const screenOptions = useMemo(
    () => ({
      headerShown: false,
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.placeholder,
      tabBarStyle: {
        backgroundColor: colors.surface,
        borderTopColor: colors.border,
        paddingTop: 4,
        paddingBottom: Platform.OS === 'ios' ? 20 : 8,
        height: Platform.OS === 'ios' ? 88 : 64,
      },
      tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
    }),
    [colors]
  );

  return (
    <LocaleTabContext.Provider value={bump}>
      <Tab.Navigator screenOptions={screenOptions}>
        <Tab.Screen
          name="DriverDashboard"
          component={DriverDashboardScreen}
          options={{
            tabBarLabel: i18n.t('driver_tab_dashboard'),
            tabBarIcon: ({ color, size }) => <Ionicons name="speedometer-outline" size={size} color={color} />,
          }}
        />
        <Tab.Screen
          name="DriverJobs"
          component={DriverHomeScreen}
          options={{
            tabBarLabel: i18n.t('driver_tab_jobs'),
            tabBarIcon: ({ color, size }) => <Ionicons name="navigate-circle" size={size} color={color} />,
          }}
        />
        <Tab.Screen
          name="DriverAccount"
          component={AccountScreen}
          options={{
            tabBarLabel: i18n.t('tab_account'),
            tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
          }}
        />
      </Tab.Navigator>
    </LocaleTabContext.Provider>
  );
}

export default function DriverAppNavigator() {
  const { colors, isDark } = useTheme();

  const navTheme = useMemo(
    () => ({
      ...(isDark ? DarkTheme : DefaultTheme),
      colors: {
        ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
        primary: colors.primary,
        background: colors.background,
        card: colors.surface,
        text: colors.text,
        border: colors.border,
        notification: colors.primary,
      },
    }),
    [isDark, colors]
  );

  return (
    <NavigationContainer theme={navTheme}>
      <DriverTabs />
    </NavigationContainer>
  );
}
