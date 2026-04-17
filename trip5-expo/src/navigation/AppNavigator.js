import React, { useState, useCallback, useMemo } from 'react';
import { Platform } from 'react-native';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { OrderProvider } from '../context/OrderContext';
import { LocaleTabContext } from '../context/LocaleTabContext';
import { useTheme } from '../context/ThemeContext';
import DashboardScreen from '../screens/DashboardScreen';
import ActivityScreen from '../screens/ActivityScreen';
import AccountScreen from '../screens/AccountScreen';
import BookingFlowScreen from '../screens/BookingFlowScreen';
import SavedPlacesScreen from '../screens/SavedPlacesScreen';
import TripTrackingScreen from '../screens/TripTrackingScreen';
import i18n from '../i18n';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function BookingStackScreen(props) {
  return (
    <OrderProvider>
      <BookingFlowScreen {...props} />
    </OrderProvider>
  );
}

function MainTabs() {
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
          name="Home"
          component={DashboardScreen}
          options={{
            tabBarLabel: i18n.t('tab_home'),
            tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
          }}
        />
        <Tab.Screen
          name="Activity"
          component={ActivityScreen}
          options={{
            tabBarLabel: i18n.t('tab_activity'),
            tabBarIcon: ({ color, size }) => <Ionicons name="receipt-outline" size={size} color={color} />,
          }}
        />
        <Tab.Screen
          name="Account"
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

export default function AppNavigator() {
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
      <Stack.Navigator initialRouteName="Main" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Main" component={MainTabs} />
        <Stack.Screen name="Booking" component={BookingStackScreen} />
        <Stack.Screen name="TripTracking" component={TripTrackingScreen} />
        <Stack.Screen name="SavedPlaces" component={SavedPlacesScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
